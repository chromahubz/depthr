"""Check the torch runner against onnxruntime (CPU) and time it.
python test_model.py image.png [--ort]   -> writes *_normals/_depth/_matte.png next to the image
"""
import sys, time
from pathlib import Path
import cv2, numpy as np, torch
from engine import David, ROI

from app import MODELS
MODEL = MODELS / "multi-task-model-vitl16_384.onnx"
img_p = Path(sys.argv[1])
dev = next((a.split("=")[1] for a in sys.argv if a.startswith("--device=")), "cuda:0")
im = cv2.imread(str(img_p))
dv = David(MODEL, dev, "fp16", cuda_graph=True)
for _ in range(3):
    packed, w, h = dv(im)
torch.cuda.synchronize()
t = time.perf_counter(); N = 20
for _ in range(N):
    packed, w, h = dv(im)
print(f"full frame call: {(time.perf_counter() - t) / N * 1000:.1f} ms  (graph={dv.graph})")
x = torch.zeros(1, 3, ROI, ROI, device=dev, dtype=torch.float16)
if dv.graph:
    torch.cuda.synchronize(); t = time.perf_counter()
    for _ in range(N): dv.r.replay()
    torch.cuda.synchronize(); print(f"model only: {(time.perf_counter() - t) / N * 1000:.1f} ms")

top, bot = packed[:h], packed[h:]
stem = img_p.with_suffix("")
cv2.imwrite(f"{stem}_normals.png", cv2.cvtColor(top[..., :3], cv2.COLOR_RGB2BGR))
cv2.imwrite(f"{stem}_matte.png", top[..., 3])
cv2.imwrite(f"{stem}_depth.png", bot[..., 0])

if "--ort" in sys.argv:
    import onnxruntime as ort
    s = ort.InferenceSession(str(MODEL), providers=["CPUExecutionProvider"])
    # same preprocessing as DAViD utils, numpy
    f = im.astype(np.float32) / 255
    H, W = f.shape[:2]
    if W >= H: p = (W - H) // 2; sq = cv2.copyMakeBorder(f, p, W - H - p, 0, 0, cv2.BORDER_REPLICATE)
    else: p = (H - W) // 2; sq = cv2.copyMakeBorder(f, 0, 0, p, H - W - p, cv2.BORDER_REPLICATE)
    inp = cv2.resize(sq, (ROI, ROI), interpolation=cv2.INTER_LINEAR).transpose(2, 0, 1)[None]
    t = time.perf_counter(); ref = s.run(None, {s.get_inputs()[0].name: inp}); print(f"ort cpu {time.perf_counter() - t:.1f}s")
    mine = dv.r.run(torch.from_numpy(inp).to(dev, torch.float16))
    for name, a, b in zip(["depth", "normal", "fg"], ref, mine):
        b = b.float().cpu().numpy()
        err = np.abs(a - b)
        print(f"{name}: shape {a.shape} range [{a.min():.3f},{a.max():.3f}] max|err| {err.max():.4f} mean|err| {err.mean():.5f}")
