"""DAViD multi-task inference: BGR frame -> normals, relative depth, soft matte.

Preprocessing matches microsoft/DAViD runtime/utils.py (BGR in [0,1], replicate-pad
to square, linear resize to 512) but runs on the GPU.
"""
import time
import numpy as np
import torch
import torch.nn.functional as F

from onnx_torch import Runner

import os
ROI = int(os.environ.get("DEPTHR_ROI", "512"))


class David:
    def __init__(self, model_path, device="cuda:0", dtype="fp16", cuda_graph=True):
        self.device = torch.device(device)
        dt = {"fp16": torch.float16, "bf16": torch.bfloat16, "fp32": torch.float32}[dtype]
        t0 = time.time()
        self.r = Runner(model_path, device, dt)
        with torch.cuda.device(self.device):
            outs = self.r.build((1, 3, ROI, ROI))
        print(f"[david] graph folded: {len(self.r.plan)} live ops, {self.r.fused} attention fused, outputs "
              f"{[tuple(o.shape) for o in outs]} ({time.time() - t0:.1f}s)", flush=True)
        self.graph = False
        if cuda_graph and self.device.type == "cuda":
            try:
                self.r.capture()
                self.graph = True
            except Exception as e:  # fall back to eager replay
                print("[david] CUDA graph capture failed, eager mode:", e, flush=True)
        self.dmin = None
        self.dmax = None
        self.ms = 0.0

    def __call__(self, bgr: np.ndarray, out_w=512):
        with torch.no_grad(), torch.cuda.device(self.device):
            return self._call(bgr, out_w)

    def _call(self, bgr: np.ndarray, out_w=512):
        """Returns packed RGBA8 aux image (out_h*2, out_w, 4) and timing.

        rows [0, out_h):        R,G,B = normal*0.5+0.5, A = matte
        rows [out_h, 2*out_h):  R = depth hi byte, G = depth lo byte (near = 1), B = matte, A = 255
        """
        t0 = time.perf_counter()
        h, w = bgr.shape[:2]
        x = torch.from_numpy(bgr).to(self.device, non_blocking=True)
        x = x.permute(2, 0, 1)[None].float().div_(255.0)
        # replicate-pad to square exactly like prepare_image_for_model
        if h < w:
            pt, pb, pl, pr = (w - h) // 2, w - h - (w - h) // 2, 0, 0
        elif h > w:
            pt, pb, pl, pr = 0, 0, (h - w) // 2, h - w - (h - w) // 2
        else:
            pt = pb = pl = pr = 0
        if pt or pb or pl or pr:
            x = F.pad(x, (pl, pr, pt, pb), mode="replicate")
        S = x.shape[-1]
        while S > ROI * 3:
            x = F.avg_pool2d(x, 2)
            S = x.shape[-1]
        x = F.interpolate(x, size=(ROI, ROI), mode="bilinear", align_corners=False)

        if self.graph:
            self.r.inp.copy_(x)
            depth, normal, fg = self.r.replay()
        else:
            depth, normal, fg = self.r.run(x.to(self.r.dtype))

        # crop padding back out in model space, then size to output aspect
        sc = ROI / max(h, w)
        y0, y1 = int(round(pt * sc)), ROI - int(round(pb * sc))
        x0, x1 = int(round(pl * sc)), ROI - int(round(pr * sc))
        out_h = max(2, int(round(out_w * h / w)))

        def crop(t):
            t = t.float()
            if t.dim() == 3:
                t = t[:, None]
            t = t[:, :, y0:y1, x0:x1]
            return F.interpolate(t, size=(out_h, out_w), mode="bilinear", align_corners=False)[0]

        n = crop(normal)
        n = n / (n.norm(dim=0, keepdim=True) + 1e-6)
        m = crop(fg).clamp(0, 1)[0]
        d = -crop(depth)[0]  # raw output is negative inverse depth -> near = high

        # temporally smoothed robust range so the depth does not breathe frame to frame
        q = torch.quantile(d[::4, ::4].reshape(-1), torch.tensor([0.01, 0.99], device=d.device))
        lo, hi = float(q[0]), float(q[1])
        if self.dmin is None:
            self.dmin, self.dmax = lo, hi
        else:
            self.dmin += (lo - self.dmin) * 0.15
            self.dmax += (hi - self.dmax) * 0.15
        dn = ((d - self.dmin) / max(1e-6, self.dmax - self.dmin)).clamp(0, 1)
        d16 = (dn * 65535).round().to(torch.int32)

        top = torch.cat([(n * 0.5 + 0.5).mul(255).round(), m[None].mul(255).round()], 0).to(torch.uint8)
        bot = torch.stack([(d16 >> 8).to(torch.uint8), (d16 & 255).to(torch.uint8),
                           m.mul(255).round().to(torch.uint8),
                           torch.full_like(m, 255, dtype=torch.uint8)], 0)
        packed = torch.cat([top, bot], 1).permute(1, 2, 0).contiguous().cpu().numpy()
        self.ms = (time.perf_counter() - t0) * 1000
        return packed, out_w, out_h
