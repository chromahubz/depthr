"""DEPTHR - live DAViD normals/depth/matte + finger spotlights.

    python app.py                      # webcam 0, browser panel on http://localhost:8790
    python app.py --source video.mp4   # loop a video file instead
"""
import argparse
import json
import os
import struct
import sys
import threading
import time
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

import shutil
import subprocess

import cv2
import numpy as np

import bake

HERE = Path(__file__).resolve().parent
MODELS = Path(os.environ.get("DEPTHR_MODELS", bake.HOME / "models"))
WEB = HERE / "web"


# ------------------------------------------------------------------ sources
import itertools
_FID = itertools.count(1)  # frame ids stay monotonic across source switches
AUTOGAIN = True
AUTOGAIN_MAX = 4.0
AUTOGAIN_LUT = {}


def open_camera(spec, width, height, fps):
    """'auto' -> first index that delivers frames, skipping virtual cams that only show a logo."""
    idxs = range(6) if spec == "auto" else [int(spec)]
    for i in idxs:
        cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
        if not cap.isOpened():
            continue
        # order matters on DirectShow: size -> fps -> MJPG, else YUY2 caps at ~10 fps
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        cap.set(cv2.CAP_PROP_FPS, fps)
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        ok, f = cap.read()
        if ok and f is not None:
            # virtual cams (Snap/OBS idle) show a static card; a real cam has sensor noise
            ok2, g = cap.read()
            still = ok2 and cv2.absdiff(f, g).mean() < 0.05
            if spec == "auto" and still:
                print(f"[depthr] camera {i} looks like a static virtual cam, skipping", flush=True)
                cap.release()
                continue
            print(f"[depthr] camera {i} opened {f.shape[1]}x{f.shape[0]}", flush=True)
            return cap
        cap.release()
    raise RuntimeError(f"no working camera for '{spec}' (is it used by another app?)")


class Source:
    """Latest-frame grabber for a webcam index or a looping video file."""

    def __init__(self, spec, width=1280, height=720, fps=30):
        self.spec = spec
        self.lock = threading.Lock()
        self.frame = None
        self.fid = 0
        self.alive = True
        self.fps = 0.0
        self.is_file = not (str(spec).isdigit() or spec == "auto")
        if self.is_file:
            self.cap = cv2.VideoCapture(str(spec))
            self.file_fps = self.cap.get(cv2.CAP_PROP_FPS) or 30
        else:
            self.cap = open_camera(spec, width, height, fps)
        if not self.cap.isOpened():
            raise RuntimeError(f"cannot open source {spec}")
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        t_last, n = time.time(), 0
        nxt = time.perf_counter()
        while self.alive:
            ok, f = self.cap.read()
            if not ok:
                if self.is_file:
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                time.sleep(0.01)
                continue
            if self.is_file:  # pace to the file's own rate
                nxt += 1.0 / self.file_fps
                d = nxt - time.perf_counter()
                if d > 0:
                    time.sleep(d)
                else:
                    nxt = time.perf_counter()
            if not self.is_file and AUTOGAIN:
                f = self._autogain(f)
            with self.lock:
                self.frame = f
                self.fid = next(_FID)
            n += 1
            if time.time() - t_last > 1:
                self.fps = n / (time.time() - t_last)
                t_last, n = time.time(), 0

    gain = 1.0

    def _autogain(self, f):
        """Dim rooms: lift the frame toward a usable exposure (smoothed, capped) so DAViD
        and the hand tracker can see. Uses the bright end (p97) so lamps don't blow out."""
        small = f[::16, ::16]
        p97 = float(np.percentile(small, 97)) + 1.0
        mean = float(small.mean()) + 1.0
        target = min(200.0 / p97, 110.0 / mean, AUTOGAIN_MAX)
        target = max(1.0, target)
        self.gain += (target - self.gain) * 0.1
        if self.gain < 1.05:
            return f
        # linear gain with a soft shoulder (x*g/(1+s*x*g))*(1+s), so highlights roll off
        g = round(self.gain, 1)
        lut = AUTOGAIN_LUT.get(g)
        if lut is None:
            y = np.arange(256, dtype=np.float32) / 255.0 * g
            lut = np.clip(y / (1 + 0.3 * y) * 1.3 * 255, 0, 255).astype(np.uint8)
            AUTOGAIN_LUT[g] = lut
        return cv2.LUT(f, lut)

    def latest(self):
        with self.lock:
            return self.fid, self.frame

    def close(self):
        self.alive = False
        time.sleep(0.05)
        self.cap.release()


# ------------------------------------------------------------------ hands
class Hands:
    """MediaPipe hand landmarker on the newest frame, independent of the depth model."""

    def __init__(self, source, task_path):
        import mediapipe as mp
        from mediapipe.tasks.python import vision, BaseOptions
        self.mp = mp
        opts = vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(task_path)),
            running_mode=vision.RunningMode.VIDEO, num_hands=2,
            min_hand_detection_confidence=0.5, min_hand_presence_confidence=0.5,
            min_tracking_confidence=0.5)
        self.det = vision.HandLandmarker.create_from_options(opts)
        self.source = source
        self.hands = []
        self.ms = 0.0
        self.enabled = True
        self.paused = False
        self.t0 = time.perf_counter()
        threading.Thread(target=self._loop, daemon=True).start()

    def _loop(self):
        last = -1
        while True:
            fid, f = self.source.latest()
            if f is None or fid == last or not self.enabled or self.paused:
                time.sleep(0.003)
                if not self.enabled:
                    self.hands = []
                continue
            last = fid
            t = time.perf_counter()
            small = cv2.resize(f, (640, int(640 * f.shape[0] / f.shape[1])), interpolation=cv2.INTER_AREA)
            img = self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=cv2.cvtColor(small, cv2.COLOR_BGR2RGB))
            ts = int((time.perf_counter() - self.t0) * 1000)
            try:
                res = self.det.detect_for_video(img, ts)
            except Exception as e:
                print("[hands]", e, flush=True)
                continue
            out = []
            for i, lm in enumerate(res.hand_landmarks):
                side = res.handedness[i][0].category_name if res.handedness else "?"
                out.append({"side": side, "p": [[round(p.x, 4), round(p.y, 4), round(p.z, 4)] for p in lm]})
            self.hands = out
            self.ms = (time.perf_counter() - t) * 1000


# ------------------------------------------------------------------ pipeline
class Pipeline:
    """One DAViD worker per GPU; workers claim the newest unclaimed frame, so two GPUs
    alternate frames (double throughput, same latency). Late results are dropped."""

    def __init__(self, args):
        self.args = args
        missing = [n for n in (args.model, "hand_landmarker.task") if not (MODELS / n).is_file()]
        if missing:
            sys.exit(f"[depthr] missing model file(s) in {MODELS}: {', '.join(missing)}\n"
                     f"          see README 'Setup' for the download links (or set DEPTHR_MODELS / DEPTHR_HOME)")
        self.source = Source(args.source, args.width, args.height, args.fps)
        self.hands = Hands(self.source, MODELS / "hand_landmarker.task")
        from engine import David
        self.workers = []
        for dev in [d.strip() for d in args.device.split(",") if d.strip()]:
            print(f"[depthr] loading DAViD on {dev} ...", flush=True)
            w = David(MODELS / args.model, dev, args.dtype, not args.no_graph)
            w.lock = threading.Lock()
            self.workers.append(w)
        self.paused = False  # a bake owns the GPU/model while it runs
        self.cond = threading.Condition()
        self.claim_lock = threading.Lock()
        self.claimed = -1
        self.published = -1
        self.packet = None
        self.pid = 0
        self.fps = 0.0
        self._n, self._t = 0, time.time()
        self.src_lock = threading.Lock()
        for w in self.workers:
            threading.Thread(target=self._loop, args=(w,), daemon=True).start()

    def set_source(self, spec):
        new = Source(spec, self.args.width, self.args.height, self.args.fps)
        with self.src_lock:
            old, self.source = self.source, new
            self.hands.source = new
        old.close()

    def _loop(self, david):
        import torch
        torch.cuda.set_device(david.device)
        while True:
            with self.src_lock:
                src = self.source
            fid, f = src.latest()
            if self.paused:
                time.sleep(0.02)
                continue
            with self.claim_lock:
                if f is None or fid <= self.claimed:
                    fid = None
                else:
                    self.claimed = fid
            if fid is None:
                time.sleep(0.002)
                continue
            # keep webcam frames modest; the model only sees 512 anyway
            if f.shape[1] > 1280:
                f = cv2.resize(f, (1280, int(1280 * f.shape[0] / f.shape[1])), interpolation=cv2.INTER_AREA)
            try:
                with david.lock:
                    aux, aw, ah = david(f, self.args.aux_width)
            except Exception as e:
                print("[david] error:", e, flush=True)
                time.sleep(0.2)
                continue
            ok, jpg = cv2.imencode(".jpg", f, [cv2.IMWRITE_JPEG_QUALITY, 88])
            with self.cond:
                if fid <= self.published:
                    continue  # another GPU already showed a newer frame
                self.published = fid
                self._n += 1
                if time.time() - self._t > 1:
                    self.fps = self._n / (time.time() - self._t)
                    self._t, self._n = time.time(), 0
                head = json.dumps({
                    "id": self.pid + 1, "w": f.shape[1], "h": f.shape[0], "aw": aw, "ah": ah,
                    "jpg": len(jpg), "hands": self.hands.hands,
                    "stats": {"fps": round(self.fps, 1), "cam": round(src.fps, 1), "gain": round(src.gain, 1),
                              "model_ms": round(sum(w.ms for w in self.workers) / len(self.workers), 1),
                              "gpus": len(self.workers), "hand_ms": round(self.hands.ms, 1),
                              "graph": all(w.graph for w in self.workers)},
                }).encode()
                self.pid += 1
                self.packet = (self.pid, struct.pack("<I", len(head)) + head + jpg.tobytes() + aux.tobytes())
                self.cond.notify_all()

    def wait(self, after, timeout=1.0):
        with self.cond:
            if self.packet is None or self.packet[0] <= after:
                self.cond.wait(timeout)
            return self.packet


PIPE = None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        global BAKE
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path == "/frame":
            after = int(q.get("after", ["0"])[0])
            p = PIPE.wait(after)
            if p is None:
                return self._send(204, b"", "text/plain")
            return self._send(200, p[1], "application/octet-stream")
        if u.path == "/source":
            spec = q.get("s", ["0"])[0]
            try:
                PIPE.set_source(spec)
                return self._send(200, b'{"ok":true}', "application/json")
            except Exception as e:
                return self._send(400, json.dumps({"ok": False, "err": str(e)}).encode(), "application/json")
        if u.path == "/clips":
            return self._json({"clips": bake.list_clips(), "free_mb": free_mb()})
        if u.path == "/probe":
            try:
                return self._json({"ok": True, **bake.probe(q.get("p", [""])[0])})
            except Exception as e:
                return self._json({"ok": False, "err": str(e)}, 400)
        if u.path == "/bake/open":
            g = lambda k, d="": q.get(k, [d])[0]
            try:
                if BAKE:
                    BAKE.close(cancel=True)
                PIPE.paused = PIPE.hands.paused = True
                BAKE = bake.Bake(PIPE, MODELS, g("p"), float(g("start", "0")), float(g("end", "0")),
                                 int(g("maxw", "1920")), g("song"), g("tag", "fx"), int(g("crf", "17")), g("alpha"))
                return self._json({"ok": True, **BAKE.info()})
            except Exception as e:
                BAKE = None
                PIPE.paused = PIPE.hands.paused = False
                return self._json({"ok": False, "err": str(e)}, 400)
        if u.path == "/bake/frame":
            if not BAKE:
                return self._send(409, b"no bake", "text/plain")
            pk = BAKE.frame(int(q.get("i", ["0"])[0]))
            return self._send(200, pk, "application/octet-stream") if pk else self._send(204, b"", "text/plain")
        if u.path == "/bake/close":
            r = {"ok": False, "err": "no bake"}
            if BAKE:
                r = BAKE.close(cancel=q.get("cancel", ["0"])[0] == "1")
            BAKE = None
            PIPE.paused = PIPE.hands.paused = False
            r["free_mb"] = free_mb()
            return self._json(r)
        if u.path == "/reveal":
            bake.RENDERS.mkdir(parents=True, exist_ok=True)
            p = q.get("p", [""])[0]
            if p and Path(p).is_file():
                subprocess.Popen(["explorer", "/select,", str(Path(p))])
            else:
                os.startfile(str(bake.RENDERS))
            return self._json({"ok": True})
        if u.path == "/favs":
            try:
                data = json.loads(FAVS_FILE.read_text(encoding="utf-8")) if FAVS_FILE.is_file() else {"version": 1, "favs": []}
            except Exception as e:
                return self._json({"ok": False, "err": f"{FAVS_FILE} is not valid JSON: {e}", "favs": []}, 500)
            return self._json({"ok": True, "path": str(FAVS_FILE), **data})
        if u.path == "/hands":
            PIPE.hands.enabled = q.get("on", ["1"])[0] == "1"
            return self._send(200, b'{"ok":true}', "application/json")
        name = "index.html" if u.path in ("/", "") else u.path.lstrip("/")
        fp = (WEB / name).resolve()
        if WEB in fp.parents or fp == WEB / "index.html":
            if fp.is_file():
                ct = {".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css"}.get(fp.suffix, "application/octet-stream")
                return self._send(200, fp.read_bytes(), ct)
        self._send(404, b"not found", "text/plain")

    def _json(self, obj, code=200):
        return self._send(code, json.dumps(obj).encode(), "application/json")

    def do_POST(self):
        """/shot?name=x  PNG body  -> SHOTS/x.png    (snapshots / review sheets)
        /upload?name=x  file body -> CLIPS/x       (clips and songs for baking)
        /bake/put       raw RGBA  -> ffmpeg"""
        u = urlparse(self.path)
        n = int(self.headers.get("Content-Length", 0))
        if u.path == "/bake/put":
            body = self.rfile.read(n)
            if not BAKE:
                return self._json({"ok": False, "err": "no bake"}, 409)
            try:
                BAKE.put(body)
                return self._json({"ok": True})
            except Exception as e:
                return self._json({"ok": False, "err": str(e)}, 500)
        if u.path == "/favs":   # whole favorites list as JSON; written atomically so a crash never leaves half a file
            if n > 2 << 20:
                _drain(self.rfile, n)
                return self._json({"ok": False, "err": "favorites too large"}, 413)
            try:
                data = json.loads(self.rfile.read(n))
                if not isinstance(data.get("favs"), list):
                    raise ValueError("missing favs list")
                FAVS_FILE.parent.mkdir(parents=True, exist_ok=True)
                tmp = FAVS_FILE.with_suffix(".tmp")
                tmp.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
                os.replace(tmp, FAVS_FILE)
                return self._json({"ok": True, "path": str(FAVS_FILE), "n": len(data["favs"])})
            except Exception as e:
                return self._json({"ok": False, "err": str(e)}, 400)
        if u.path == "/upload":
            raw = parse_qs(u.query).get("name", ["clip.mp4"])[0]
            stem, ext = os.path.splitext(os.path.basename(raw))
            stem = "".join(ch for ch in stem if ch.isalnum() or ch in "-_ ").strip()[:60] or "clip"
            ext = "".join(ch for ch in ext if ch.isalnum() or ch == ".")[:6]
            out = bake.CLIPS / f"{stem}{ext}"
            out.parent.mkdir(parents=True, exist_ok=True)
            if out.exists() and out.stat().st_size == n:  # same file uploaded before
                _drain(self.rfile, n)
                return self._json({"ok": True, "path": str(out), "dupe": True})
            if shutil.disk_usage(out.parent).free < n + 200e6:
                _drain(self.rfile, n)
                return self._json({"ok": False, "err": f"not enough space on {out.drive} for {n / 1e6:.0f} MB"}, 507)
            left = n
            with open(out, "wb") as fh:
                while left > 0:
                    chunk = self.rfile.read(min(left, 4 << 20))
                    if not chunk:
                        break
                    fh.write(chunk)
                    left -= len(chunk)
            return self._json({"ok": left == 0, "path": str(out)})
        if u.path != "/shot":
            _drain(self.rfile, n)
            return self._send(404, b"not found", "text/plain")
        name = "".join(ch for ch in parse_qs(u.query).get("name", ["shot"])[0] if ch.isalnum() or ch in "-_")[:60] or "shot"
        body = self.rfile.read(n)
        out = SHOTS / f"{name}.png"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_bytes(body)
        self._json({"ok": True, "path": str(out)})


def _drain(f, n):
    while n > 0:
        c = f.read(min(n, 4 << 20))
        if not c:
            break
        n -= len(c)


SHOTS = Path(os.environ.get("DEPTHR_SHOTS", bake.HOME / "shots"))
FAVS_FILE = Path(os.environ.get("DEPTHR_FAVS", bake.HOME / "favorites.json"))
BAKE = None


def free_mb():
    try:
        bake.RENDERS.mkdir(parents=True, exist_ok=True)
        return int(shutil.disk_usage(bake.RENDERS).free / 1e6)
    except Exception:
        return -1


def main():
    global PIPE
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="auto", help="'auto', a webcam index, or a video path")
    ap.add_argument("--model", default="multi-task-model-vitl16_384.onnx")
    ap.add_argument("--device", default="cuda:0", help="one GPU or a list, e.g. cuda:0,cuda:1")
    ap.add_argument("--dtype", default="fp16", choices=["fp16", "bf16", "fp32"])
    ap.add_argument("--no-graph", action="store_true")
    ap.add_argument("--width", type=int, default=1280)
    ap.add_argument("--height", type=int, default=720)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--aux-width", type=int, default=512)
    ap.add_argument("--port", type=int, default=8790)
    ap.add_argument("--no-autogain", action="store_true", help="don't brighten dim webcam frames")
    args = ap.parse_args()
    global AUTOGAIN
    AUTOGAIN = not args.no_autogain
    PIPE = Pipeline(args)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    srv.daemon_threads = True
    print(f"[depthr] open http://localhost:{args.port}", flush=True)
    srv.serve_forever()


if __name__ == "__main__":
    main()
