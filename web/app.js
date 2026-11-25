// DEPTHR FX engine: camera JPEG + packed DAViD aux (normals/matte/depth) + hand landmarks from the
// server -> multi-pass WebGL2 (scene uber-shader, clean plate, ghost feedback, bloom, post) or a
// hologram point cloud. Hands drive spotlights, lanterns, lightning, painted lights, spells, gestures.
"use strict";
const $ = (s) => document.querySelector(s);
const cv = $("#gl"), ov = $("#ov"), octx = ov.getContext("2d");
const gl = cv.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
const HALF_FLOAT_OK = !!gl.getExtension("EXT_color_buffer_float");
gl.getExtension("OES_texture_float_linear");

// =============================================================== params, panel, presets
const COLOR = "color", RANGE = "range", CHECK = "check", SELECT = "select";
const SCHEMA = [
  ["Material", [
    ["mat", SELECT, "Material", { photo: "Photo relight", chrome: "Liquid chrome", gold: "Gold idol", glass: "Glass", clay: "Clay render", toon: "Anime ink", cloak: "Predator cloak", thermal: "Thermal / infrared" }],
    ["tint", COLOR, "Tint"], ["amb", RANGE, "Room light", 0, 1.5, .01], ["alb", RANGE, "Albedo", 0, 1, .01],
    ["spec", RANGE, "Specular", 0, 3, .01], ["gloss", RANGE, "Gloss", 2, 128, 1], ["wrap", RANGE, "Wrap", 0, 1, .01],
    ["rim", RANGE, "Rim", 0, 2, .01], ["bands", RANGE, "Toon bands", 2, 8, 1], ["ink", RANGE, "Ink lines", 0, 2, .01]]],
  ["Finger spotlights", [
    ["spots", CHECK, "Finger spotlights"], ["fingers", SELECT, "Fingers", { index: "Index", pinch: "Index + thumb", all: "All five" }],
    ["palette", SELECT, "Colour", { red: "Red (demo)", split: "Warm L / cool R", rainbow: "Rainbow", white: "White", custom: "Custom" }],
    ["custom", COLOR, "Custom"], ["intensity", RANGE, "Intensity", 0, 8, .05], ["cone", RANGE, "Cone°", 5, 120, 1],
    ["soft", RANGE, "Softness", .02, 1, .01], ["range", RANGE, "Range", .1, 2.5, .01], ["lift", RANGE, "Lift", 0, .6, .005],
    ["aim", RANGE, "Aim in", -1, 1, .01], ["smooth", RANGE, "Smoothing", 0, .95, .01], ["mouse", CHECK, "Mouse flashlight (drag)"]]],
  ["Magic lights", [
    ["lantern", CHECK, "Palm lantern (open hand)"], ["lanternCol", COLOR, "Lantern colour"], ["lanternInt", RANGE, "Lantern power", 0, 8, .05],
    ["lightning", CHECK, "Lightning (thumb↔index, hand↔hand)"], ["boltCol", COLOR, "Bolt colour"], ["boltInt", RANGE, "Bolt power", 0, 8, .05],
    ["painter", CHECK, "Light painter (pinch · carry · release)"], ["spells", CHECK, "Spells (point & draw)"], ["spellLife", RANGE, "Spell life (s)", 1, 20, .5]]],
  ["Sun & shadows", [
    ["sun", CHECK, "Sun / golden hour"], ["sunHand", CHECK, "Hand steers the sun"], ["sunCol", COLOR, "Sun colour"],
    ["sunInt", RANGE, "Sun power", 0, 4, .01], ["skyCol", COLOR, "Sky fill"], ["skyAmt", RANGE, "Sky amount", 0, 1.5, .01],
    ["shadow", RANGE, "Shadows", 0, 1, .01], ["longShadow", CHECK, "Long shadows on the wall"], ["bg", RANGE, "Background lit", 0, 1, .01],
    ["depth", RANGE, "Depth amount", 0, 1.5, .01]]],
  ["Depth FX", [
    ["scan", SELECT, "Laser", { off: "Off", depth: "Depth sweep", vertical: "Vertical scanner", contour: "Topo contours" }],
    ["scanCol", COLOR, "Laser colour"], ["scanSpeed", RANGE, "Laser speed", 0, 2, .01], ["scanW", RANGE, "Laser width", .005, .15, .001],
    ["contours", RANGE, "Contours", 4, 80, 1], ["fog", RANGE, "Depth fog", 0, 1, .01], ["fogCol", COLOR, "Fog colour"],
    ["dof", RANGE, "Depth of field", 0, 1, .01], ["holo", CHECK, "3D point cloud (orbit with your hand)"],
    ["holoStyle", SELECT, "Cloud style", { holo: "Hologram", ridge: "Ridgelines", voxel: "Voxel statue", storm: "Particle storm", sand: "Sand sculpture",
      rain: "Digital rain", lidar: "LiDAR sweep", stars: "Star body", slices: "Depth slices", trio: "Hologram trio" }], ["holoBg", CHECK, "Cloud keeps room"],
    ["holoTint", RANGE, "Holo tint", 0, 1, .01], ["holoSpin", RANGE, "Holo auto-orbit", 0, 1, .01], ["holoDepth", RANGE, "Holo depth", 0, 2, .01]]],
  ["Matte FX", [
    ["world", SELECT, "World", { off: "Real room", stars: "Starfield", desert: "Desert night", crystal: "Crystal cave", synth: "Synthwave", void: "Void" }],
    ["ghost", RANGE, "Ghost trails", 0, 1.5, .01], ["ghostDecay", RANGE, "Trail length", .8, .99, .001], ["ghostCol", COLOR, "Ghost tint"],
    ["aura", RANGE, "Aura", 0, 2, .01], ["auraCol", COLOR, "Aura colour"], ["auraCycle", CHECK, "Aura colour cycle"]]],
  ["Post", [
    ["bloom", RANGE, "Bloom", 0, 2, .01], ["chroma", RANGE, "Chroma split", 0, 1, .01], ["vig", RANGE, "Vignette", 0, 1, .01], ["grain", RANGE, "Grain", 0, 1, .01]]],
  ["Gestures & audio", [
    ["gestures", CHECK, "Gestures (peace next · fist blackout · fist→open burst)"], ["beatWaves", CHECK, "Shockwave on every kick"], ["audioAmt", RANGE, "Audio reactivity", 0, 3, .01]]],
];
const D = {
  mat: "photo", tint: "#ffffff", amb: .1, alb: .6, spec: .7, gloss: 24, wrap: .15, rim: 0, bands: 3, ink: 1,
  spots: true, fingers: "index", palette: "red", custom: "#ff2030", intensity: 3.2, cone: 70, soft: .6, range: .9, lift: .2, aim: .15, smooth: .55, mouse: false,
  lantern: false, lanternCol: "#ffa84a", lanternInt: 3.5, lightning: false, boltCol: "#86b8ff", boltInt: 2.2, painter: false, spells: false, spellLife: 6,
  sun: false, sunHand: true, sunCol: "#ffb066", sunInt: 1.6, skyCol: "#4a63c8", skyAmt: .35, shadow: .6, longShadow: false, bg: .35, depth: .45,
  scan: "off", scanCol: "#00ffd0", scanSpeed: .35, scanW: .03, contours: 24, fog: 0, fogCol: "#140a26", dof: 0,
  holo: false, holoStyle: "holo", holoBg: false, holoTint: .75, holoSpin: .35, holoDepth: 1,
  world: "off", ghost: 0, ghostDecay: .93, ghostCol: "#8fb8ff", aura: 0, auraCol: "#ff2bd6", auraCycle: false,
  bloom: .35, chroma: 0, vig: .25, grain: 0, gestures: false, beatWaves: false, audioAmt: 1,
};
const PRESETS = [
  ["Finger Spots", "the demo", {}],
  ["Liquid Chrome", "T-1000 skin", { mat: "chrome", palette: "white", intensity: 4, amb: .55, bloom: .7, spec: 1.2 }],
  ["Gold Idol", "molten statue", { mat: "gold", world: "void", amb: .6, sun: true, sunHand: true, sunInt: 1.2, palette: "white", aura: .5, auraCol: "#ffb020", bloom: .8 }],
  ["Glass Ghost", "see-through body", { mat: "glass", tint: "#cfe8ff", amb: .5, palette: "white", intensity: 3, bloom: .6 }],
  ["Predator Cloak", "invisible shimmer", { mat: "cloak", spots: false, chroma: .25, amb: 1 }],
  ["Anime Ink", "cel shaded", { mat: "toon", amb: .55, sun: true, sunInt: 1.1, palette: "white", intensity: 2.2, bands: 3, ink: 1.1, bloom: .3 }],
  ["Golden Hour", "hand = sun", { sun: true, sunHand: true, spots: false, amb: .05, skyAmt: .45, longShadow: true, shadow: .85, bg: .8, wrap: .25, bloom: .55 }],
  ["Clay Render", "pure 3D form", { mat: "clay", tint: "#b07a5e", amb: .32, sun: true, sunInt: .8, palette: "white", intensity: 1.6, bloom: .2 }],
  ["Thermal", "infrared dancer", { mat: "thermal", spots: false, amb: .25, bloom: .9, aura: .3, auraCol: "#ff6a00", grain: .3 }],
  ["Laser Scanner", "depth sweep", { scan: "depth", spots: false, amb: .04, fog: .45, bloom: .9, scanCol: "#00ffd0" }],
  ["Topo Map", "contour lines", { scan: "contour", mat: "clay", tint: "#26302e", amb: .3, scanCol: "#4dff7a", contours: 28, spots: false, bloom: .7 }],
  ["Body Scan", "vertical scanner", { scan: "vertical", scanCol: "#ff2050", scanW: .04, amb: .08, spots: false, bloom: .9, chroma: .2, world: "void" }],
  ["Hologram", "orbit with your hand", { holo: true, bloom: 1.1, chroma: .25, grain: .25, spots: false }],
  ["Ridgelines", "you as a mountain range", { holo: true, holoStyle: "ridge", holoTint: .85, holoDepth: 1.2, bloom: .9, spots: false, vig: .5 }],
  ["Voxel Statue", "blocky 3D you", { holo: true, holoStyle: "voxel", holoSpin: .5, bloom: .3, spots: false }],
  ["Particle Storm", "hand + kicks blow you apart", { holo: true, holoStyle: "storm", holoSpin: .2, bloom: 1.2, spots: false, chroma: .15 }],
  ["Sand Sculpture", "crumbles and reforms", { holo: true, holoStyle: "sand", holoSpin: .25, bloom: .6, spots: false, grain: .15 }],
  ["Digital Rain", "code-rain body", { holo: true, holoStyle: "rain", bloom: 1.1, spots: false, vig: .45 }],
  ["LiDAR Sweep", "scanned in 3D", { holo: true, holoStyle: "lidar", holoDepth: 1.3, bloom: .8, spots: false }],
  ["Star Body", "you as a galaxy", { holo: true, holoStyle: "stars", holoSpin: .45, bloom: 1.4, spots: false }],
  ["Depth Slices", "stacked glass layers", { holo: true, holoStyle: "slices", holoSpin: .6, holoDepth: 1.1, bloom: .7, spots: false }],
  ["Hologram Trio", "three of you, turned", { holo: true, holoStyle: "trio", holoSpin: .3, bloom: 1, chroma: .2, grain: .2, spots: false }],
  ["Shadow Play", "hand = side light", { sun: true, sunHand: true, sunCol: "#fff4e6", sunInt: 1.5, skyAmt: .04, spots: false, longShadow: true, shadow: 1, amb: .03, bg: 1, wrap: 0, bloom: .2, depth: .7 }],
  ["Focus Pull", "focus follows finger", { dof: .85, palette: "white", intensity: 2.2, amb: .45 }],
  ["Neon Aura", "glowing outline", { aura: 1.3, auraCycle: true, world: "void", amb: .25, rim: 1, bloom: .9, spots: false }],
  ["Ghost Trails", "time smear", { ghost: 1, ghostDecay: .95, amb: .2, bloom: .6, spots: false, world: "void" }],
  ["Starfield", "float in space", { world: "stars", palette: "rainbow", fingers: "all", intensity: 2.6, amb: .3, rim: .8, bloom: .8 }],
  ["Desert Night", "moonlit dunes", { world: "desert", sun: true, sunHand: false, sunCol: "#ff9a55", sunInt: 1.1, skyCol: "#3a3a9a", amb: .15, spots: false, longShadow: true }],
  ["Crystal Cave", "lantern in a geode", { world: "crystal", lantern: true, spots: false, amb: .35, bloom: .8, rim: .9 }],
  ["Synthwave", "outrun grid", { world: "synth", aura: .7, auraCol: "#ff2bd6", scan: "vertical", scanCol: "#ff3df0", palette: "split", amb: .2, bloom: 1, chroma: .2 }],
  ["Palm Lantern", "fire in your hand", { lantern: true, spots: false, amb: .03, bloom: 1, shadow: .8 }],
  ["Lightning Mage", "arcs between fingers", { lightning: true, spots: false, amb: .08, bloom: .8, chroma: .25 }],
  ["Spellcaster", "point & draw in 3D", { spells: true, palette: "white", intensity: 1.5, amb: .1, bloom: 1.1 }],
  ["Light Painter", "pinch to place lights", { painter: true, spots: false, amb: .04, bloom: .9 }],
  ["Music Video", "drop a song in", { palette: "rainbow", fingers: "all", scan: "depth", aura: .8, auraCycle: true, beatWaves: true, chroma: .3, bloom: 1, amb: .15, audioAmt: 1.4, world: "synth" }],
];
const S = { ...D };
let presetIdx = 0;

const ctrls = {};
const SEC_ICON = { "Material": "layers", "Finger spotlights": "hand", "Magic lights": "sparkle", "Sun & shadows": "compass", "Depth FX": "layers", "Matte FX": "eye", "Post": "sliders", "Gestures & audio": "hand" };
function buildPanel() {
  const host = $("#sections");
  for (const [title, items] of SCHEMA) {
    const det = document.createElement("details");
    det.innerHTML = `<summary>${ic(SEC_ICON[title] || "sliders")}${title}</summary>`;
    for (const [key, type, label, a, b, step] of items) {
      let el, wrap;
      if (type === RANGE) {
        const dec = step < 1 ? (step < .01 ? 3 : 2) : 0;
        wrap = document.createElement("label"); wrap.className = "s";
        wrap.innerHTML = `${label}<input type="range" min="${a}" max="${b}" step="${step}"><span></span>`;
        el = wrap.querySelector("input"); const out = wrap.querySelector("span");
        el.oninput = () => { S[key] = +el.value; out.textContent = (+el.value).toFixed(dec); };
        ctrls[key] = (v) => { el.value = v; out.textContent = (+v).toFixed(dec); };
      } else if (type === CHECK) {
        wrap = document.createElement("label"); wrap.className = "c";
        wrap.innerHTML = `<input type="checkbox"> ${label}`;
        el = wrap.querySelector("input"); el.onchange = () => { S[key] = el.checked; onParam(key); };
        ctrls[key] = (v) => { el.checked = !!v; };
      } else if (type === SELECT) {
        wrap = document.createElement("label"); wrap.className = "k";
        wrap.innerHTML = `${label}<select>${Object.entries(a).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select>`;
        el = wrap.querySelector("select"); el.onchange = () => { S[key] = el.value; onParam(key); };
        ctrls[key] = (v) => { el.value = v; };
      } else {
        wrap = document.createElement("label"); wrap.className = "k";
        wrap.innerHTML = `${label}<input type="color">`;
        el = wrap.querySelector("input"); el.oninput = () => { S[key] = el.value; };
        ctrls[key] = (v) => { el.value = v; };
      }
      det.appendChild(wrap);
    }
    host.appendChild(det);
  }
  const pg = $("#presets");
  PRESETS.forEach(([name, sub], i) => {
    const b = document.createElement("button");
    b.innerHTML = `${name}<small>${sub}</small>`; b.onclick = () => applyPreset(i);
    pg.appendChild(b);
  });
}
function syncPanel() { for (const k in ctrls) ctrls[k](S[k]); paintRanges(); }
// sliders draw their filled part from --p; programmatic value changes call paintRanges()
function paintRange(el) { const lo = +el.min || 0, hi = el.max === "" ? 100 : +el.max; el.style.setProperty("--p", ((+el.value - lo) / ((hi - lo) || 1) * 100) + "%"); }
function paintRanges() { document.querySelectorAll('input[type=range]').forEach(paintRange); }
document.addEventListener("input", (e) => { if (e.target.type === "range") paintRange(e.target); });
// gestures are a user lock like hand tracking: off by default, kept across presets and reloads
let userGestures = localStorage.getItem("depthr.gestures") === "1";
function onParam(k) { if (k === "holo" || k === "world") ghostClear = true;
  if (k === "gestures") { userGestures = S.gestures; localStorage.setItem("depthr.gestures", userGestures ? "1" : "0"); } }
function applyPreset(i, announce) {
  presetIdx = (i + PRESETS.length) % PRESETS.length;
  Object.assign(S, D, PRESETS[presetIdx][2]);
  S.gestures = userGestures;
  syncPanel();
  document.querySelectorAll("#presets button").forEach((b, j) => b.classList.toggle("on", j === presetIdx));
  ghostClear = true;
  if (announce) toast(PRESETS[presetIdx][0]);
}
let toastT = 0;
function toast(txt) { const t = $("#toast"); t.textContent = txt; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 1400); }

let view = 0;
document.querySelectorAll("button[data-v]").forEach((b) => b.onclick = () => {
  document.querySelectorAll("button[data-v]").forEach((x) => x.classList.toggle("on", x === b)); view = +b.dataset.v; layout();
});
const chk = (id) => $("#" + id).checked;

// =============================================================== GL plumbing
function compile(vs, fs) {
  const mk = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error(log); throw new Error(log); } return s; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  p.u = {}; return p;
}
const P = {
  scene: compile(SH_VS, SH_SCENE), post: compile(SH_VS, SH_POST), plate: compile(SH_VS, SH_PLATE),
  ghost: compile(SH_VS, SH_GHOST), bright: compile(SH_VS, SH_BRIGHT), blur: compile(SH_VS, SH_BLUR),
  holo: compile(SH_HOLO_VS, SH_HOLO_FS),
};
let cur = null;
function use(p) { gl.useProgram(p); cur = p; }
function L(n) { let l = cur.u[n]; if (l === undefined) { l = gl.getUniformLocation(cur, n); cur.u[n] = l; } return l; }
const f1 = (n, v) => gl.uniform1f(L(n), v), i1 = (n, v) => gl.uniform1i(L(n), v);
const f2 = (n, a, b) => gl.uniform2f(L(n), a, b), f3 = (n, a) => gl.uniform3fv(L(n), a), f4v = (n, a) => gl.uniform4fv(L(n), a);

const quadVao = gl.createVertexArray(); gl.bindVertexArray(quadVao);
const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const emptyVao = gl.createVertexArray();

function mkTex(filter = gl.LINEAR) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}
const texCam = mkTex(), texAux = mkTex(), texSpell = mkTex(gl.NEAREST);
function mkFbo(w, h, hdr) {
  const tex = mkTex();
  if (hdr && HALF_FLOAT_OK) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h };
}
let F = null, fboW = 0, fboH = 0, ghostClear = true, plateInit = true, fxClear = true;
function ensureFbos(w, h) {
  if (F && fboW === w && fboH === h) return;
  fboW = w; fboH = h;
  const qw = Math.max(8, w >> 2), qh = Math.max(8, h >> 2);
  F = { scene: mkFbo(w, h, true), plate: [mkFbo(w, h, false), mkFbo(w, h, false)], ghost: [mkFbo(w, h, true), mkFbo(w, h, true)],
    bA: mkFbo(qw, qh, true), bB: mkFbo(qw, qh, true), pi: 0, gi: 0 };
  F.fxOut = mkFbo(w, h, true); F.fxSt = [mkFbo(w, h, true), mkFbo(w, h, true)]; F.si = 0;
  F.fxFb = [0, 1].map((k) => { const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, F.fxOut.tex, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, F.fxSt[k].tex, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return fb; });
  plateInit = true; ghostClear = true; fxClear = true;
}
function bindTex(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
function target(f) { gl.bindFramebuffer(gl.FRAMEBUFFER, f ? f.fb : null); gl.viewport(0, 0, f ? f.w : cv.width, f ? f.h : cv.height); }
function quad() { gl.bindVertexArray(quadVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
function commonU() {
  i1("uCam", 0); i1("uAux", 1);
  f2("uAuxSize", frame.aw, frame.ah); f1("uAspect", frame.w / frame.h); f1("uTime", (now / 1000) % 3600);
  gl.uniform3f(L("uFlip"), chk("fx") ? -1 : 1, chk("fy") ? -1 : 1, chk("fz") ? -1 : 1);
  f1("uCut", chk("cut") ? 1 : 0);
}

// =============================================================== frames from the server
let frame = null, lastId = 0, recvFps = 0, recvN = 0, recvT = performance.now(), now = performance.now();
async function ingest(ab) {
  const hl = new DataView(ab).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(ab, 4, hl)));
  const off = 4 + hl, aux = new Uint8Array(ab, off + head.jpg);
  if (head.raw) {   // bake frames: exact RGB pixels, no JPEG loss
    bindTex(0, texCam); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB8, head.w, head.h, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(ab, off, head.jpg));
  } else {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(ab, off, head.jpg)], { type: "image/jpeg" }));
    bindTex(0, texCam); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp); bmp.close();
  }
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.generateMipmap(gl.TEXTURE_2D);
  bindTex(1, texAux); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, head.aw, head.ah * 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, aux);
  const first = !frame || frame.w !== head.w || frame.h !== head.h;
  frame = { ...head, aux };
  bodyTarget = bodyAnchor(frame);
  if (first) { $("#wait").style.display = "none"; layout(); }
  AU.ext = head.audio || null;
  onHands(head.hands);
  return head;
}
async function pull() {
  for (;;) {
    if (BK.on) { await new Promise((z) => setTimeout(z, 100)); continue; }
    try {
      const r = await fetch("/frame?after=" + lastId, { cache: "no-store" });
      if (r.status !== 200) { await new Promise((z) => setTimeout(z, 200)); continue; }
      const ab = await r.arrayBuffer();
      if (BK.on) continue;
      const head = await ingest(ab);
      lastId = head.id;
      recvN++; const t = performance.now(); if (t - recvT > 1000) { recvFps = recvN * 1000 / (t - recvT); recvN = 0; recvT = t; }
    } catch (e) { console.warn(e); $("#wait").style.display = "flex"; $("#wait").textContent = "server offline — retrying"; await new Promise((z) => setTimeout(z, 800)); }
  }
}
// performance profile: the server decides Regular/Advanced (GPUs, camera); the render scale lives here.
// Regular always renders at camera resolution; Advanced unlocks 0.5x-2x. Bakes always render at 1x.
const PERF = { mode: "regular", rscale: +(localStorage.getItem("depthr.rscale") || 1), fps: 0, n: 0, t: performance.now(), info: null };
const rscale = () => (PERF.mode === "advanced" && !BK.on ? PERF.rscale : 1);
function renderSize() { const s = rscale(); return [Math.max(8, Math.round(frame.w * s)), Math.max(8, Math.round(frame.h * s))]; }
function layout() {
  if (!frame) return;
  const [w, h0] = renderSize(), h = view === 4 ? h0 * 2 : h0;
  cv.width = ov.width = w; cv.height = ov.height = h;
  const st = $("#stage"), s = Math.min(st.clientWidth / w, st.clientHeight / h);
  for (const c of [cv, ov]) { c.style.width = w * s + "px"; c.style.height = h * s + "px"; }
}
addEventListener("resize", layout);

// body anchor: matte centroid (xy) and top of the head (zw), source uv
let body = [.5, .5, .5, .25], bodyTarget = body.slice();
function bodyAnchor(f) {
  const { aw, ah, aux } = f, GX = 48, GY = 27; let sx = 0, sy = 0, n = 0; const cols = new Array(GX).fill(-1);
  for (let gy = 0; gy < GY; gy++) for (let gx = 0; gx < GX; gx++) {
    const x = Math.floor((gx + .5) / GX * aw), y = Math.floor((gy + .5) / GY * ah);
    if (aux[(y * aw + x) * 4 + 3] > 128) { sx += gx; sy += gy; n++; if (cols[gx] < 0) cols[gx] = gy; }
  }
  if (n < 6) return [.5, .5, .5, .3];
  const cx = sx / n / GX, cy = sy / n / GY, ci = Math.round(cx * GX - .5);
  let top = GY;
  for (let k = -3; k <= 3; k++) { const c = cols[ci + k]; if (c >= 0 && c < top) top = c; }
  return [cx, cy, cx, Math.min(cy, (top + .5) / GY + .06)];
}

// normalised depth from the CPU copy of the aux buffer; window max so a fingertip wins over the wall behind
function depthAt(x, y, win = 2) {
  if (!frame) return .5;
  const { aw, ah, aux } = frame;
  const px = Math.min(aw - 1, Math.max(0, Math.round(x * (aw - 1)))), py = Math.min(ah - 1, Math.max(0, Math.round(y * (ah - 1))));
  let best = 0;
  for (let dy = -win; dy <= win; dy++) for (let dx = -win; dx <= win; dx++) {
    const qx = Math.min(aw - 1, Math.max(0, px + dx)), qy = Math.min(ah - 1, Math.max(0, py + dy));
    const i = ((ah + qy) * aw + qx) * 4; best = Math.max(best, (aux[i] * 256 + aux[i + 1]) / 65535);
  }
  return best;
}

// =============================================================== hands: tracking + gestures
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
const hsv = (h, s = 1, v = 1) => { const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; };
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mix3 = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
let hands = [], nextHand = 0;
function classify(p) {
  const w = p[0], palm = dist2(p[0], p[9]) || .1;
  const ext = (tip, pip) => dist2(p[tip], w) > dist2(p[pip], w) * 1.12;
  const e = [dist2(p[4], p[17]) > dist2(p[3], p[17]) * 1.08 && dist2(p[4], p[5]) > palm * .45, ext(8, 6), ext(12, 10), ext(16, 14), ext(20, 18)];
  const pinchD = dist2(p[4], p[8]) / palm;
  const n = e.filter(Boolean).length;
  let g = "other";
  if (pinchD < .32 && e[2]) g = "pinch";
  else if (!e[1] && !e[2] && !e[3] && !e[4]) g = "fist";
  else if (n >= 5 || (e[1] && e[2] && e[3] && e[4])) g = "open";
  else if (e[1] && e[2] && !e[3] && !e[4]) g = "peace";
  else if (e[1] && !e[2] && !e[3] && !e[4]) g = "point";
  return { g, open: n / 5, pinchD, palm };
}
function onHands(list) {
  if (!chk("htrack")) list = [];   // tracking off: existing hands fade out, nothing new is picked up
  const t = now, taken = new Set();
  for (const hd of list || []) {
    let best = null, bd = .25;
    for (const h of hands) { if (taken.has(h)) continue; const d = dist2(h.tgt[0], hd.p[0]); if (d < bd) { bd = d; best = h; } }
    if (!best) { best = { id: nextHand++, tgt: hd.p, p: hd.p.map((v) => v.slice()), a: 0, g: "other", gRaw: "other", gSince: t }; hands.push(best); }
    taken.add(best);
    best.tgt = hd.p; best.side = hd.side; best.seen = t;
    const c = classify(hd.p); best.open = c.open; best.pinchD = c.pinchD; best.palm = c.palm;
    if (c.g !== best.gRaw) { best.gRaw = c.g; best.gSince = t; }
    else if (t - best.gSince > 160 && best.g !== c.g) { const prev = best.g; best.g = c.g; onGesture(best, prev, c.g, t); }
  }
}
let lastPresetSwitch = 0, blackTarget = 0;
function onGesture(h, from, to, t) {
  if (S.gestures) {
    if (to === "peace" && chk("gswitch") && t - lastPresetSwitch > 1300) { lastPresetSwitch = t; if (FXS.id) fxStep(1); else applyPreset(presetIdx + 1, true); }
    if (to === "open" && from === "fist") { const c = palmCenter(h.p); shockwave(c[0], c[1], 1); }
  }
  if (S.painter) {
    if (to === "pinch") carry = { h, hue: Math.random() };
    if (from === "pinch" && carry && carry.h === h) {
      const c = pinchPoint(h.p); placed.push({ x: c[0], y: c[1], hue: carry.hue, born: now }); if (placed.length > 8) placed.shift(); carry = null;
    }
  }
  if (from === "point") spellBreak(h);
}
const palmCenter = (p) => { let x = 0, y = 0; for (const i of [0, 5, 9, 13, 17]) { x += p[i][0]; y += p[i][1]; } return [x / 5, y / 5]; };
const pinchPoint = (p) => [(p[4][0] + p[8][0]) / 2, (p[4][1] + p[8][1]) / 2];
function updateHands(dt) {
  const k = 1 - Math.pow(S.smooth * .9, dt / 16.7);
  for (const h of hands) {
    const live = now - h.seen < 160;
    h.a += ((live ? 1 : 0) - h.a) * Math.min(1, dt / 90);
    for (let i = 0; i < 21; i++) h.p[i] = mix3(h.p[i], h.tgt[i], k);
  }
  hands = hands.filter((h) => now - h.seen < 700 || h.a > .02);
  blackTarget = S.gestures && !S.painter && hands.some((h) => h.g === "fist" && h.a > .5) ? 1 : 0;
}

// =============================================================== effects state
let waves = [];
function shockwave(x, y, s = 1) { waves.push({ x, y, t0: now, s }); if (waves.length > 4) waves.shift(); }
let placed = [], carry = null;
let spell = [], spellLast = {};
function spellBreak(h) { spellLast[h.id] = null; }
function updateSpells() {
  const life = S.spellLife * 1000;
  spell = spell.filter((s) => now - s.t < life);
  if (!S.spells) return;
  for (const h of hands) {
    if (h.g !== "point" || h.a < .5) { spellLast[h.id] = null; continue; }
    const tip = h.p[8], last = spellLast[h.id];
    if (last && dist2(last, tip) < .004) continue;
    spell.push({ x: tip[0], y: tip[1], z: depthAt(tip[0], tip[1]) + .02, t: now, brk: !last });
    spellLast[h.id] = [tip[0], tip[1]];
  }
  if (spell.length > 255) spell = spell.slice(spell.length - 255);
}
const spellBuf = new Float32Array(256 * 4);
function uploadSpells() {
  const life = S.spellLife * 1000;
  spell.forEach((s, i) => { const l = Math.max(.001, 1 - (now - s.t) / life); spellBuf.set([s.x, s.y, s.z, s.brk ? -l : l], i * 4); });
  bindTex(3, texSpell); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 256, 1, 0, gl.RGBA, gl.FLOAT, spellBuf);
}
// lightning: jagged polylines regenerated ~18x a second
let bolts = [], boltT = 0;
function jag(a, b, depth, spread) {
  if (depth === 0) return [a, b];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const off = (Math.random() - .5) * len * spread;
  m[0] += -dy / len * off; m[1] += dx / len * off;
  return [...jag(a, m, depth - 1, spread).slice(0, -1), ...jag(m, b, depth - 1, spread)];
}
function updateBolts() {
  if (!S.lightning) { bolts = []; return; }
  const pairs = [];
  for (const h of hands) if (h.a > .5 && h.g !== "fist" && dist2(h.p[4], h.p[8]) > (h.palm || .1) * .55) pairs.push([h.p[4], h.p[8], 1]);
  const live = hands.filter((h) => h.a > .5 && h.g !== "fist");
  if (live.length >= 2) pairs.push([live[0].p[8], live[1].p[8], 1.4]);
  if (now - boltT > 55 || bolts.length !== pairs.length) {
    boltT = now;
    bolts = pairs.map(([a, b, w]) => {
      const main = jag(a, b, 5, .55), br = [];
      for (let k = 0; k < 2; k++) { const i = 4 + Math.floor(Math.random() * (main.length - 8)); const s = main[i];
        br.push(jag(s, [s[0] + (Math.random() - .5) * .12, s[1] + (Math.random() - .5) * .12], 3, .6)); }
      return { main, br, w, flick: .6 + Math.random() * .8 };
    });
  }
}

// =============================================================== lights for the shader
const TIPS = { index: [[8, 6]], pinch: [[8, 6], [4, 2]], all: [[4, 2], [8, 6], [12, 10], [16, 14], [20, 18]] };
const RAINBOW = [[1, .25, .2], [1, .7, .15], [.3, 1, .4], [.2, .6, 1], [.8, .3, 1]];
function spotColor(side, k) {
  const pal = S.palette;
  if (pal === "red") return [1, .08, .1];
  if (pal === "white") return [1, .95, .88];
  if (pal === "custom") return hex(S.custom);
  if (pal === "split") return side === "Left" ? [1, .45, .12] : [.15, .55, 1];
  return RAINBOW[k % 5];
}
let mouse = null;
function buildLights() {
  const Ls = [], asp = frame.w / frame.h, beat = 1 + AU.beat * S.audioAmt * .9;
  const add = (x, y, z, d, cosO, c, range, orb = 0, noShadow = 0) => Ls.push({ p: [x * asp, y, z], d, cosO, c, range, orb, orbZ: z / Math.max(S.depth, 1e-3), noShadow });
  for (const h of hands) {
    if (h.a < .02) continue;
    if (S.spots && !(S.painter && h.g === "pinch")) {
      TIPS[S.fingers].forEach(([tip, base], k) => {
        const t = h.p[tip], b = h.p[base];
        let d = [(t[0] - b[0]) * asp, t[1] - b[1], -(t[2] - b[2]) * asp - S.aim];
        const n = Math.hypot(...d) || 1; d = d.map((v) => v / n);
        add(t[0], t[1], depthAt(t[0], t[1]) * S.depth + S.lift, d, Math.cos(S.cone * Math.PI / 360), spotColor(h.side, k).map((v) => v * S.intensity * h.a * beat), S.range);
      });
    }
    if (S.lantern && h.open > .35 && h.g !== "fist") {
      const c = palmCenter(h.p), flick = .9 + .1 * Math.sin(now * .03 + h.id) * Math.sin(now * .017);
      const pinchDim = Math.min(1, Math.max(.15, (h.pinchD - .2) / .6));
      const pw = S.lanternInt * h.a * Math.min(1, (h.open - .35) / .5) * flick * pinchDim * beat;
      add(c[0], c[1] - (h.palm || .1) * .25, depthAt(c[0], c[1]) * S.depth + .14, [0, 0, -1], -2, hex(S.lanternCol).map((v) => v * pw), .75, .02 + .02 * pw / 4, 1);
    }
  }
  for (const bo of bolts) {
    const col = hex(S.boltCol);
    for (const f of [.2, .5, .8]) {
      const q = bo.main[Math.floor(f * (bo.main.length - 1))];
      add(q[0], q[1], depthAt(q[0], q[1]) * S.depth + .12, [0, 0, -1], -2, col.map((v) => v * S.boltInt * bo.flick * bo.w * beat), .55, 0, 1);
    }
  }
  if (S.painter) for (const pl of placed) {
    const age = (now - pl.born) / 1000, pulse = .85 + .15 * Math.sin(age * 3 + pl.hue * 10);
    add(pl.x, pl.y, depthAt(pl.x, pl.y, 3) * S.depth + .1, [0, 0, -1], -2, hsv(pl.hue, .75).map((v) => v * 2.6 * pulse * beat), .8, .022, 0);
  }
  if (carry && S.painter && carry.h.a > .3) {
    const c = pinchPoint(carry.h.p), pulse = 1 + .3 * Math.sin(now * .012);
    add(c[0], c[1], depthAt(c[0], c[1]) * S.depth + .1, [0, 0, -1], -2, hsv(carry.hue, .75).map((v) => v * 3 * pulse), .8, .03, 1);
  }
  if (mouse && S.mouse) add(mouse[0], mouse[1], S.depth + S.lift + .25, [0, 0, -1], Math.cos(S.cone * Math.PI / 360), spotColor("Right", 0).map((v) => v * S.intensity), S.range);
  for (const f of window.__depthr?.fake || []) {
    const n = Math.hypot(...f.d) || 1;
    add(f.uv[0], f.uv[1], depthAt(f.uv[0], f.uv[1]) * S.depth + S.lift, f.d.map((v) => v / n), f.omni ? -2 : Math.cos(S.cone * Math.PI / 360), (f.c || [1, .1, .1]).map((v) => v * S.intensity), S.range, f.orb || 0);
  }
  return Ls.slice(0, MAXL);
}

// =============================================================== audio
const AU = { ctx: null, an: null, data: null, el: null, dest: null, srcNode: null, stream: null, bass: 0, mid: 0, high: 0, beat: 0, avg: 0, prevK: 0, lastKick: 0, on: false };
function audioCtx() { if (!AU.ctx) { AU.ctx = new AudioContext(); AU.an = AU.ctx.createAnalyser(); AU.an.fftSize = 2048; AU.an.smoothingTimeConstant = .55; AU.data = new Uint8Array(AU.an.frequencyBinCount); AU.dest = AU.ctx.createMediaStreamDestination(); } return AU.ctx; }
function stopAudio() { try { AU.srcNode && AU.srcNode.disconnect(); } catch (e) {} if (AU.el) { AU.el.pause(); AU.el = null; } if (AU.stream) AU.stream.getTracks().forEach((t) => t.stop()); AU.stream = null; AU.srcNode = null; AU.on = false; $("#mic").classList.remove("on"); }
$("#mic").onclick = async () => {
  stopAudio(); const ctx = audioCtx(); await ctx.resume();
  AU.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  AU.srcNode = ctx.createMediaStreamSource(AU.stream); AU.srcNode.connect(AU.an); AU.on = true; $("#mic").classList.add("on"); toast("mic live");
};
$("#afile").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  stopAudio(); const ctx = audioCtx(); await ctx.resume();
  AU.el = new Audio(URL.createObjectURL(f)); AU.el.loop = true;
  AU.srcNode = ctx.createMediaElementSource(AU.el); AU.srcNode.connect(AU.an); AU.srcNode.connect(ctx.destination); AU.srcNode.connect(AU.dest);
  await AU.el.play(); AU.on = true; toast(f.name.replace(/\.[^.]+$/, "").slice(0, 28));
};
$("#astop").onclick = stopAudio;
function band(lo, hi, peak) { const hz = AU.ctx.sampleRate / AU.an.fftSize; let s = 0, n = 0, m = 0; for (let i = Math.max(1, Math.floor(lo / hz)); i <= Math.ceil(hi / hz); i++) { s += AU.data[i]; n++; m = Math.max(m, AU.data[i]); } return peak ? m / 255 : s / (n * 255); }
function updateAudio(dt) {
  AU.beat *= Math.pow(.9, dt / 16.7);
  let k, b, m, h;
  if (BK.on && AU.ext) [k, b, m, h] = AU.ext;   // bake: bands precomputed from the soundtrack per frame
  else if (AU.on && !BK.on) { AU.an.getByteFrequencyData(AU.data); k = band(35, 130, true); b = Math.min(1, band(30, 160) * 1.6); m = Math.min(1, band(400, 2000) * 1.6); h = Math.min(1, band(4000, 12000) * 2); }
  else { AU.bass *= .9; AU.mid *= .9; AU.high *= .9; return; }
  AU.bass = b; AU.mid = m; AU.high = h;
  // kick = low-end peak jumping clearly above its running average
  const rising = k - (AU.prevK || 0);
  if (k > Math.min(AU.avg * 1.18 + .08, AU.avg + (1 - AU.avg) * .45) && rising > .04 && now - AU.lastKick > 180) { AU.lastKick = now; AU.beat = 1; onKick(); }
  AU.prevK = k;
  AU.avg += (k - AU.avg) * .03;
  $("#mb").style.transform = `scaleX(${b})`; $("#mm").style.transform = `scaleX(${m})`; $("#mh").style.transform = `scaleX(${h})`; $("#mk").style.transform = `scaleX(${AU.beat})`;
}
let scanT0 = 0;
function onKick() {
  AU.beatN = (AU.beatN || 0) + 1;
  if (FXS.auto < 0 && FXS.id && AU.beatN % -FXS.auto === 0) fxStep(1, true);
  if (S.scan !== "off") scanT0 = now;
  if (S.beatWaves) { const h = hands.find((x) => x.a > .5); const c = h ? palmCenter(h.p) : [.5, .45]; shockwave(c[0], c[1], .8); }
}

// =============================================================== render
let lastT = performance.now(), holoYaw = 0, holoPitch = 0, focus = .8, black = 0, sunDir = [-.6, -.5, .6];
const MATS = { photo: 0, chrome: 1, gold: 2, glass: 3, clay: 4, toon: 5, cloak: 6, thermal: 7 };
const WORLDS = { off: 0, stars: 1, desert: 2, crystal: 3, synth: 4, void: 5 };
const SCANS = { off: 0, depth: 1, vertical: 2, contour: 3 };
const HOLO_STYLES = { holo: 0, ridge: 1, voxel: 2, storm: 3, sand: 4, rain: 5, lidar: 6, stars: 7, slices: 8, trio: 9 };
function loop() { requestAnimationFrame(loop); if (!BK.on) render(); }
function render(t = performance.now()) {
  now = t; const dt = Math.max(0, Math.min(100, now - lastT)); lastT = now;
  if (!frame) return;
  const [rw, rh] = renderSize(); if (cv.width !== rw) layout();
  ensureFbos(rw, rh);
  PERF.n++; if (t - PERF.t > 1000) { PERF.fps = Math.round(PERF.n * 1000 / (t - PERF.t)); PERF.n = 0; PERF.t = t; }
  updateAudio(dt); updateHands(dt); updateSpells(); updateBolts();
  black += (blackTarget - black) * Math.min(1, dt / 120);
  waves = waves.filter((w) => now - w.t0 < 1600);
  const lights = buildLights();
  const lead = hands.find((h) => h.a > .5);

  // ------------------------------------------- scene / hologram into F.scene
  if (S.holo) {
    const spin = S.holoSpin;
    let ty = Math.sin(now * .0004 * (1 + spin * 3)) * .9 * spin, tp = Math.sin(now * .00031) * .25 * spin;
    if (lead) { const c = palmCenter(lead.p); const x = chk("mirror") ? 1 - c[0] : c[0]; ty = (x - .5) * 2.4; tp = (c[1] - .5) * 1.4; }
    holoYaw += (ty - holoYaw) * .08; holoPitch += (tp - holoPitch) * .08;
    target(F.scene); if (chk("cut")) gl.clearColor(0, 0, 0, 1); else gl.clearColor(0, .006, .014, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    use(P.holo); commonU(); bindTex(0, texCam); bindTex(1, texAux);
    gl.uniform2i(L("uGrid"), frame.aw, frame.ah); f1("uDepthH", S.holoDepth); f1("uYaw", holoYaw); f1("uPitch", holoPitch);
    f1("uBeat", AU.beat * S.audioAmt); f1("uBass", AU.bass * S.audioAmt); f1("uTint", S.holoTint);
    f1("uHoloBg", S.holoBg && !chk("cut") ? 1 : 0); f1("uPx", frame.h / frame.ah * 1.35);
    const style = HOLO_STYLES[S.holoStyle] || 0; i1("uStyle", style);
    const hc = lead ? palmCenter(lead.p) : null; f3("uHandP", hc ? [hc[0], hc[1], 1] : [0, 0, 0]);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    if (style === 2) gl.blendEquation(gl.MAX);           // voxels read as solid blocks, not additive mush
    gl.bindVertexArray(emptyVao); gl.drawArraysInstanced(gl.POINTS, 0, frame.aw * frame.ah, style === 9 ? 3 : 1);
    gl.blendEquation(gl.FUNC_ADD); gl.disable(gl.BLEND);
  } else {
    target(F.scene); use(P.scene); commonU();
    bindTex(0, texCam); bindTex(1, texAux); bindTex(2, F.plate[F.pi].tex); uploadSpells(); bindTex(3, texSpell);
    i1("uPlate", 2); i1("uSpell", 3);
    i1("uMat", MATS[S.mat]); i1("uWorld", WORLDS[S.world]); i1("uScan", SCANS[S.scan]); i1("uSpellN", S.spells ? spell.length : 0);
    f3("uTint", hex(S.tint));
    f1("uAmb", S.amb); f1("uAlb", S.alb); f1("uSpec", S.spec); f1("uGloss", S.gloss); f1("uWrap", S.wrap); f1("uBg", S.bg);
    f1("uDepth", S.depth); f1("uShadow", S.shadow); f1("uLong", S.longShadow ? 1 : 0); f1("uRim", S.rim); f1("uBands", S.bands); f1("uInk", S.ink);
    f1("uBlack", black); f1("uSoft", S.soft); f1("uBass", AU.bass * S.audioAmt); f1("uBeat", AU.beat * S.audioAmt);
    const lp = new Float32Array(MAXL * 3), ld = new Float32Array(MAXL * 4), lc = new Float32Array(MAXL * 4), lx = new Float32Array(MAXL * 4);
    lights.forEach((l, i) => { lp.set(l.p, i * 3); ld.set([...l.d, l.cosO], i * 4); lc.set([...l.c, l.range], i * 4); lx.set([l.orb, l.orbZ, l.noShadow, 0], i * 4); });
    i1("uN", lights.length); f3("uLP", lp); f4v("uLD", ld); f4v("uLC", lc); f4v("uLX", lx);
    let sd = [Math.cos(now * .00015) * .8, -.55, .55];
    if (S.sunHand && lead) { const c = palmCenter(lead.p); sd = [(c[0] - .5) * 2.2, (c[1] - .5) * 2.2, .55]; }
    sunDir = mix3(sunDir, sd, .06);
    f1("uSunOn", S.sun ? 1 : 0); f3("uSunDir", sunDir); f3("uSunCol", hex(S.sunCol).map((v) => v * S.sunInt * (1 - black * .9))); f3("uSkyCol", hex(S.skyCol)); f1("uSkyAmt", S.skyAmt * (1 - black));
    const sp = ((now - scanT0) / 1000) * S.scanSpeed;
    const scanPos = S.scan === "depth" ? 1.05 - (sp % 1.25) : S.scan === "vertical" ? (sp * .8 % 1.3) - .15 : sp;
    f1("uScanPos", scanPos); f1("uScanW", S.scanW); f1("uContours", S.contours); f3("uScanCol", hex(S.scanCol));
    f1("uFog", S.fog); f3("uFogCol", hex(S.fogCol));
    quad();
  }
  // ------------------------------------------- FX library layer (MRT: display + feedback state)
  body = body.map((v, i) => v + (bodyTarget[i] - v) * .15);
  const fxOn = runFx(dt);
  const srcTex = fxOn ? F.fxOut.tex : F.scene.tex;
  // ------------------------------------------- clean plate (the room without you)
  { const nx = 1 - F.pi; target(F.plate[nx]); use(P.plate); commonU(); bindTex(0, texCam); bindTex(1, texAux); bindTex(2, F.plate[F.pi].tex); i1("uPrev", 2); f1("uInit", plateInit ? 1 : 0); quad(); F.pi = nx; plateInit = false; }
  // ------------------------------------------- ghost feedback
  if (S.ghost > 0 && !S.holo) {
    const nx = 1 - F.gi; target(F.ghost[nx]);
    if (ghostClear) { for (const g of F.ghost) { target(g); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); } target(F.ghost[nx]); ghostClear = false; }
    use(P.ghost); commonU(); bindTex(1, texAux); bindTex(2, F.ghost[F.gi].tex); bindTex(4, srcTex); i1("uPrev", 2); i1("uScene", 4);
    f1("uDecay", Math.pow(S.ghostDecay, dt / 16.7)); f2("uDrift", 0, .0012); f3("uGhostTint", hex(S.ghostCol));
    quad(); F.gi = nx;
  }
  // ------------------------------------------- bloom (quarter res)
  if (S.bloom > 0) {
    target(F.bA); use(P.bright); commonU(); bindTex(4, srcTex); i1("uScene", 4); f1("uThresh", 1.0); quad();
    use(P.blur); i1("uSrc", 5);
    for (let k = 0; k < 2; k++) {
      target(F.bB); bindTex(5, F.bA.tex); f2("uDir", (1 + k) / F.bA.w, 0); quad();
      target(F.bA); bindTex(5, F.bB.tex); f2("uDir", 0, (1 + k) / F.bA.h); quad();
    }
  }
  // ------------------------------------------- post to screen
  if (lead) { const t = lead.p[8]; focus += (depthAt(t[0], t[1]) - focus) * .1; }
  target(null); use(P.post); commonU();
  bindTex(0, texCam); bindTex(1, texAux); bindTex(4, srcTex); bindTex(5, F.ghost[F.gi].tex); bindTex(6, F.bA.tex);
  i1("uScene", 4); i1("uGhost", 5); i1("uBloom", 6);
  i1("uView", view); i1("uMirror", chk("mirror") ? 1 : 0); f1("uHolo", S.holo ? 1 : 0);
  f1("uDof", S.dof); f1("uFocus", focus); f2("uTexel", 1 / frame.w, 1 / frame.h);
  const ac = S.auraCycle ? hsv((now * .00012) % 1, .85) : hex(S.auraCol);
  f1("uAura", S.aura); f3("uAuraCol", ac); f1("uAuraPulse", AU.bass * S.audioAmt);
  f1("uGhostAmt", S.holo || S.ghost <= 0 ? 0 : S.ghost); f1("uBloomAmt", S.bloom); f1("uChroma", S.chroma + AU.beat * S.audioAmt * .5);
  f1("uExpo", fxOn && !FXS.scene ? 1.3 : 1); f1("uVig", S.vig); f1("uGrain", S.grain); f1("uFlash", AU.beat * S.audioAmt * .06);
  const wv = new Float32Array(16);
  waves.forEach((w, i) => { const age = (now - w.t0) / 1000; wv.set([w.x, w.y, age, w.s * Math.max(0, 1 - age / 1.6)], i * 4); });
  f4v("uWaves", wv);
  quad();
  drawOverlay();
  hud(lights);
}

// =============================================================== FX library engine
const FXS = { id: "", a: .5, b: .5, mix: 1, scene: false, auto: 0, cat: "All", q: "", lastSwitch: 0 };
const fxProgs = {}, fxBroken = {};
function fxProg(id) {
  if (fxProgs[id] || fxBroken[id]) return fxProgs[id];
  const def = FX.find((f) => f.id === id); if (!def) return null;
  try { fxProgs[id] = compile(SH_VS, fxShader(def.src)); }
  catch (e) { fxBroken[id] = String(e.message || e); console.error("FX " + id, e); toast("FX failed: " + def.name); }
  return fxProgs[id];
}
function runFx(dt) {
  if (!FXS.id) return false;
  if (FXS.auto > 0 && now - FXS.lastSwitch > FXS.auto * 1000) fxStep(1, true);
  if (FXS.id.startsWith("preset-")) return false;   // library entry that is a base preset: no extra pass
  const p = fxProg(FXS.id); if (!p) return false;
  if (fxClear) { for (const st of F.fxSt) { target(st); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); } fxClear = false; }
  const nx = 1 - F.si;
  gl.bindFramebuffer(gl.FRAMEBUFFER, F.fxFb[nx]); gl.viewport(0, 0, F.fxOut.w, F.fxOut.h);
  use(fxProgs[FXS.id] || p); commonU();
  bindTex(0, texCam); bindTex(1, texAux); bindTex(2, F.plate[F.pi].tex); bindTex(4, F.scene.tex); bindTex(7, F.fxSt[F.si].tex);
  i1("uPlate", 2); i1("uScene", 4); i1("uPrev", 7);
  f1("uA", FXS.a); f1("uB", FXS.b); f1("uMix", FXS.mix); f1("uUseScene", FXS.scene ? 1 : 0);
  f1("uBass", AU.bass * S.audioAmt); f1("uMid", AU.mid * S.audioAmt); f1("uHigh", AU.high * S.audioAmt); f1("uBeat", AU.beat * S.audioAmt); f1("uBeatN", AU.beatN || 0);
  f2("uTexel", 1 / frame.w, 1 / frame.h); gl.uniform4fv(L("uBody"), body);
  const live = hands.filter((h) => h.a > .3).slice(0, 2), hp = new Float32Array(42 * 3), ha = new Float32Array(2);
  live.forEach((h, k) => { ha[k] = h.a; for (let i = 0; i < 21; i++) hp.set([h.p[i][0], h.p[i][1], h.p[i][2]], (k * 21 + i) * 3); });
  gl.uniform3fv(L("uH"), hp); gl.uniform1fv(L("uHA"), ha); i1("uHN", live.length);
  quad(); F.si = nx;
  return true;
}
// favorites: star an effect together with its knobs (A/B/Mix/scene). Saved to favorites.json in DEPTHR_HOME through
// the server, with a localStorage copy so nothing is lost if the server is down. Picking a favorite restores its knobs.
let FAVS = [], favSaveT = 0;
const favOf = (id) => FAVS.find((f) => f.id === id);
async function loadFavs() {
  try { const r = await (await fetch("/favs", { cache: "no-store" })).json(); if (!Array.isArray(r.favs)) throw 0; FAVS = r.favs;
    if (!r.ok) toast("favorites file unreadable, see console"), console.warn(r.err); }
  catch { try { FAVS = JSON.parse(localStorage.getItem("depthr.favs") || "[]"); } catch { FAVS = []; } }
  favUi(); if (FXS.cat === "fav") fillFxGrid();
}
function saveFavs() {
  localStorage.setItem("depthr.favs", JSON.stringify(FAVS)); clearTimeout(favSaveT);
  favSaveT = setTimeout(() => fetch("/favs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: 1, favs: FAVS }) })
    .then((r) => r.json()).then((r) => { if (!r.ok) toast("favorites not saved: " + r.err); })
    .catch(() => toast("favorites kept in the browser only (server offline)")), 250);
}
function toggleFav(update) {
  if (!FXS.id) { toast("pick an effect first"); return; }
  const def = FX.find((f) => f.id === FXS.id); if (!def) return;
  const cur = favOf(FXS.id), entry = { id: FXS.id, name: def.name, cat: def.cat, a: FXS.a, b: FXS.b, mix: FXS.mix, scene: FXS.scene, at: new Date().toISOString().slice(0, 19) };
  if (cur && update) { Object.assign(cur, entry); toast("Knobs saved · " + def.name); }
  else if (cur) { FAVS = FAVS.filter((f) => f !== cur); toast("removed from favorites"); }
  else { FAVS.push(entry); toast("Favorited · " + def.name); }
  saveFavs(); favUi(); fillFxGrid();
}
function favUi() {
  const on = !!favOf(FXS.id), b = $("#fxfav"); b.innerHTML = ic(on ? "starFill" : "star"); b.classList.toggle("on", on);
  const chip = document.querySelector('#fxcats button[data-cat="fav"]'); if (chip) chip.innerHTML = `${ic("star")}Favorites <small>${FAVS.filter((f) => FX.some((x) => x.id === f.id)).length}</small>`;
}
function setKnob(k, v) { const el = $("#fx" + k); el.value = v; el.oninput(); paintRange(el); }
function fxList() {
  const q = FXS.q.toLowerCase();
  if (FXS.cat === "fav") return FAVS.map((v) => FX.find((f) => f.id === v.id)).filter((f) => f && (!q || f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q)));
  return FX.filter((f) => (FXS.cat === "All" || f.cat === FXS.cat) && (!q || f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q)));
}
function setFx(id, announce) {
  FXS.id = id; fxClear = true; FXS.lastSwitch = now;
  const def = FX.find((f) => f.id === id);
  if (def && def.preset != null) applyPreset(def.preset);
  const fv = favOf(id);
  if (fv && def && def.preset == null) { setKnob("A", fv.a); setKnob("B", fv.b); setKnob("Mix", fv.mix); $("#fxscene").checked = FXS.scene = !!fv.scene; }
  favUi();
  $("#fxAl").textContent = def ? def.a : "A"; $("#fxBl").textContent = def ? def.b : "B";
  document.querySelectorAll("#fxgrid button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
  const on = document.querySelector(`#fxgrid button[data-id="${id}"]`); if (on) on.scrollIntoView({ block: "nearest" });
  $("#fxname").textContent = def ? `${def.cat} · ${def.name}` : "off";
  if (announce && def) toast(def.name);
}
function fxStep(dir, random) {
  const list = fxList(); if (!list.length) return;
  let i = list.findIndex((f) => f.id === FXS.id);
  i = random ? Math.floor(Math.random() * list.length) : (i + dir + list.length) % list.length;
  setFx(list[i].id, true);
}
// the 26 original presets also live in the library (own category), so search / shuffle / auto-cycle reach them
function addPresetsToLibrary() {
  if (FX.some((f) => f.preset != null)) return;
  FX.splice(0, 0, ...PRESETS.map((p, i) => ({ id: "preset-" + i, cat: "Presets", name: p[0], a: "—", b: "—", preset: i, desc: p[1] })));
  FX_CATS.unshift("Presets");
}
function buildFxPanel() {
  addPresetsToLibrary();
  const cats = $("#fxcats");
  ["All", "fav", ...FX_CATS].forEach((c) => { const b = document.createElement("button"); b.innerHTML = c === "All" ? `All <small>${FX.length}</small>` : c === "fav" ? `${ic("star")}Favorites <small>0</small>` : `${c} <small>${FX.filter((f) => f.cat === c).length}</small>`; b.dataset.cat = c;
    b.onclick = () => { FXS.cat = c; cats.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); fillFxGrid(); }; cats.appendChild(b); });
  cats.firstChild.classList.add("on");
  $("#fxq").oninput = (e) => { FXS.q = e.target.value; fillFxGrid(); };
  for (const k of ["A", "B", "Mix"]) { const el = $("#fx" + k), out = el.nextElementSibling;
    el.oninput = () => { FXS[k === "Mix" ? "mix" : k.toLowerCase()] = +el.value; out.textContent = (+el.value).toFixed(2); }; el.oninput(); }
  $("#fxscene").onchange = (e) => { FXS.scene = e.target.checked; };
  $("#fxauto").onchange = (e) => { FXS.auto = +e.target.value; FXS.lastSwitch = now; };
  $("#fxoff").onclick = () => setFx("", false);
  $("#fxshuffle").onclick = () => fxStep(1, true);
  $("#fxfav").onclick = (e) => toggleFav(e.shiftKey);
  fillFxGrid();
}
function fillFxGrid() {
  const g = $("#fxgrid"); g.innerHTML = "";
  for (const f of fxList()) { const b = document.createElement("button"); b.dataset.id = f.id; if (favOf(f.id)) b.innerHTML = ic("starFill", "fav"); const nm = document.createElement("span"); nm.textContent = f.name; b.appendChild(nm); b.title = f.desc ? `${f.cat} · ${f.desc}` : f.cat; if (f.preset != null) b.classList.add("pre");
    if (f.id === FXS.id) b.classList.add("on"); b.onclick = () => setFx(FXS.id === f.id ? "" : f.id); g.appendChild(b); }
  $("#fxcount").textContent = `${fxList().length} shown`;
}
// contact sheet for review/testing: renders each effect for a few frames and tiles thumbnails
async function fxSheet(ids, cols = 6, tw = 320, frames = 12) {
  const th = Math.round(tw * frame.h / frame.w), rows = Math.ceil(ids.length / cols);
  let sh = $("#sheet"); if (!sh) { sh = document.createElement("canvas"); sh.id = "sheet"; sh.style.cssText = "position:absolute;inset:0;margin:auto;max-width:100%;max-height:100%;z-index:5;background:#000"; $("#stage").appendChild(sh); }
  sh.style.display = "block";
  sh.width = cols * tw; sh.height = rows * (th + 18); const x = sh.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, sh.width, sh.height);
  const keep = FXS.id, v = view; view = 0; layout();
  for (let i = 0; i < ids.length; i++) { const id = ids[i];
    setFx(id); for (let k = 0; k < frames; k++) { render(); if (k % 3 === 2) await new Promise((r) => setTimeout(r, 40)); }
    const cx = (i % cols) * tw, cy = Math.floor(i / cols) * (th + 18);
    x.drawImage(cv, 0, 0, cv.width, cv.height, cx, cy, tw, th);
    x.fillStyle = fxBroken[id] ? "#f44" : "#ddd"; x.font = "13px system-ui"; x.fillText((fxBroken[id] ? "X " : "") + (FX.find((f) => f.id === id) || {}).name, cx + 4, cy + th + 14);
  }
  setFx(keep); view = v; layout(); return sh;
}
function fxCompileAll() { const bad = {}; for (const f of FX) { if (f.preset != null) continue; fxProg(f.id); if (fxBroken[f.id]) bad[f.id] = fxBroken[f.id].slice(0, 300); } return bad; }

// =============================================================== overlay: markers, bolts, labels
function scr(x, y) { const H = view === 4 ? ov.height / 2 : ov.height; return [(chk("mirror") ? 1 - x : x) * ov.width, y * H]; }
let cleanShot = false;   // set while a snapshot redraws the overlay without markers
const G_ICON = { fist: "fist", open: "open", peace: "peace", point: "point", pinch: "pinch" };   // gesture labels (text, no emoji)
function drawOverlay() {
  octx.clearRect(0, 0, ov.width, ov.height);
  if (view === 1 || view === 2 || view === 3) return;
  const s = ov.width / 1280;
  octx.save();
  octx.globalCompositeOperation = "lighter"; octx.lineJoin = "round"; octx.lineCap = "round";
  const bc = hex(S.boltCol).map((v) => Math.round(v * 255)).join(",");
  for (const bo of bolts) {
    for (const [pts, wmul] of [[bo.main, 1], ...bo.br.map((b) => [b, .5])]) {
      for (const [w, a, c] of [[16, .12, bc], [7, .3, bc], [2.2, .95, "255,255,255"]]) {
        octx.strokeStyle = `rgba(${c},${Math.min(1, a * bo.flick)})`; octx.lineWidth = w * s * wmul * bo.w;
        octx.beginPath(); pts.forEach((q, i) => { const [X, Y] = scr(q[0], q[1]); i ? octx.lineTo(X, Y) : octx.moveTo(X, Y); }); octx.stroke();
      }
    }
  }
  octx.restore();
  if (!chk("markers") || S.holo || BK.on || recorder || cleanShot) return;   // preview aid only: never in recordings or snapshots
  octx.lineWidth = 2 * s; octx.strokeStyle = "rgba(255,255,255,.85)"; octx.fillStyle = "rgba(255,255,255,.9)";
  octx.font = `600 ${Math.round(13 * s)}px system-ui`;
  for (const h of hands) {
    if (h.a < .3) continue;
    octx.globalAlpha = h.a;
    if (S.spots && !(S.painter && h.g === "pinch")) TIPS[S.fingers].forEach(([tip, base]) => {
      const [X, Y] = scr(h.p[tip][0], h.p[tip][1]), [BX, BY] = scr(h.p[base][0], h.p[base][1]);
      const dx = X - BX, dy = Y - BY, dl = Math.hypot(dx, dy) || 1, r = 5 * s;
      octx.beginPath(); octx.arc(X, Y, r, 0, 7); octx.stroke();
      octx.beginPath(); octx.moveTo(X - dx / dl * r, Y - dy / dl * r); octx.lineTo(X - dx / dl * r * 3.2, Y - dy / dl * r * 3.2); octx.stroke();
    });
    if (S.gestures || S.painter || S.spells) { const [WX, WY] = scr(h.p[0][0], h.p[0][1]); if (G_ICON[h.g]) octx.fillText(G_ICON[h.g].toUpperCase(), WX - 16 * s, WY + 26 * s); }
  }
  octx.globalAlpha = 1;
  if (S.painter) for (const pl of placed) { const [X, Y] = scr(pl.x, pl.y); octx.strokeStyle = "rgba(255,255,255,.3)"; octx.beginPath(); octx.arc(X, Y, 14 * s, 0, 7); octx.stroke(); }
}

let hudT = 0;
function hud(lights) {
  if (now - hudT < 400) return; hudT = now;
  const s = frame.stats || {};
  const g = hands.filter((h) => h.a > .5).map((h) => G_ICON[h.g] || "·").join(" ");
  $("#hud").innerHTML =
    `<span class="pill hot"><b>${PRESETS[presetIdx][0]}</b>${FXS.id && !FXS.id.startsWith("preset-") ? " + " + (FX.find((f) => f.id === FXS.id) || {}).name : ""}</span>` +
    `<span class="pill">model <b>${s.model_ms}ms</b>${s.gpus > 1 ? " ×" + s.gpus : ""}</span>` +
    `<span class="pill">ai <b>${s.fps}</b> fps</span><span class="pill">draw <b>${PERF.fps}</b> fps${rscale() !== 1 ? " · " + rscale() + "×" : ""}</span><span class="pill">cam <b>${s.cam}</b>${s.gain > 1.05 ? " · gain ×" + s.gain : ""}</span>` +
    `<span class="pill">hands <b>${hands.filter((h) => h.a > .5).length}</b> ${g}</span><span class="pill">lights <b>${lights.length}</b></span>` +
    (black > .5 ? `<span class="pill rec">BLACKOUT</span>` : "") + (AU.on ? `<span class="pill">${ic("wave")}<i class="dot${AU.beat > .5 ? " on" : ""}"></i></span>` : "") +
    (recorder ? `<span class="pill rec">${ic("record")}REC</span>` : "") + (BK.on ? `<span class="pill rec">${ic("render")}RENDER ${BK.done}/${BK.total}</span>` : "");
  if (now - (hud.pt || 0) > 1000) { hud.pt = now; paintRanges(); }
}

// =============================================================== input, capture, keys
cv.addEventListener("pointerdown", (e) => { if (S.mouse) { mouse = pt(e); cv.setPointerCapture(e.pointerId); } });
cv.addEventListener("pointermove", (e) => { if (mouse) mouse = pt(e); });
cv.addEventListener("pointerup", () => { mouse = null; });
function pt(e) { const r = cv.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  if (view === 4) y = y < .5 ? y * 2 : (y - .5) * 2; if (chk("mirror")) x = 1 - x; return [x, y]; }

let recorder = null, chunks = [];
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
function toggleRec() {
  if (recorder) { recorder.stop(); return; }
  const comp = document.createElement("canvas"); comp.width = cv.width; comp.height = cv.height;
  const cx = comp.getContext("2d"), stream = comp.captureStream(60);
  if (AU.el && AU.dest) AU.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 18e6 });
  chunks = []; recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  let live = true;
  (function pump() { if (!live) return; cx.drawImage(cv, 0, 0); cx.drawImage(ov, 0, 0); requestAnimationFrame(pump); })();
  recorder.onstop = () => { live = false; dl(new Blob(chunks, { type: "video/webm" }), `depthr-${stamp()}.webm`); recorder = null; $("#rec").classList.remove("on"); };
  recorder.start(250); $("#rec").classList.add("on");
}
function snap() { cleanShot = true; drawOverlay(); cleanShot = false; const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height; const x = c.getContext("2d"); x.drawImage(cv, 0, 0); x.drawImage(ov, 0, 0); c.toBlob((b) => dl(b, `depthr-${stamp()}.png`), "image/png"); }
function clearArt() { spell = []; placed = []; carry = null; ghostClear = true; toast("cleared"); }
// these two are user locks, not look settings: presets never touch them, and they survive a reload
for (const id of ["htrack", "gswitch", "markers"]) {
  const el = $("#" + id), v = localStorage.getItem("depthr." + id);
  if (v != null) el.checked = v === "1";
  el.addEventListener("change", () => localStorage.setItem("depthr." + id, el.checked ? "1" : "0"));
}
$("#rec").onclick = toggleRec; $("#snap").onclick = snap; $("#clear").onclick = clearArt;
$("#srcgo").onclick = async () => { const s = $("#src").value.trim() || "auto"; const r = await (await fetch("/source?s=" + encodeURIComponent(s))).json(); if (!r.ok) alert(r.err); plateInit = true; };
addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" && e.target.type === "text") return;
  const k = e.key.toLowerCase(), vmap = { 1: 0, 2: 4, 3: 1, 4: 2, 5: 3, 6: 5 };
  if (k in vmap) document.querySelector(`button[data-v="${vmap[k]}"]`).click();
  else if (k === "]") fxStep(1);
  else if (k === "[") fxStep(-1);
  else if (k === "x") fxStep(1, true);
  else if (k === "0") setFx("", true);
  else if (k === "arrowright") applyPreset(presetIdx + 1, true);
  else if (k === "arrowleft") applyPreset(presetIdx - 1, true);
  else if (k === "m") $("#mirror").click();
  else if (k === "k") $("#cut").click();
  else if (k === "t") { $("#htrack").click(); toast(chk("htrack") ? "hand tracking on" : "hand tracking off"); }
  else if (k === "g") { $("#gswitch").click(); toast(chk("gswitch") ? "Peace sign switches looks" : "Peace-sign switching locked"); }
  else if (k === "r") toggleRec();
  else if (k === "s") snap();
  else if (k === "l" || k === "*") toggleFav(e.shiftKey);
  else if (k === "c") clearArt();
  else if (k === "b") { const h = hands.find((x) => x.a > .5); const c = h ? palmCenter(h.p) : [.5, .45]; shockwave(c[0], c[1], 1); }
  else if (k === "h") { document.body.classList.toggle("hide"); setTimeout(layout, 30); }
  else if (k === "f") document.fullscreenElement ? document.exitFullscreen() : $("#stage").requestFullscreen();
});

// =============================================================== Film → FX: frame-exact offline render
// The server decodes every frame of the clip (no drops), runs DAViD + hands on it and hands it over with
// that frame's audio bands. We render it at virtual time i/fps, read the pixels back and post them to
// ffmpeg, so a 30 fps clip comes out as a 30 fps MP4 with the original sound, however slow the FX are.
const BK = { on: false, cancel: false, done: 0, total: 0, clip: "", song: "", free: -1, last: "" };
const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
async function upload(file) {
  toast(`uploading ${file.name}…`);
  const r = await (await fetch("/upload?name=" + encodeURIComponent(file.name), { method: "POST", body: file })).json();
  if (!r.ok) { alert(r.err || "upload failed"); return null; }
  return r.path;
}
async function refreshClips(select) {
  const r = await (await fetch("/clips")).json(), sel = $("#clipsel");
  sel.innerHTML = `<option value="">Filmed clips (${r.clips.length})</option>` +
    r.clips.map((c) => `<option value="${c.path.replace(/"/g, "&quot;")}">${c.name} · ${c.mb} MB</option>`).join("");
  if (select) sel.value = select;
  BK.free = r.free_mb;
}
async function pickClip(path) {
  BK.clip = path; if (!path) return;
  const m = await (await fetch("/probe?p=" + encodeURIComponent(path))).json();
  if (!m.ok) { $("#clipinfo").textContent = m.err; return; }
  BK.meta = m;
  $("#clipinfo").innerHTML = `<b style="color:var(--txt)">${m.name}</b> · ${m.w}×${m.h} · ${m.fps} fps · ${fmtT(m.dur)} (${m.frames} frames)` +
    (BK.free >= 0 ? ` · ${(BK.free / 1000).toFixed(1)} GB free for renders` : "");
  await fetch("/source?s=" + encodeURIComponent(path)); plateInit = true; fxClear = true; ghostClear = true;
  $("#src").value = path; if (chk("mirror")) $("#mirror").click();   // filmed footage is already the right way round
}
function bkStatus(t) { $("#bkstat").innerHTML = t; }
async function bake() {
  if (BK.on) return;
  if (!BK.clip) { alert("Load or pick a clip first."); return; }
  if (view === 4) document.querySelector('button[data-v="0"]').click();   // split view doubles the height
  const qs = new URLSearchParams({ p: BK.clip, start: +$("#bkin").value || 0, end: +$("#bkout").value || 0, maxw: $("#bksize").value,
    crf: $("#bkq").value, song: BK.song, alpha: chk("cut") ? $("#bkalpha").value : "", tag: (FXS.id && !FXS.id.startsWith("preset-") ? FXS.id : PRESETS[presetIdx][0]).replace(/\W+/g, "") });
  bkStatus("preparing (decoding the soundtrack, loading the hand tracker)…");
  const meta = await (await fetch("/bake/open?" + qs)).json();
  if (!meta.ok) { bkStatus(ic("alert") + " " + meta.err); return; }
  // fresh deterministic state, mirror off, live loop paused
  BK.on = true; BK.cancel = false; BK.total = meta.end - meta.start; BK.done = 0;
  const wasMirror = chk("mirror"); if (wasMirror) $("#mirror").click();
  hands = []; waves = []; spell = []; placed = []; carry = null; bolts = [];
  Object.assign(AU, { beat: 0, avg: 0, prevK: 0, lastKick: -1e9, beatN: 0, bass: 0, mid: 0, high: 0, ext: null });
  plateInit = true; ghostClear = true; fxClear = true; frame = null;
  const comp = document.createElement("canvas"), cx = comp.getContext("2d", { willReadFrequently: true });
  const step = 1000 / meta.fps, warm = meta.start - meta.first;   // server pre-rolls so trails / plate / depth settle
  let vt = 1e6; lastT = vt - step; FXS.lastSwitch = vt;
  const t0 = performance.now(); let err = ""; const P = BK.prof = { wait: 0, ingest: 0, render: 0, read: 0, put: 0, hand: 0, make: 0 };
  const get = (i) => fetch("/bake/frame?i=" + i, { cache: "no-store" }).then((r) => r.status === 200 ? r.arrayBuffer() : null);
  let next = get(meta.start - warm), put = Promise.resolve({ ok: true });
  try {
    for (let i = meta.start - warm; i < meta.end; i++) {
      if (BK.cancel) break;
      let T = performance.now(); const ab = await next; if (!ab) break; P.wait += performance.now() - T;
      if (i + 1 < meta.end) next = get(i + 1);              // decode + model the next frame while this one draws
      T = performance.now(); now = vt; const hd = await ingest(ab); P.ingest += performance.now() - T; P.hand += hd.stats.hand_ms; P.make += hd.stats.make_ms;
      T = performance.now(); render(vt); vt += step; gl.finish(); P.render += performance.now() - T;
      if (i < meta.start) continue;
      if (cv.width !== meta.ow || cv.height !== meta.oh) { err = `canvas is ${cv.width}×${cv.height}, expected ${meta.ow}×${meta.oh}`; break; }
      if (comp.width !== cv.width || comp.height !== cv.height) { comp.width = cv.width; comp.height = cv.height; }
      T = performance.now(); cx.clearRect(0, 0, comp.width, comp.height);
      if (!meta.alpha) { cx.fillStyle = "#000"; cx.fillRect(0, 0, comp.width, comp.height); }   // cutout on black for MP4
      cx.drawImage(cv, 0, 0); cx.drawImage(ov, 0, 0);
      const px = cx.getImageData(0, 0, comp.width, comp.height).data; P.read += performance.now() - T;
      T = performance.now(); const r = await put; P.put += performance.now() - T; if (!r.ok) { err = r.err; break; }
      put = fetch("/bake/put", { method: "POST", body: new Blob([px]) })   // Blob uploads ~4x faster than a typed array here.then((x) => x.json());
      BK.done++;
      if (BK.done % 5 === 0 || BK.done === BK.total) {
        const el = (performance.now() - t0) / 1000, rate = BK.done / el;
        $("#bkbar b").style.width = (BK.done / BK.total * 100).toFixed(1) + "%";
        bkStatus(`rendering ${BK.done}/${BK.total} · ${rate.toFixed(1)} fps · ${fmtT((BK.total - BK.done) / Math.max(rate, .01))} left`);
        hudT = 0; hud(buildLights());
      }
    }
    const r = await put; if (!r.ok && !err) err = r.err;
  } catch (e) { err = String(e.message || e); }
  const res = await (await fetch("/bake/close" + (BK.cancel ? "?cancel=1" : ""))).json();
  BK.on = false; frame = null; lastT = performance.now(); FXS.lastSwitch = performance.now(); hands = []; plateInit = true; fxClear = true; AU.ext = null;
  if (wasMirror) $("#mirror").click();
  $("#bkbar b").style.width = "0";
  BK.free = res.free_mb;
  if (BK.cancel) bkStatus("cancelled — partial file deleted");
  else if (err || !res.ok) bkStatus(ic("alert") + " " + (err || res.err));
  else {
    BK.last = res.out;
    bkStatus(`${ic("check")} <b style="color:var(--txt)">${res.out.split(/[\\/]/).pop()}</b> · ${res.frames} frames in ${res.secs}s · ` +
      `<a href="#" id="bkreveal" style="color:var(--acc)">show file</a> · ${(res.free_mb / 1000).toFixed(1)} GB left`);
    $("#bkreveal").onclick = (e) => { e.preventDefault(); fetch("/reveal?p=" + encodeURIComponent(res.out)); };
    toast("render done");
  }
  return { ...res, err };
}
function buildBake() {
  refreshClips();
  const onFile = async (f) => { const p = await upload(f); if (p) { await refreshClips(p); await pickClip(p); } };
  $("#clipfile").onchange = async (e) => { const f = e.target.files[0]; if (f) await onFile(f); e.target.value = ""; };
  $("#clipsel").onchange = (e) => pickClip(e.target.value);
  $("#clipprev").onclick = () => BK.clip ? pickClip(BK.clip) : alert("Load or pick a clip first.");
  $("#clipcam").onclick = async () => { BK.clip = ""; await fetch("/source?s=auto"); plateInit = true; if (!chk("mirror")) $("#mirror").click(); $("#clipsel").value = ""; $("#src").value = "auto"; };
  $("#bksong").onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const p = await upload(f); if (p) { BK.song = p; $("#bksongl").innerHTML = ic("music") + f.name; } e.target.value = ""; };
  $("#bksongx").onclick = () => { BK.song = ""; $("#bksongl").innerHTML = ic("music") + "Use a song instead of the clip's sound"; };
  $("#bkgo").onclick = bake; $("#bkcancel").onclick = () => { BK.cancel = true; };
  $("#bkopen").onclick = () => fetch("/reveal" + (BK.last ? "?p=" + encodeURIComponent(BK.last) : ""));
  const st = $("#stage");   // or just drop a video on the picture
  st.addEventListener("dragover", (e) => e.preventDefault());
  st.addEventListener("drop", async (e) => {
    e.preventDefault();
    const f = [...e.dataTransfer.files].find((x) => /^video\//.test(x.type) || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(x.name));
    if (f) await onFile(f);
  });
}

// test hooks
window.__depthr = { fake: [], S, PRESETS, applyPreset, shockwave, get hands() { return hands; }, get frame() { return frame; },
  setView: (v) => { view = v; layout(); }, addSpell: (pts) => pts.forEach((p, i) => spell.push({ x: p[0], y: p[1], z: p[2] ?? .6, t: now, brk: i === 0 })),
  place: (x, y, hue = Math.random()) => placed.push({ x, y, hue, born: now }), audio: AU, fakeHands: (list) => onHands(list),
  get lightCount() { return frame ? buildLights().length : 0; }, FX, FXS, setFx, fxSheet, fxCompileAll, fxBroken, get body() { return body; }, BK, bake, pickClip, refreshClips };
$("#cut").onchange = (e) => { $("#stage").classList.toggle("cut", e.target.checked); ghostClear = true; fxClear = true;
  bkLabel(); };
function bkLabel() {
  const a = chk("cut") ? $("#bkalpha").value : ""; $("#bkalpha").disabled = !chk("cut");
  $("#bkgo").innerHTML = ic("render") + "Render to " + (a === "webm" ? "WebM (transparent)" : a === "mov" ? "MOV (transparent)" : "MP4");
}
$("#bkalpha").onchange = bkLabel;
// =============================================================== Performance panel
async function loadPerf() {
  let r; try { r = await (await fetch("/settings", { cache: "no-store" })).json(); } catch { return; }
  const cliMode = (r.effective.cli || []).includes("mode");
  PERF.info = r; PERF.mode = cliMode ? r.mode : (r.saved || {}).mode || r.mode;   // render scale follows the saved mode right away
  const saved = r.saved || {}, adv = saved.advanced || {};
  $("#pfmode").value = saved.mode || r.mode;
  $("#pfgpus").innerHTML = r.gpus.map((g) => `<label class="c"><input type="checkbox" value="${g.id}"> ${g.name} · ${g.vram_gb} GB</label>`).join("");
  const devs = (adv.devices || "all") === "all" ? r.gpus.map((g) => g.id) : adv.devices === "first" ? [r.gpus[0].id] : adv.devices.split(",");
  $("#pfgpus").querySelectorAll("input").forEach((el) => { el.checked = devs.includes(el.value); });
  $("#pfcam").value = `${adv.width || 1920}x${adv.height || 1080}`;
  $("#pfjpeg").value = adv.jpeg || 95; $("#pfjpeg").oninput();
  $("#pfscale").value = PERF.rscale; $("#pfscale").oninput();
  perfUi(); layout(); paintRanges();
}
function perfUi() {
  const r = PERF.info; if (!r) return; const e = r.effective, adv = $("#pfmode").value === "advanced";
  $("#pfseg").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.m === $("#pfmode").value));
  $("#pfadv").style.display = adv ? "" : "none";
  const gp = e.devices.split(",").map((d) => (r.gpus.find((g) => g.id === d) || { name: d }).name).join(" + ");
  $("#pfnow").innerHTML = `Running <b>${e.mode}</b> · model on ${gp} · camera ${e.width}×${e.height} · JPEG ${e.jpeg}` +
    (e.cli && e.cli.length ? `<br>${ic("alert")} set on the command line (wins over this panel): ${e.cli.join(", ")}` : "") +
    `<br>${r.gpus.length} NVIDIA GPU${r.gpus.length === 1 ? "" : "s"} found · saved in ${r.path}`;
}
async function savePerf() {
  const mode = $("#pfmode").value, ids = [...$("#pfgpus").querySelectorAll("input:checked")].map((x) => x.value);
  if (mode === "advanced" && !ids.length) { toast("pick at least one GPU"); return; }
  const [w, h] = $("#pfcam").value.split("x").map(Number);
  const body = { mode, advanced: { devices: ids.length === PERF.info.gpus.length ? "all" : ids.join(","), width: w, height: h, jpeg: +$("#pfjpeg").value } };
  const r = await (await fetch("/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
  if (!r.ok) { $("#pfmsg").innerHTML = ic("alert") + " " + r.err; return; }
  PERF.info.saved = r.saved;
  $("#pfmsg").textContent = r.restart ? "Saved. Restart DEPTHR to switch GPUs / camera (render scale applies now)." : "Saved.";
  if (!(PERF.info.effective.cli || []).includes("mode")) PERF.mode = mode;
  layout();
}
function buildPerf() {
  $("#pfmode").onchange = perfUi;
  $("#pfseg").querySelectorAll("button").forEach((b) => { b.onclick = () => { $("#pfmode").value = b.dataset.m; perfUi(); }; });
  $("#pfjpeg").oninput = () => { $("#pfjpeg").nextElementSibling.textContent = $("#pfjpeg").value; };
  $("#pfscale").oninput = () => { PERF.rscale = +$("#pfscale").value; $("#pfscale").nextElementSibling.textContent = PERF.rscale.toFixed(2) + "×";
    localStorage.setItem("depthr.rscale", PERF.rscale); layout(); };
  $("#pfsave").onclick = savePerf;
  loadPerf();
}
hydrateIcons(); buildPanel(); buildFxPanel(); buildBake(); buildPerf(); paintRanges(); favUi(); applyPreset(0); loadFavs(); pull(); loop();
