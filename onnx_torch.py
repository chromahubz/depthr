"""Tiny ONNX -> PyTorch graph runner.

Loads an ONNX model, folds everything that does not depend on the input
(shape math, constants) once for a fixed input shape, then replays the
remaining ops as plain torch calls. Float math runs in fp16/bf16 on the GPU,
with overflow-prone reductions done in fp32. The whole plan can be captured
as a CUDA graph because every shape argument is a python int by then.
"""
import math
import numpy as np
import torch
import torch.nn.functional as F
import onnx
torch.backends.cudnn.benchmark = True
from onnx import numpy_helper

ONNX_DT = {1: torch.float32, 2: torch.uint8, 3: torch.int8, 5: torch.int16, 6: torch.int32,
           7: torch.int64, 9: torch.bool, 10: torch.float16, 11: torch.float64, 16: torch.bfloat16}
INT64_MAX = 2 ** 62
import os
CHANNELS_LAST = os.environ.get("DEPTHR_CL", "0") == "1"


def _attrs(node):
    out = {}
    for a in node.attribute:
        v = onnx.helper.get_attribute_value(a)
        if isinstance(v, bytes):
            v = v.decode()
        elif isinstance(v, onnx.TensorProto):
            v = numpy_helper.to_array(v)
        out[a.name] = v
    return out


def _ints(t):
    if t is None:
        return None
    if isinstance(t, torch.Tensor):
        return [int(x) for x in t.reshape(-1).tolist()]
    return [int(x) for x in np.asarray(t).reshape(-1)]


class Runner:
    def __init__(self, path, device="cuda:0", dtype=torch.float16):
        self.device = torch.device(device)
        self.dtype = dtype
        model = onnx.load(str(path))
        g = model.graph
        self.consts = {}
        for init in g.initializer:
            self.consts[init.name] = self._place(numpy_helper.to_array(init))
        del model.graph.initializer[:]  # free the protobuf copies
        init_names = set(self.consts)
        self.input_name = [i.name for i in g.input if i.name not in init_names][0]
        self.output_names = [o.name for o in g.output]
        self.nodes = [(n.op_type, list(n.input), list(n.output), _attrs(n), n.name) for n in g.node]
        self.plan = None
        self.graph = None

    # -- placement: floats live on the GPU in the compute dtype, ints on the CPU (shape math)
    def _place(self, arr):
        # np.array(copy) keeps 0-d scalars 0-d (ascontiguousarray would promote them to 1-d)
        t = torch.from_numpy(np.array(arr, copy=True)) if isinstance(arr, np.ndarray) else arr
        if t.is_floating_point():
            return t.to(self.device, self.dtype)
        return t

    def build(self, shape):
        """Fold static parts for this input shape and make the replay plan."""
        x = torch.zeros(shape, device=self.device, dtype=self.dtype)
        env = dict(self.consts)
        static = set(self.consts)
        env[self.input_name] = x
        plan = []
        for op, ins, outs, at, name in self.nodes:
            fn = OPS.get(op)
            if fn is None and op != "Constant":
                raise NotImplementedError(f"ONNX op {op} ({name})")
            if op == "Constant":
                val = at.get("value")
                if val is None:
                    for k in ("value_float", "value_int", "value_floats", "value_ints"):
                        if k in at:
                            val = np.array(at[k], dtype=np.float32 if "float" in k else np.int64)
                env[outs[0]] = self._place(val)
                static.add(outs[0])
                continue
            vals = [env[i] if i else None for i in ins]
            try:
                res = fn(self, vals, at)
            except Exception as e:
                desc = [(i, tuple(v.shape) if isinstance(v, torch.Tensor) else v,
                         v.tolist() if isinstance(v, torch.Tensor) and v.numel() < 8 else "") for i, v in zip(ins, vals)]
                raise RuntimeError(f"{op} {name} attrs={at} inputs={desc}: {e}") from e
            if not isinstance(res, (tuple, list)):
                res = (res,)
            is_static = op == "Shape" or all((not i) or i in static for i in ins)
            for o, r in zip(outs, res):
                if is_static and isinstance(r, torch.Tensor) and r.is_floating_point():
                    r = r.to(self.device, self.dtype)
                env[o] = r
                if is_static:
                    static.add(o)
            if not is_static:
                plan.append((fn, ins, outs, at))
        self.fused = self._fuse_attention(plan, env, static)
        # resolve which static values the plan needs, drop the rest
        need = set()
        for fn, ins, outs, at in plan:
            need.update(i for i in ins if i)
        self.fixed = {k: env[k] for k in need if k in static and k != self.input_name}
        self.plan = plan
        self.shape = tuple(shape)
        return [env[o] for o in self.output_names]

    def _fuse_attention(self, plan, env, static):
        """Softmax((q*s1) @ (k^T*s2)) @ v  ->  scaled_dot_product_attention(q, k, v, scale=s1*s2)."""
        prod = {}
        uses = {}
        for idx, (fn, ins, outs, at) in enumerate(plan):
            for o in outs:
                prod[o] = idx
            for i in ins:
                if i:
                    uses[i] = uses.get(i, 0) + 1
        drop, n = set(), 0

        def node(name, op):
            j = prod.get(name)
            return (j, plan[j]) if j is not None and plan[j][0] is OPS[op] else (None, None)

        def scalar(name):
            if name in static and isinstance(env[name], torch.Tensor) and env[name].numel() == 1:
                return float(env[name].float().reshape(-1)[0])
            return None

        for idx, (fn, ins, outs, at) in enumerate(plan):
            if fn is not OPS["MatMul"]:
                continue
            js, sm = node(ins[0], "Softmax")
            if sm is None or uses.get(ins[0]) != 1 or sm[3].get("axis", -1) not in (-1, 3):
                continue
            jm, mm = node(sm[1][0], "MatMul")
            if mm is None or uses.get(sm[1][0]) != 1:
                continue
            ja, ma = node(mm[1][0], "Mul")
            jb, mb = node(mm[1][1], "Mul")
            if ma is None or mb is None:
                continue
            s1, s2 = scalar(ma[1][1]), scalar(mb[1][1])
            jt, tk = node(mb[1][0], "Transpose")
            if s1 is None or s2 is None or tk is None or tk[3].get("perm") != [0, 1, 3, 2]:
                continue
            if any(uses.get(x) != 1 for x in (mm[1][0], mm[1][1], mb[1][0])):
                continue
            q, k, v, scale = ma[1][0], tk[1][0], ins[1], s1 * s2
            plan[idx] = (_make_sdpa(scale), [q, k, v], outs, {})
            drop.update({js, jm, ja, jb, jt})
            n += 1
        plan[:] = [p for j, p in enumerate(plan) if j not in drop]
        return n

    def run(self, x):
        env = dict(self.fixed)
        env[self.input_name] = x
        for fn, ins, outs, at in self.plan:
            res = fn(self, [env[i] if i else None for i in ins], at)
            if len(outs) == 1:
                env[outs[0]] = res if not isinstance(res, (tuple, list)) else res[0]
            else:
                for o, r in zip(outs, res):
                    env[o] = r
        return [env[o] for o in self.output_names]

    def capture(self):
        """Record the plan as a CUDA graph. Afterwards: copy into self.inp, call self.replay()."""
        with torch.cuda.device(self.device):  # graph capture follows the *current* device
            self.inp = torch.zeros(self.shape, device=self.device, dtype=self.dtype)
            s = torch.cuda.Stream(self.device)
            s.wait_stream(torch.cuda.current_stream(self.device))
            with torch.cuda.stream(s):
                for _ in range(2):
                    self.run(self.inp)
            torch.cuda.current_stream(self.device).wait_stream(s)
            torch.cuda.synchronize(self.device)
            self.graph = torch.cuda.CUDAGraph()
            with torch.cuda.graph(self.graph, capture_error_mode="relaxed"):
                self.out = self.run(self.inp)
        return self.out

    def replay(self):
        with torch.cuda.device(self.device):
            self.graph.replay()
        return self.out


# ---------------------------------------------------------------- op table
_DEV = {}


def _to(t, device, dtype=None):
    """CPU->GPU copy memoised per source tensor, so CUDA-graph capture never copies."""
    if not isinstance(t, torch.Tensor) or t.device == device:
        return t if dtype is None or not isinstance(t, torch.Tensor) else t.to(dtype)
    k = (id(t), str(device), dtype)
    hit = _DEV.get(k)
    if hit is None or hit[0] is not t:
        hit = (t, t.to(device, dtype) if dtype is not None else t.to(device))
        _DEV[k] = hit
    return hit[1]


def _bin(f):
    def op(r, v, a):
        x, y = v
        if isinstance(x, torch.Tensor) and isinstance(y, torch.Tensor) and x.device != y.device:
            if x.device.type == "cpu":
                x = _to(x, y.device, y.dtype if y.is_floating_point() and x.is_floating_point() else None)
            else:
                y = _to(y, x.device, x.dtype if x.is_floating_point() and y.is_floating_point() else None)
        return f(x, y)
    return op


def _f32(f):
    """Run in fp32, return in the input dtype (overflow-safe reductions)."""
    def op(r, v, a):
        x = v[0]
        if x.is_floating_point() and x.dtype != torch.float32:
            return f(r, [x.float()] + list(v[1:]), a).to(x.dtype)
        return f(r, v, a)
    return op


def _pow(r, v, a):
    x, y = v
    if isinstance(y, torch.Tensor) and y.numel() == 1:
        e = float(y.reshape(-1)[0])
        if e == 2.0:
            return x * x
        if e == 0.5:
            return torch.sqrt(x)
        return torch.pow(x, e)
    return torch.pow(x, _to(y, x.device))


def _reshape(r, v, a):
    x, shp = v
    shp = _ints(shp)
    if not a.get("allowzero", 0):
        shp = [x.shape[i] if s == 0 else s for i, s in enumerate(shp)]
    return x.reshape(shp)


def _slice(r, v, a):
    x = v[0]
    if len(v) > 1:
        starts, ends = _ints(v[1]), _ints(v[2])
        axes = _ints(v[3]) if len(v) > 3 and v[3] is not None else list(range(len(starts)))
        steps = _ints(v[4]) if len(v) > 4 and v[4] is not None else [1] * len(starts)
    else:
        starts, ends = a["starts"], a["ends"]
        axes = a.get("axes", list(range(len(starts))))
        steps = [1] * len(starts)
    idx = [slice(None)] * x.dim()
    for s, e, ax, st in zip(starts, ends, axes, steps):
        n = x.shape[ax]
        if st < 0:
            raise NotImplementedError("negative slice step")
        s = max(0, min(n, s + n if s < 0 else s))
        e = max(0, min(n, e + n if e < 0 else e)) if abs(e) < INT64_MAX else n
        idx[ax] = slice(s, e, st)
    return x[tuple(idx)]


def _gather(r, v, a):
    x, ind = v
    ax = a.get("axis", 0)
    ax = ax % x.dim()
    if ind.dim() == 0 or (ind.device.type == "cpu" and ind.numel() == 1 and ind.dim() == 0):
        i = int(ind)
        return x.select(ax, i + x.shape[ax] if i < 0 else i)
    ind = _to(ind, x.device).long()
    ind = torch.where(ind < 0, ind + x.shape[ax], ind)
    out = torch.index_select(x, ax, ind.reshape(-1))
    return out.reshape(list(x.shape[:ax]) + list(ind.shape) + list(x.shape[ax + 1:]))


def _unsqueeze(r, v, a):
    x = v[0]
    axes = _ints(v[1]) if len(v) > 1 and v[1] is not None else a["axes"]
    nd = x.dim() + len(axes)
    for ax in sorted(ax % nd for ax in axes):
        x = x.unsqueeze(ax)
    return x


def _squeeze(r, v, a):
    x = v[0]
    axes = _ints(v[1]) if len(v) > 1 and v[1] is not None else a.get("axes")
    if axes is None:
        return x.squeeze()
    for ax in sorted((ax % x.dim() for ax in axes), reverse=True):
        x = x.squeeze(ax)
    return x


def _concat(r, v, a):
    v = [t for t in v if t is not None]
    dev = next((t.device for t in v if t.device.type != "cpu"), v[0].device)
    v = [_to(t, dev) for t in v]
    return torch.cat(v, dim=a["axis"])


def _shape(r, v, a):
    s = list(v[0].shape)
    s = s[a.get("start", 0):a.get("end", len(s))] if ("start" in a or "end" in a) else s
    return torch.tensor(s, dtype=torch.int64)


def _cast(r, v, a):
    x = v[0]
    to = ONNX_DT[a["to"]]
    if to.is_floating_point:
        if x.device.type == "cpu" and not x.is_floating_point():
            return x.to(torch.float32)
        return x.to(r.dtype) if x.device.type != "cpu" else x.to(to)
    return x.to(to)


def _conv(r, v, a):
    x, w = v[0], v[1]
    b = v[2] if len(v) > 2 else None
    nd = x.dim() - 2
    pads = a.get("pads", [0] * (2 * nd))
    if a.get("auto_pad", "NOTSET") not in ("NOTSET", "VALID"):
        raise NotImplementedError("auto_pad SAME")
    strides = a.get("strides", [1] * nd)
    dil = a.get("dilations", [1] * nd)
    g = a.get("group", 1)
    if pads[:nd] == pads[nd:]:
        pad = pads[:nd]
    else:
        fp = []
        for i in reversed(range(nd)):
            fp += [pads[i], pads[i + nd]]
        x = F.pad(x, fp)
        pad = [0] * nd
    if nd == 2 and CHANNELS_LAST:
        x = x.contiguous(memory_format=torch.channels_last)
        w = _cl(w)
        return F.conv2d(x, w, b, strides, pad, dil, g)
    f = F.conv2d if nd == 2 else F.conv1d
    return f(x, w, b, strides, pad, dil, g)


_CL = {}


def _cl(w):
    hit = _CL.get(id(w))
    if hit is None or hit[0] is not w:
        hit = (w, w.contiguous(memory_format=torch.channels_last))
        _CL[id(w)] = hit
    return hit[1]


def _convT(r, v, a):
    x, w = v[0], v[1]
    b = v[2] if len(v) > 2 else None
    nd = x.dim() - 2
    pads = a.get("pads", [0] * (2 * nd))
    if pads[:nd] != pads[nd:]:
        raise NotImplementedError("asymmetric ConvTranspose pads")
    return F.conv_transpose2d(x, w, b, a.get("strides", [1] * nd), pads[:nd],
                              a.get("output_padding", [0] * nd), a.get("group", 1),
                              a.get("dilations", [1] * nd))


def _resize(r, v, a):
    x = v[0]
    scales = v[2] if len(v) > 2 else None
    sizes = v[3] if len(v) > 3 else None
    mode = a.get("mode", "nearest")
    ctm = a.get("coordinate_transformation_mode", "half_pixel")
    if sizes is not None and sizes.numel() > 0:
        size = _ints(sizes)[2:]
        sc = None
    else:
        sc = [float(s) for s in _to(scales, torch.device("cpu")).reshape(-1).tolist()][2:]
        size = [int(math.floor(d * s)) for d, s in zip(x.shape[2:], sc)]
    if mode == "nearest":
        return F.interpolate(x, size=size, mode="nearest")
    m = {"linear": "bilinear", "cubic": "bicubic"}[mode]
    ac = ctm == "align_corners"
    return F.interpolate(x, size=size, mode=m, align_corners=ac)


def _layernorm(r, v, a):
    x, w = v[0], v[1]
    b = v[2] if len(v) > 2 else None
    ax = a.get("axis", -1) % x.dim()
    y = F.layer_norm(x.float(), x.shape[ax:], w.float(), None if b is None else b.float(), a.get("epsilon", 1e-5))
    return y.to(x.dtype)


def _reduce(f):
    def op(r, v, a):
        x = v[0]
        axes = _ints(v[1]) if len(v) > 1 and v[1] is not None else a.get("axes")
        kd = bool(a.get("keepdims", 1))
        if axes is None:
            axes = list(range(x.dim()))
        return f(x, dim=axes, keepdim=kd)
    return op


def _gemm(r, v, a):
    A, B = v[0], v[1]
    C = v[2] if len(v) > 2 else None
    if a.get("transA", 0):
        A = A.t()
    if a.get("transB", 0):
        B = B.t()
    y = a.get("alpha", 1.0) * (A @ B)
    if C is not None:
        y = y + a.get("beta", 1.0) * C
    return y


def _split(r, v, a):
    x = v[0]
    ax = a.get("axis", 0)
    sp = _ints(v[1]) if len(v) > 1 and v[1] is not None else a.get("split")
    if sp is None:
        n = a.get("num_outputs")
        return torch.chunk(x, n, dim=ax)
    return torch.split(x, sp, dim=ax)


def _expand(r, v, a):
    x, shp = v
    shp = _ints(shp)
    out = torch.broadcast_shapes(tuple(x.shape), tuple(shp))
    return x.expand(out)


def _where(r, v, a):
    c, x, y = v
    dev = next((t.device for t in v if isinstance(t, torch.Tensor) and t.device.type != "cpu"), c.device)
    return torch.where(_to(c, dev), _to(x, dev), _to(y, dev))


def _cos(r, v, a):
    return torch.cos(v[0])


def _const_of_shape(r, v, a):
    val = a.get("value")
    shp = _ints(v[0])
    if val is None:
        return torch.zeros(shp, dtype=torch.float32)
    t = torch.from_numpy(np.asarray(val).copy()).reshape(-1)
    return t.expand(shp).clone()


def _range(r, v, a):
    s, l, d = (float(t) if t.is_floating_point() else int(t) for t in v)
    return torch.arange(s, l, d)


def _clip(r, v, a):
    x = v[0]
    lo = v[1] if len(v) > 1 and v[1] is not None else a.get("min")
    hi = v[2] if len(v) > 2 and v[2] is not None else a.get("max")
    lo = float(lo) if lo is not None else None
    hi = float(hi) if hi is not None else None
    return torch.clamp(x, lo, hi)


def _softmax(r, v, a):
    x = v[0]
    return torch.softmax(x.float(), dim=a.get("axis", -1)).to(x.dtype)


def _bn(r, v, a):
    x, s, b, m, var = v
    return F.batch_norm(x, m, var, s, b, False, 0.0, a.get("epsilon", 1e-5))


def _flatten(r, v, a):
    x = v[0]
    ax = a.get("axis", 1) % (x.dim() + 1) if x.dim() else 0
    return x.reshape(int(np.prod(x.shape[:ax])) if ax else 1, -1)


def _transpose(r, v, a):
    x = v[0]
    p = a.get("perm", list(reversed(range(x.dim()))))
    return x.permute(p)


def _gelu(r, v, a):
    return F.gelu(v[0], approximate="tanh" if a.get("approximate", "none") == "tanh" else "none")


OPS = {
    "Constant": None,  # handled in build
    "Identity": lambda r, v, a: v[0],
    "Add": _bin(lambda x, y: x + y), "Sub": _bin(lambda x, y: x - y),
    "Mul": _bin(lambda x, y: x * y), "Div": _bin(lambda x, y: x / y if (isinstance(x, torch.Tensor) and x.is_floating_point()) else torch.div(x, y, rounding_mode="floor")),
    "Equal": _bin(lambda x, y: x == y), "Less": _bin(lambda x, y: x < y), "Greater": _bin(lambda x, y: x > y),
    "Max": lambda r, v, a: torch.stack(torch.broadcast_tensors(*v)).amax(0) if len(v) > 2 else torch.maximum(*_align(v)),
    "Min": lambda r, v, a: torch.minimum(*_align(v)),
    "MatMul": _bin(lambda x, y: x @ y), "Gemm": _gemm,
    "Pow": _f32(_pow), "Sqrt": lambda r, v, a: torch.sqrt(v[0]),
    "Exp": lambda r, v, a: torch.exp(v[0]), "Log": lambda r, v, a: torch.log(v[0]),
    "Abs": lambda r, v, a: torch.abs(v[0]), "Neg": lambda r, v, a: -v[0],
    "Reciprocal": lambda r, v, a: 1.0 / v[0], "Erf": lambda r, v, a: torch.erf(v[0]),
    "Tanh": lambda r, v, a: torch.tanh(v[0]), "Sigmoid": lambda r, v, a: torch.sigmoid(v[0]),
    "Relu": lambda r, v, a: F.relu(v[0]), "Gelu": _gelu,
    "LeakyRelu": lambda r, v, a: F.leaky_relu(v[0], a.get("alpha", 0.01)),
    "Sin": lambda r, v, a: torch.sin(v[0]), "Cos": _cos, "Floor": lambda r, v, a: torch.floor(v[0]),
    "Ceil": lambda r, v, a: torch.ceil(v[0]), "Not": lambda r, v, a: ~v[0],
    "Clip": _clip, "Softmax": _softmax, "LayerNormalization": _layernorm,
    "BatchNormalization": _bn,
    "ReduceMean": _f32(_reduce(torch.mean)), "ReduceSum": _f32(_reduce(torch.sum)),
    "ReduceL2": _f32(_reduce(lambda x, dim, keepdim: torch.linalg.vector_norm(x, 2, dim=dim, keepdim=keepdim))),
    "Mod": lambda r, v, a: (torch.fmod if a.get("fmod", 0) else torch.remainder)(*_align(v)),
    "ReduceMax": _reduce(torch.amax), "ReduceMin": _reduce(torch.amin),
    "Reshape": _reshape, "Transpose": _transpose, "Flatten": _flatten,
    "Concat": _concat, "Slice": _slice, "Gather": _gather, "Split": _split,
    "Unsqueeze": _unsqueeze, "Squeeze": _squeeze, "Shape": _shape, "Cast": _cast,
    "Expand": _expand, "Where": _where, "ConstantOfShape": _const_of_shape, "Range": _range,
    "Conv": _conv, "ConvTranspose": _convT, "Resize": _resize,
}


def _align(v):
    dev = next((t.device for t in v if t.device.type != "cpu"), v[0].device)
    return [_to(t, dev) for t in v]


def op_census(path):
    m = onnx.load(str(path), load_external_data=False)
    from collections import Counter
    c = Counter(n.op_type for n in m.graph.node)
    return c, [i for i in m.graph.input], [o for o in m.graph.output]


def _make_sdpa(scale):
    def sdpa(r, v, a):
        q, k, vv = v
        return F.scaled_dot_product_attention(q, k, vv, scale=scale)
    return sdpa
