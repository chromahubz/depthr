# DEPTHR â€” live DAViD FX with your hands

Webcam â†’ Microsoft **DAViD** multi-task model (surface normals + relative depth + soft matte, one pass)
â†’ a multi-pass WebGL2 FX engine that lights, re-materials and re-worlds the 2D frame as if it were 3D,
driven by MediaPipe hand landmarks, gestures and music.

## Setup
Needs Windows (Linux works with `python app.py`), an NVIDIA GPU with ~4 GB VRAM (RTX 20xx or newer), Python 3.10â€“3.12, a webcam,
and [ffmpeg](https://ffmpeg.org/download.html) on PATH for MP4 renders.

```
git clone <this repo> depthr && cd depthr
python -m venv .venv
.venv\Scripts\pip install torch --index-url https://download.pytorch.org/whl/cu128
.venv\Scripts\pip install -r requirements.txt
```

Models (not in the repo, ~1.3 GB) go in `data\models\`:
- `multi-task-model-vitl16_384.onnx` from [microsoft/DAViD](https://github.com/microsoft/DAViD) (see its model download links; check its licence)
- `hand_landmarker.task` from [MediaPipe](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task)

Clips, renders and snapshots are stored in `data\` too. Set `DEPTHR_HOME` to put all of it on another drive.

## Run
Double-click **Start Depthr.bat** (opens http://localhost:8790 after the ~30 s model load), or:

```
.\run.ps1                                  # auto-picks a real webcam (skips idle virtual cams)
.\run.ps1 --source 0                       # a specific webcam index
.\run.ps1 --source myclip.mp4              # loop a video instead
.\run.ps1 --device cuda:0,cuda:1           # alternate frames over both GPUs (only helps if GPU 1 is idle)
```
Only one app can hold the webcam â€” close Chrome tabs using it, OBS, CapCut first.

## Film first, FX later (render a clip to MP4)
Panel â†’ **Film â†’ FX**: load a video (or drop it on the picture). It loops so you can audition presets/effects
live, then **Render to MP4** processes *every* frame offline â€” nothing dropped, whatever the FX cost:

- the server decodes each frame, runs DAViD (GPU) and the hand tracker (CPU) in parallel with read-ahead,
  and sends exact RGB pixels; the browser renders at virtual time `i/fps` (trails, particles, auto-cycle and
  gestures are frame-accurate) and posts the pixels back; ffmpeg encodes H.264 (NVENC if present, else x264)
- the clip's own sound is muxed back in, or pick **a song instead** (music-video mode: film silently, beats
  come from the song). Audio-reactive FX get per-frame bands computed from the soundtrack, matching the live analyser
- start/end seconds, output width (1280 / 1920 / source) and quality (best/high/small); a 0.75 s pre-roll
  lets trails and the clean plate settle before the first written frame
- FX auto-cycle can also switch **every 4/8/16 kicks**
- **Only me â€” no background** (`K`): room and worlds vanish, you plus anything glowing around you (aura, wings,
  particles, point clouds) stay, shown over a checkerboard. Renders then export **with transparency**:
  WebM VP9 alpha (small; Resolve, CapCut, OBS, browsers) or MOV ProRes 4444 (Premiere, Final Cut, After Effects; big)

Clips go to `data\clips`, renders to `data\renders` (ðŸ“ opens it). Speed on the 3060 Ti:
~15 fps at 720p, ~11 fps at 1080p (a 1-minute clip â‰ˆ 2â€“3 minutes).

## 35 presets (all mixable from the panel)
| | |
|---|---|
| **Light** | Finger Spots (the demo) Â· Golden Hour (hand = sun) Â· Shadow Play (hand = side light, long shadows) Â· Focus Pull (DOF follows finger) |
| **Materials** | Liquid Chrome Â· Gold Idol Â· Glass Ghost Â· Predator Cloak Â· Anime Ink Â· Clay Render Â· Thermal |
| **Depth** | Laser Scanner Â· Topo Map Â· Body Scan Â· Hologram (point cloud, orbit with your hand) |
| **3D clouds** | Ridgelines Â· Voxel Statue Â· Particle Storm (hand + kicks blow you apart) Â· Sand Sculpture (crumbles, reforms) Â· Digital Rain Â· LiDAR Sweep Â· Star Body Â· Depth Slices Â· Hologram Trio â€” all orbit with your hand like Hologram |
| **Matte** | Neon Aura Â· Ghost Trails Â· Starfield Â· Desert Night Â· Crystal Cave Â· Synthwave |
| **Magic** | Palm Lantern (open hand = orb, pinch dims) Â· Lightning Mage (thumbâ†”index and handâ†”hand arcs) Â· Spellcaster (point to draw glowing trails in 3D) Â· Light Painter (pinch, carry, release to place lights) |
| **Music** | Music Video â€” load a song or use the mic: kicks flash lights, restart the laser, fire shockwaves; bass swells aura/rim |

## FX Library â€” 174 effects on top of any preset
Each effect is a self-contained shader in `web/fx_*.js` that sees the camera, the relit scene, DAViD normals /
depth / matte, the clean background plate, both hands (42 landmarks), a body anchor (centroid + head), audio
(bass/mid/high/kick/beat count) and its **own feedback buffer** (MRT `keep()` state â†’ trails, freezing, melting,
particles, slit-scan, time bubblesâ€¦). Every effect has two named knobs (A/B) + Mix, can feed off the camera or
the preset's relit scene, and luminance looks auto-normalise exposure.

| category | count | examples |
|---|---|---|
| Light | 20 | Prism Skin, Disco Ball, Police, Pool Caustics, Church Window, Thunderstorm, Cyberpunk, Studio Portrait, Blacklight |
| Material | 22 | Marble, Kintsugi, Lava Skin, Frozen, Voxels, Circuit, Soap Film, Galaxy Body, Burning Man, Sumi-e, Mirror Ball |
| Depth | 27 | CT Scan, 3D Wiggle, Anaglyph, God Rays, Vertigo Dolly, Pin Art, LiDAR, Hypsometric Map, Snowfall, Fireflies, Bokeh |
| Matte | 30 | Clone Army, Kaleidoscope, Warhol, Shadow Puppet, Disintegrate, Teleporter, Saint Halo, Energy Wings, Slit Scan, Time Warp, Aurora |
| Hands | 22 | Force Field, Black Hole, Finger Lasers, Ribbons, Fire Hands, Frost Touch, Light Graffiti, Energy Ball, Hand X-Ray, Time Bubble |
| Audio | 10 | EQ Body, Bass Punch, Beat Strobe, Speaker Cone, Spectrum Crown, Oscilloscope, Stage Beams, Confetti |
| Stylize | 24 | Oil Paint, Pencil, Watercolor, Engraving, ASCII, CRT, VHS, Game Boy, CMYK, Blueprint, PICO-8, Mondrian, Predator |
| Art | 9 | De Stijl, Mondrian Portrait, Boogie Woogie, Bauhaus, Suprematism, Op Art, Kandinsky Rings, Matisse Cutouts, Rothko Fields |
| Spy Titles | 10 | Barrel Sight, Silhouette Titles, Molten Gold, Silhouette Echoes, Smoke & Neon, Laser Heist, Sniper Scope, High Stakes, Diamond Dust, Split Screen 60s |

The library also has a **Presets** category holding the 35 presets above, so search, shuffle and auto-cycle can switch
the base look too (an effect picked after a preset stacks on top of it).
Browse by category or search; `[` `]` step, `X` shuffle, `0` off, auto-cycle every 4/8/16 s, âœŒ steps effects while one is on.
Add your own: `fx("Cat", "id", "Name", "knob A", "knob B", \`vec3 fx(vec2 t){ ... }\`)` in any `fx_*.js`.

Gestures: **âœŒ peace** = next preset Â· **âœŠ hold** = blackout Â· **âœŠâ†’ðŸ– burst** = shockwave.
Under View, **Hand tracking** (`T`) turns hands off completely and **✌ switches looks** (`G`) stops the peace sign changing
presets/effects; both are remembered and presets never override them.
Keys: `â†` `â†’` presets, `1`â€“`6` views, `M` mirror, `R` record webm (with song audio), `S` snapshot,
`C` clear spells/placed lights, `B` shockwave, `H` hide panel, `F` fullscreen.

## How it works
| piece | file |
|---|---|
| ONNX â†’ PyTorch runner: folds shape math, fuses the 24 attention blocks into SDPA, fp16, CUDA graph | `onnx_torch.py` |
| DAViD pre/post-processing on GPU (same as microsoft/DAViD `runtime/utils.py`), packs normals+matte+16-bit depth | `engine.py` |
| camera/video source (+ dim-room auto gain), MediaPipe hands thread, per-GPU workers, HTTP long-poll server | `app.py` |
| scene uber-shader (8 materials, 16 spot/omni lights + sun with screen-space shadows, 5 worlds, lasers, fog, spells, orbs), clean-plate, ghost feedback, bloom, post (DOF, aura, shockwaves, chroma), hologram points | `web/shaders.js` |
| panel/presets, hand tracking + gesture classifier, lightning, painter, spells, audio analysis, recording | `web/app.js` |

Output matches onnxruntime to ~1e-4 mean error (`python test_model.py frame.png --ort`).
Speed on the 3060 Ti: ~45 ms model, ~20 fps AI; the FX pipeline costs ~2â€“5 ms/frame and redraws at display rate.

Models live in `data\models` (or `DEPTHR_MODELS`). `onnxruntime` is only needed for the `--ort` check.
