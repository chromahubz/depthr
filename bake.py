"""Offline "bake": render a pre-filmed clip with the FX, frame by frame, to an MP4.

Unlike live mode nothing is dropped. Every source frame goes through DAViD and the hand tracker,
the browser renders it at fixed virtual time (1/fps steps) and posts the pixels back, and ffmpeg
encodes them with the clip's own audio (or a separate song). Audio-reactive effects get per-frame
bands computed from the soundtrack the same way the browser's AnalyserNode would.
"""
import json
import os
import shutil
import struct
import subprocess
import threading
import time
from pathlib import Path

import cv2
import numpy as np

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
# everything big (models, clips, renders, snapshots) lives under DEPTHR_HOME, default ./data next to the code
HOME = Path(os.environ.get("DEPTHR_HOME", Path(__file__).resolve().parent / "data"))
CLIPS = Path(os.environ.get("DEPTHR_CLIPS", HOME / "clips"))
RENDERS = Path(os.environ.get("DEPTHR_RENDERS", HOME / "renders"))
VIDEO_EXT = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v", ".mts", ".wmv"}


def probe(path):
    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise RuntimeError(f"cannot open {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()
    return {"path": str(path), "name": Path(path).name, "fps": round(fps, 3), "frames": n, "w": w, "h": h,
            "dur": round(n / fps, 2) if fps else 0}


def list_clips():
    out, seen = [], set()
    for d in (CLIPS, CLIPS.parent):
        if not d.is_dir():
            continue
        for p in sorted(d.iterdir(), key=lambda p: -p.stat().st_mtime):
            if p.suffix.lower() in VIDEO_EXT and p.is_file() and p.resolve() not in seen:
                seen.add(p.resolve())
                out.append({"path": str(p), "name": p.name, "mb": round(p.stat().st_size / 1e6, 1)})
    return out


# ------------------------------------------------------------------ audio analysis
def analyse_audio(path, fps, n_frames, sr=48000, N=2048):
    """Per video frame [kick-peak, bass, mid, high] exactly like web/app.js band() over an
    AnalyserNode (fftSize 2048, Blackman window, smoothing .55, -100..-30 dB -> bytes)."""
    try:
        raw = subprocess.run([FFMPEG, "-v", "error", "-i", str(path), "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                             capture_output=True, timeout=900).stdout
    except Exception as e:
        print("[bake] audio decode failed:", e, flush=True)
        return None
    x = np.frombuffer(raw, np.float32)
    if x.size < sr // 5:
        return None
    win = np.blackman(N).astype(np.float32)
    hz = sr / N
    pad = np.concatenate([np.zeros(N, np.float32), x])
    sm = np.zeros(N // 2, np.float32)
    rows = np.zeros((n_frames, N // 2), np.float32)
    for i in range(n_frames):
        e = int(round(i / fps * sr)) + N
        seg = pad[max(0, e - N):e]
        if seg.size < N:
            seg = np.concatenate([seg, np.zeros(N - seg.size, np.float32)])
        mag = np.abs(np.fft.rfft(seg * win))[: N // 2] / N
        sm = 0.55 * sm + 0.45 * mag
        rows[i] = sm
    db = 20 * np.log10(rows + 1e-12)
    B = np.clip(np.floor(255 * (db + 100) / 70), 0, 255)

    def band(lo, hi, peak=False):
        i0, i1 = max(1, int(np.floor(lo / hz))), int(np.ceil(hi / hz))
        s = B[:, i0:i1 + 1]
        return (s.max(1) if peak else s.mean(1)) / 255

    k = band(35, 130, True)
    b = np.minimum(1, band(30, 160) * 1.6)
    m = np.minimum(1, band(400, 2000) * 1.6)
    h = np.minimum(1, band(4000, 12000) * 2)
    return np.round(np.stack([k, b, m, h], 1), 3).tolist()


def has_audio(path):
    try:
        r = subprocess.run([FFMPEG, "-v", "error", "-i", str(path), "-map", "0:a:0", "-t", "0.05", "-f", "null", "-"],
                           capture_output=True, timeout=60)
        return r.returncode == 0
    except Exception:
        return False


_ENC = None


def encoder():
    """'nvenc' if this ffmpeg + GPU can encode H.264 on NVENC, else 'x264' (checked once)."""
    global _ENC
    if _ENC is None:
        try:
            r = subprocess.run([FFMPEG, "-v", "error", "-f", "lavfi", "-i", "color=black:s=256x256:d=0.2", "-c:v", "h264_nvenc",
                                "-f", "null", "-"], capture_output=True, timeout=30)
            _ENC = "nvenc" if r.returncode == 0 else "x264"
        except Exception:
            _ENC = "x264"
        print("[bake] encoder:", _ENC, flush=True)
    return _ENC


# ------------------------------------------------------------------ bake session
class Bake:
    def __init__(self, pipe, models, path, start=0.0, end=0.0, maxw=1920, song="", tag="fx", crf=17, alpha=""):
        self.pipe = pipe
        self.path = str(path)
        self.meta = probe(path)
        self.fps = self.meta["fps"]
        n = self.meta["frames"] or 10 ** 7
        self.start = max(0, int(round(start * self.fps)))
        self.end = min(n, int(round(end * self.fps))) if end > 0 else n
        if self.end <= self.start:
            raise RuntimeError("empty range")
        # output size: keep the clip's aspect, cap the width, force even sides for yuv420
        w, h = self.meta["w"], self.meta["h"]
        s = min(1.0, maxw / w) if maxw > 0 else 1.0
        self.w, self.h = int(round(w * s / 2)) * 2, int(round(h * s / 2)) * 2
        self.cap = cv2.VideoCapture(self.path)
        self.pos = -1
        self.first = max(0, self.start - int(round(self.fps * 0.75)))  # pre-roll so trails / plate / depth settle
        self.expect = self.first
        self.q, self.seek, self.thread = {}, None, None
        self.cv = threading.Condition()
        from concurrent.futures import ThreadPoolExecutor
        self.pool = ThreadPoolExecutor(1)
        self.hand_ms = 0.0
        self.audio_src = song if song else (self.path if has_audio(self.path) else "")
        self.bands = analyse_audio(self.audio_src, self.fps, self.end) if self.audio_src else None
        import mediapipe as mp
        from mediapipe.tasks.python import vision, BaseOptions
        self.mp = mp
        self.det = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=str(models / "hand_landmarker.task")),
            running_mode=vision.RunningMode.VIDEO, num_hands=2,
            min_hand_detection_confidence=0.5, min_hand_presence_confidence=0.5, min_tracking_confidence=0.5))
        self.last_ts = -1
        self.david = pipe.workers[0]
        with self.david.lock:
            self.david.dmin = self.david.dmax = None  # fresh depth range for this clip
        RENDERS.mkdir(parents=True, exist_ok=True)
        free = shutil.disk_usage(RENDERS).free
        if free < 300e6:
            raise RuntimeError(f"only {free / 1e6:.0f} MB free on {RENDERS.drive} - free some space first")
        stem = "".join(ch for ch in Path(self.path).stem if ch.isalnum() or ch in "-_")[:40]
        tag = "".join(ch for ch in tag if ch.isalnum() or ch in "-_")[:40] or "fx"
        self.alpha = alpha if alpha in ("webm", "mov") else ""
        ext = {"webm": ".webm", "mov": ".mov"}.get(self.alpha, ".mp4")
        self.out = RENDERS / f"{stem}-{tag}{'-alpha' if self.alpha else ''}-{time.strftime('%Y%m%d-%H%M%S')}{ext}"
        self.crf = crf
        self.ff = None
        self.written = 0
        self.t0 = time.time()
        self.closed = False

    def info(self):
        return {**self.meta, "first": self.first, "start": self.start, "end": self.end, "ow": self.w, "oh": self.h,
                "audio": bool(self.bands), "audioSrc": self.audio_src, "out": str(self.out), "alpha": self.alpha}

    def _read(self, i):
        if i != self.pos + 1:
            self.cap.set(cv2.CAP_PROP_POS_FRAMES, i)
        ok, f = self.cap.read()
        self.pos = i
        return f if ok else None

    def _hands(self, rgb, i):
        hs = rgb if rgb.shape[1] <= 1280 else cv2.resize(rgb, (1280, int(1280 * self.h / self.w)), interpolation=cv2.INTER_AREA)
        ts = max(self.last_ts + 1, int(i * 1000 / self.fps))
        self.last_ts = ts
        t = time.perf_counter()
        out = []
        try:
            res = self.det.detect_for_video(self.mp.Image(image_format=self.mp.ImageFormat.SRGB, data=np.ascontiguousarray(hs)), ts)
            for k, lm in enumerate(res.hand_landmarks):
                side = res.handedness[k][0].category_name if res.handedness else "?"
                out.append({"side": side, "p": [[round(p.x, 4), round(p.y, 4), round(p.z, 4)] for p in lm]})
        except Exception as e:
            print("[bake hands]", e, flush=True)
        self.hand_ms = (time.perf_counter() - t) * 1000
        return out

    def _make(self, i):
        """decode -> (hands on CPU || DAViD on GPU) -> packet"""
        t0 = time.perf_counter()
        f = self._read(i)
        if f is None:
            return None
        if f.shape[1] != self.w or f.shape[0] != self.h:
            f = cv2.resize(f, (self.w, self.h), interpolation=cv2.INTER_AREA)
        rgb = cv2.cvtColor(f, cv2.COLOR_BGR2RGB)
        hf = self.pool.submit(self._hands, rgb, i)
        with self.david.lock:
            aux, aw, ah = self.david(f, self.pipe.args.aux_width)
        hands = hf.result()
        self.make_ms = (time.perf_counter() - t0) * 1000
        el = max(1e-3, time.time() - self.t0)
        head = json.dumps({
            "id": i, "raw": 1, "w": self.w, "h": self.h, "aw": aw, "ah": ah, "jpg": rgb.nbytes, "hands": hands,
            "audio": self.bands[i] if self.bands and i < len(self.bands) else None,
            "stats": {"fps": round(self.written / el, 1), "cam": self.fps, "gain": 1, "model_ms": round(self.david.ms, 1),
                      "gpus": 1, "hand_ms": round(self.hand_ms, 1), "make_ms": round(getattr(self, "make_ms", 0), 1), "graph": self.david.graph},
        }).encode()
        return struct.pack("<I", len(head)) + head + rgb.tobytes() + aux.tobytes()

    def _produce(self):
        """read-ahead: keep a few finished frames queued so the GPU never waits on the browser"""
        i = self.first
        while not self.closed:
            with self.cv:
                while not self.closed and len(self.q) >= 4 and self.seek is None:
                    self.cv.wait(0.5)
                if self.closed:
                    return
                if self.seek is not None:
                    i, self.seek = self.seek, None
                    self.q.clear()
            if i >= self.end:
                with self.cv:
                    self.q[i] = None
                    self.cv.notify_all()
                    while not self.closed and self.seek is None:
                        self.cv.wait(0.5)
                continue
            try:
                pk = self._make(i)
            except Exception as e:
                print("[bake] frame", i, e, flush=True)
                pk = None
            with self.cv:
                if self.seek is None:
                    self.q[i] = pk
                    self.cv.notify_all()
            i += 1

    def frame(self, i):
        with self.cv:
            if self.thread is None:
                self.thread = threading.Thread(target=self._produce, daemon=True)
                self.thread.start()
            if i not in self.q and i != self.expect:
                self.seek = i  # out of order request: restart the read-ahead there
                self.cv.notify_all()
            while i not in self.q and not self.closed:
                self.cv.wait(0.5)
            pk = self.q.pop(i, None)
            for k in [k for k in self.q if k < i]:
                del self.q[k]
            self.expect = i + 1
            self.cv.notify_all()
            return pk

    def put(self, data):
        if self.ff is None:
            cmd = [FFMPEG, "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{self.w}x{self.h}",
                   "-framerate", str(self.fps), "-i", "-"]
            if self.audio_src:
                ss = self.start / self.fps
                cmd += ["-ss", f"{ss:.3f}", "-t", f"{(self.end - self.start) / self.fps:.3f}", "-i", self.audio_src,
                        "-map", "0:v", "-map", "1:a:0?", "-c:a", "aac", "-b:a", "320k"]
            if self.alpha == "webm":   # transparent, small: VP9 with an alpha plane (Resolve, CapCut, browsers, OBS)
                if self.audio_src:
                    cmd[cmd.index("aac")] = "libopus"; cmd[cmd.index("320k")] = "192k"
                cmd += ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-crf", str(self.crf + 12), "-b:v", "0",
                        "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", "-auto-alt-ref", "0", "-threads", "8",
                        "-metadata:s:v:0", "alpha_mode=1", str(self.out)]
            elif self.alpha == "mov":  # transparent, editor-native: ProRes 4444 (Premiere, Final Cut, After Effects) - big files
                cmd += ["-c:v", "prores_ks", "-profile:v", "4444", "-pix_fmt", "yuva444p10le", "-vendor", "apl0",
                        "-qscale:v", str({15: 6, 18: 9, 22: 13}.get(self.crf, 9)), str(self.out)]
            else:
                if encoder() == "nvenc":   # GPU encoder: leaves the CPU to the hand tracker
                    cmd += ["-c:v", "h264_nvenc", "-preset", "p6", "-tune", "hq", "-rc", "vbr", "-cq", str(self.crf),
                            "-b:v", "0", "-profile:v", "high", "-spatial-aq", "1", "-bf", "3"]
                else:
                    cmd += ["-c:v", "libx264", "-preset", "medium", "-crf", str(self.crf), "-threads", "6"]
                cmd += ["-pix_fmt", "yuv420p", "-movflags", "+faststart", str(self.out)]
            self.log = open(str(self.out) + ".log", "wb")
            self.ff = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=self.log)
        need = self.w * self.h * 4
        if len(data) != need:
            raise RuntimeError(f"frame is {len(data)} bytes, expected {need} ({self.w}x{self.h} RGBA)")
        self.ff.stdin.write(data)
        self.written += 1

    def close(self, cancel=False):
        if self.closed:
            return {"ok": True}
        self.closed = True
        with self.cv:
            self.cv.notify_all()
        if self.thread:
            self.thread.join(5)
        self.pool.shutdown(wait=True)
        self.cap.release()
        try:
            self.det.close()
        except Exception:
            pass
        if self.ff is None:
            return {"ok": False, "err": "no frames were rendered"}
        self.ff.stdin.close()
        rc = self.ff.wait()
        self.log.close()
        log = Path(str(self.out) + ".log")
        err = log.read_text(errors="replace").strip() if log.exists() else ""
        if cancel:
            self.out.unlink(missing_ok=True)
            log.unlink(missing_ok=True)
            return {"ok": True, "cancelled": True}
        if rc == 0 and not err:
            log.unlink(missing_ok=True)
        return {"ok": rc == 0, "out": str(self.out), "frames": self.written, "secs": round(time.time() - self.t0, 1),
                "err": err[-600:] if rc else ""}
