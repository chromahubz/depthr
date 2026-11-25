// =============================================================== Timeline (CapCut-style editor)
// A row of segments: each is a slice (in..out seconds) of a filmed clip plus its own look
// (base preset + library effect + A/B/Mix). Select a segment and whatever you change in the panel
// is stored on it. Play previews the edit live; Export renders every segment frame-exact with its
// look (same size, letterboxed), then the server joins them into one MP4 (optionally one song on top,
// with the audio-reactive FX driven by the song at each segment's place in the edit).
"use strict";
const TL = { segs: [], sel: -1, t: 0, playing: false, pps: 60, open: false, cur: -1, wall: 0, exporting: false, cancel: false,
  applying: false, rec: null, meta: {}, lookIdx: -1, holdT: 0, holdArgs: "", drag: null };
const tlEsc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const tlLen = (g) => g.out - g.in;
const tlDur = () => TL.segs.reduce((s, g) => s + tlLen(g), 0);
const tlStartOf = (i) => TL.segs.slice(0, i).reduce((s, g) => s + tlLen(g), 0);
const tlFmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const tlUid = () => Math.random().toString(36).slice(2, 9);
function tlAt(t) {
  let s = 0;
  for (let i = 0; i < TL.segs.length; i++) {
    const g = TL.segs[i], d = tlLen(g);
    if (t < s + d || i === TL.segs.length - 1) return { i, g, start: s, local: g.in + Math.min(Math.max(t - s, 0), Math.max(0, d - .02)) };
    s += d;
  }
  return null;
}
function curLook() { return { preset: presetIdx, fx: FXS.id || "", a: FXS.a, b: FXS.b, mix: FXS.mix, scene: !!FXS.scene }; }
function lookName(L) { const f = L && L.fx && FX.find((x) => x.id === L.fx); return f ? f.name : (L && PRESETS[L.preset] ? PRESETS[L.preset][0] : "No look"); }
function lookHue(L) { let h = 7; for (const c of String(L.fx || "p" + L.preset)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }
function applyLook(L) {
  if (!L) return;
  TL.applying = true;
  try {
    applyPreset(L.preset ?? 0); setFx(L.fx || "");
    if (L.fx && !L.fx.startsWith("preset-")) { setKnob("A", L.a ?? .5); setKnob("B", L.b ?? .5); setKnob("Mix", L.mix ?? 1); $("#fxscene").checked = FXS.scene = !!L.scene; }
  } finally { TL.applying = false; }
}
// called by app.js whenever the preset, the effect or a knob changes
function tlTouch() {
  if (TL.applying || TL.playing || TL.exporting || !TL.open || TL.sel < 0 || !TL.segs[TL.sel]) return;
  TL.segs[TL.sel].look = curLook(); tlDraw(); tlSave();
}

// ------------------------------------------------------------- persistence
let tlSaveT = 0;
function tlSave() {
  localStorage.setItem("depthr.tl", JSON.stringify(TL.segs));
  clearTimeout(tlSaveT);
  tlSaveT = setTimeout(() => fetch("/project", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, segs: TL.segs, pps: TL.pps }) }).catch(() => {}), 400);
}
async function tlLoad() {
  try { const r = await (await fetch("/project", { cache: "no-store" })).json(); if (!Array.isArray(r.segs)) throw 0; TL.segs = r.segs; if (r.pps) TL.pps = r.pps; }
  catch { try { TL.segs = JSON.parse(localStorage.getItem("depthr.tl") || "[]"); } catch { TL.segs = []; } }
  $("#tlzoom").value = TL.pps; tlDraw();
}
async function tlMeta(p) {
  if (!TL.meta[p]) { const m = await (await fetch("/probe?p=" + encodeURIComponent(p))).json(); if (!m.ok) return m; TL.meta[p] = m; }
  return TL.meta[p];
}

// ------------------------------------------------------------- editing
async function tlAdd(path, at = TL.segs.length) {
  const m = await tlMeta(path); if (!m.ok) { toast(m.err || "cannot open clip"); return; }
  if (!(m.dur > 0)) { toast("clip has no frames"); return; }
  const g = { id: tlUid(), clip: m.path, name: m.name, dur: m.dur, in: 0, out: m.dur, look: curLook() };
  TL.segs.splice(at, 0, g); TL.sel = at; tlDraw(); tlSave(); tlSeek(tlStartOf(at));
}
function tlSplit() {
  const a = tlAt(TL.t); if (!a) return;
  if (a.local - a.g.in < .1 || a.g.out - a.local < .1) { toast("move the playhead inside a clip"); return; }
  const b = { ...a.g, id: tlUid(), in: a.local, look: { ...a.g.look } };
  a.g.out = a.local; TL.segs.splice(a.i + 1, 0, b); TL.sel = a.i + 1; tlDraw(); tlSave();
}
function tlDelete() {
  if (TL.sel < 0) return; TL.segs.splice(TL.sel, 1); TL.sel = Math.min(TL.sel, TL.segs.length - 1);
  TL.t = Math.min(TL.t, tlDur()); TL.lookIdx = -1; tlDraw(); tlSave(); tlPreview(true);
}
function tlDuplicate() {
  if (TL.sel < 0) return; const g = TL.segs[TL.sel];
  TL.segs.splice(TL.sel + 1, 0, { ...g, id: tlUid(), look: { ...g.look } }); TL.sel++; tlDraw(); tlSave();
}
function tlSelect(i, seek = true) {
  TL.sel = i; const g = TL.segs[i];
  if (g) { const s = tlStartOf(i); if (seek && (TL.t < s || TL.t >= s + tlLen(g))) TL.t = s; TL.lookIdx = -1; }
  tlDraw(); tlPreview(true);
}
function tlLookToAll() {
  if (TL.sel < 0) return; const L = TL.segs[TL.sel].look;
  TL.segs.forEach((g) => { g.look = { ...L }; }); tlDraw(); tlSave(); toast("look applied to every clip");
}

// ------------------------------------------------------------- preview / playback
function tlNoMirror() { if (chk("mirror")) $("#mirror").click(); }
function tlSource(g, local, hold) {
  const args = `${g.clip}|${hold ? local.toFixed(2) : "play" + local.toFixed(2)}`;
  if (args === TL.holdArgs) return; TL.holdArgs = args;
  BK.clip = g.clip;
  fetch(`/source?s=${encodeURIComponent(g.clip)}&t=${local.toFixed(3)}${hold ? "&hold=1" : ""}`).catch(() => {});
  plateInit = true; fxClear = true; ghostClear = true;
}
// paused: show the frame under the playhead with its segment's look (throttled while scrubbing)
let tlPrevT = 0;
function tlPreview(force) {
  if (!TL.open || TL.playing || TL.exporting || !TL.segs.length || TL.rec) return;
  const a = tlAt(TL.t); if (!a) return;
  if (a.i !== TL.lookIdx) { TL.lookIdx = a.i; applyLook(a.g.look); }
  clearTimeout(tlPrevT);
  const go = () => { if (TL.playing || TL.exporting) return; tlNoMirror(); tlSource(a.g, a.local, true); };
  if (force) go(); else tlPrevT = setTimeout(go, 90);
}
function tlPlay() {
  if (TL.playing) return tlPause();
  if (!TL.segs.length || TL.exporting || TL.rec) return;
  if (TL.t >= tlDur() - .05) TL.t = 0;
  clearTimeout(tlPrevT); TL.playing = true; TL.cur = -1; TL.holdArgs = ""; TL.wall = performance.now() - TL.t * 1000; tlNoMirror(); tlButtons();
}
function tlPause() { TL.playing = false; TL.cur = -1; TL.lookIdx = -1; TL.holdArgs = ""; tlButtons(); tlPreview(true); }
function tlSeek(t) {
  TL.t = Math.max(0, Math.min(t, tlDur()));
  if (TL.playing) { TL.wall = performance.now() - TL.t * 1000; TL.cur = -1; TL.holdArgs = ""; }
  else tlPreview(false);
  tlHead();
}
function tlTick() { requestAnimationFrame(tlTick); tlStep(); }
function tlStep() {
  if (!TL.playing) return;
  TL.t = (performance.now() - TL.wall) / 1000;
  if (TL.t >= tlDur()) { TL.t = tlDur(); tlPause(); tlHead(); return; }
  const a = tlAt(TL.t);
  if (a && a.i !== TL.cur) { TL.cur = a.i; TL.sel = a.i; applyLook(a.g.look); tlSource(a.g, a.local, false); tlDraw(); }
  tlHead();
}

// ------------------------------------------------------------- record from the webcam
async function tlRec() {
  if (TL.rec) {
    const r = await (await fetch("/record/stop")).json(); TL.rec = null; tlButtons();
    if (!r.ok) { toast(r.err || "recording failed"); return; }
    toast(`recorded ${r.dur.toFixed(1)} s`); await refreshClips(); await tlAdd(r.path);
    return;
  }
  if (TL.playing) tlPause();
  TL.holdArgs = ""; toast("starting camera…");
  const s = await (await fetch("/source?s=auto")).json(); if (!s.ok) { toast(s.err); return; }
  BK.clip = ""; plateInit = true; if (!chk("mirror")) $("#mirror").click();
  const r = await (await fetch("/record/start")).json(); if (!r.ok) { toast(r.err); return; }
  TL.rec = { t0: performance.now() }; tlButtons(); toast("recording camera");
}

// ------------------------------------------------------------- export
async function tlExport() {
  if (TL.exporting) { TL.cancel = true; BK.cancel = true; return; }
  if (!TL.segs.length) { toast("add clips first"); return; }
  if (BK.on || TL.rec) return;
  if (TL.playing) tlPause();
  const m0 = await tlMeta(TL.segs[0].clip); if (!m0.ok) { toast(m0.err); return; }
  const maxw = +$("#bksize").value || m0.w, W = Math.round(Math.min(maxw, m0.w) / 2) * 2, H = Math.round(m0.h * W / m0.w / 2) * 2;
  const song = BK.song || "", parts = []; let off = 0, fail = "";
  TL.exporting = true; TL.cancel = false; tlButtons();
  for (let i = 0; i < TL.segs.length && !TL.cancel; i++) {
    const g = TL.segs[i]; TL.sel = i; tlDraw();
    applyLook(g.look);
    tlStatus(`Rendering clip ${i + 1} of ${TL.segs.length}…`);
    const r = await bake({ clip: g.clip, start: g.in, end: g.out, fit: `${W}x${H}`, fps: Math.min(60, Math.round(m0.fps) || 30), silent: true, song, songOff: song ? off : -1,
      alpha: "", tag: `tl${String(i + 1).padStart(2, "0")}`, quiet: true, label: `Clip ${i + 1}/${TL.segs.length} · ` });
    if (TL.cancel || !r || r.cancelled) { fail = "cancelled"; break; }
    if (r.err || !r.ok || !r.out) { fail = r.err || "render failed"; break; }
    parts.push(r.out); off += tlLen(g);
  }
  let res = null;
  if (!fail) {
    tlStatus("Joining clips…");
    res = await (await fetch("/concat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: parts, song }) })).json();
    if (!res.ok) fail = res.err;
  } else if (parts.length) fetch("/concat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files: parts, discard: true }) });
  TL.exporting = false; tlButtons(); TL.lookIdx = -1; TL.holdArgs = "";
  if (fail) tlStatus((fail === "cancelled" ? "" : ic("alert") + " ") + fail);
  else {
    BK.last = res.out;
    tlStatus(`${ic("check")} <b>${tlEsc(res.out.split(/[\\/]/).pop())}</b> · <a href="#" id="tlreveal">show file</a>`);
    $("#tlreveal").onclick = (e) => { e.preventDefault(); fetch("/reveal?p=" + encodeURIComponent(res.out)); };
    toast("timeline exported");
  }
  setTimeout(() => tlPreview(true), 400);
}
function tlStatus(h) { $("#tlstat").innerHTML = h; }

// ------------------------------------------------------------- drawing
function tlButtons() {
  const has = TL.segs.length > 0, busy = TL.exporting;
  $("#tlplay").innerHTML = ic(TL.playing ? "pause" : "play"); $("#tlplay").disabled = !has || busy || !!TL.rec;
  for (const id of ["tlsplit", "tldup", "tldel", "tlall"]) $("#" + id).disabled = !has || busy || (id !== "tlsplit" && TL.sel < 0);
  $("#tladd").disabled = busy; $("#tlrec").disabled = busy;
  $("#tlrec").classList.toggle("live", !!TL.rec);
  $("#tlrec").innerHTML = ic(TL.rec ? "stop" : "record") + (TL.rec ? "Stop" : "Rec camera");
  $("#tlexport").innerHTML = ic(busy ? "x" : "render") + (busy ? "Cancel" : "Export");
  $("#tlexport").disabled = !has && !busy;
}
function tlHead() {
  const x = TL.t * TL.pps; $("#tlhead").style.transform = `translateX(${x}px)`;
  $("#tltime").innerHTML = `<b>${tlFmt(TL.t)}</b> / ${tlFmt(tlDur())}` + (TL.rec ? ` <span class="recdot">REC ${tlFmt((performance.now() - TL.rec.t0) / 1000)}</span>` : "");
  if (TL.playing) { const sc = $("#tlscroll"); if (x > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = x - 80; }
}
function tlRuler(total) {
  const steps = [.5, 1, 2, 5, 10, 15, 30, 60, 120], step = steps.find((s) => s * TL.pps >= 64) || 120;
  let h = ""; const end = Math.max(total + 10, $("#tlscroll").clientWidth / TL.pps);
  for (let t = 0; t <= end; t += step) h += `<span style="left:${t * TL.pps}px">${tlFmt(t).replace(/\.0$/, "")}</span>`;
  $("#tlruler").innerHTML = h; $("#tlruler").style.width = end * TL.pps + "px";
}
function tlDraw() {
  const tr = $("#tltrack"); if (!tr) return;
  const total = tlDur(); let x = 0, h = "";
  TL.segs.forEach((g, i) => {
    const d = tlLen(g), w = Math.max(8, d * TL.pps), n = Math.max(1, Math.min(16, Math.round(w / 92)));
    let th = ""; for (let k = 0; k < n; k++) th += `<img draggable="false" src="/thumb?p=${encodeURIComponent(g.clip)}&t=${(Math.round((g.in + (k + .5) / n * d) * 2) / 2).toFixed(1)}&h=64" alt="">`;
    h += `<div class="seg${i === TL.sel ? " sel" : ""}" data-i="${i}" style="left:${x}px;width:${w}px;--h:${lookHue(g.look)}">
      <div class="th">${th}</div><div class="lbl"><span class="lk">${ic("sparkle")}${tlEsc(lookName(g.look))}</span><span class="nm">${tlEsc(g.name)} · ${d.toFixed(1)} s</span></div>
      <i class="hd l" data-side="l"></i><i class="hd r" data-side="r"></i></div>`;
    x += w;
  });
  tr.innerHTML = h || `<div class="empty">${ic("film")}Add a clip or record your camera to start editing</div>`;
  tr.style.width = Math.max(x + 300, $("#tlscroll").clientWidth) + "px";
  tlRuler(total); tlHead(); tlButtons();
  const s = TL.sel >= 0 && TL.segs[TL.sel];
  $("#tlsel").innerHTML = s ? `Selected: <b>${tlEsc(s.name)}</b> · ${tlLen(s).toFixed(1)} s · look <b>${tlEsc(lookName(s.look))}</b> — change the effect, preset or knobs in the panel to restyle it` :
    (TL.segs.length ? "Click a clip to select it and give it its own look" : "");
}

// ------------------------------------------------------------- pointer: scrub, select, trim, reorder
function tlPointer() {
  const sc = $("#tlscroll"), xAt = (e) => e.clientX - sc.getBoundingClientRect().left + sc.scrollLeft - 12;   // 12 = left padding
  sc.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || TL.exporting) return;
    const hd = e.target.closest(".hd"), seg = e.target.closest(".seg");
    sc.setPointerCapture(e.pointerId);
    if (hd && seg) { const i = +seg.dataset.i, g = TL.segs[i]; TL.drag = { mode: "trim", i, side: hd.dataset.side, x0: xAt(e), in0: g.in, out0: g.out }; tlSelect(i, false); return; }
    if (seg) { const i = +seg.dataset.i; TL.drag = { mode: "move", i, x0: xAt(e), el: seg, moved: false }; if (i !== TL.sel) tlSelect(i); return; }
    TL.drag = { mode: "scrub" }; tlSeek(xAt(e) / TL.pps);
  });
  sc.addEventListener("pointermove", (e) => {
    const D = TL.drag; if (!D) return;
    if (D.mode === "scrub") { tlSeek(xAt(e) / TL.pps); return; }
    const dx = xAt(e) - D.x0;
    if (D.mode === "trim") {
      const g = TL.segs[D.i], dt = dx / TL.pps, dur = g.dur || (TL.meta[g.clip] || {}).dur || g.out;
      if (D.side === "l") { g.in = Math.max(0, Math.min(D.in0 + dt, g.out - .2)); TL.t = tlStartOf(D.i); }
      else { g.out = Math.min(dur, Math.max(D.out0 + dt, g.in + .2)); TL.t = tlStartOf(D.i) + tlLen(g) - .02; }
      tlDraw(); tlPreview(false); return;
    }
    if (D.mode === "move" && (D.moved || Math.abs(dx) > 5)) { D.moved = true; D.el.classList.add("drag"); D.el.style.transform = `translateX(${dx}px)`; D.dx = dx; }
  });
  const up = () => {
    const D = TL.drag; TL.drag = null; if (!D) return;
    if (D.mode === "trim") { tlSave(); tlPreview(true); }
    if (D.mode === "move" && D.moved) {
      const g = TL.segs[D.i], mid = tlStartOf(D.i) * TL.pps + D.dx + tlLen(g) * TL.pps / 2;
      TL.segs.splice(D.i, 1); let s = 0, to = TL.segs.length;
      for (let k = 0; k < TL.segs.length; k++) { const w = tlLen(TL.segs[k]) * TL.pps; if (mid < s + w / 2) { to = k; break; } s += w; }
      TL.segs.splice(to, 0, g); TL.sel = to; TL.lookIdx = -1; tlDraw(); tlSave(); tlPreview(true);
    }
  };
  sc.addEventListener("pointerup", up); sc.addEventListener("pointercancel", up);
  sc.addEventListener("wheel", (e) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); tlZoom(TL.pps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e); }
    else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); sc.scrollLeft += e.deltaY; }
  }, { passive: false });
}
function tlZoom(pps, e) {
  const sc = $("#tlscroll"), ax = e ? e.clientX - sc.getBoundingClientRect().left : sc.clientWidth / 2, at = (sc.scrollLeft + ax) / TL.pps;
  TL.pps = Math.max(8, Math.min(240, pps)); $("#tlzoom").value = TL.pps; paintRange($("#tlzoom"));
  tlDraw(); sc.scrollLeft = at * TL.pps - ax; tlSave();
}

// ------------------------------------------------------------- add-clip menu, keys, open/close
async function tlMenu() {
  const m = $("#tlmenu");
  if (!m.hidden) { m.hidden = true; return; }
  const r = await (await fetch("/clips")).json();
  m.innerHTML = `<label class="it up"><input type="file" id="tlfile" accept="video/*" multiple hidden>${ic("upload")}Upload video…</label>` +
    (r.clips.length ? r.clips.map((c) => `<button class="it" data-p="${tlEsc(c.path)}">${ic("film")}<span>${tlEsc(c.name)}</span><small>${c.mb} MB</small></button>`).join("")
      : `<div class="it none">No filmed clips yet</div>`);
  m.hidden = false;
  m.querySelectorAll("button[data-p]").forEach((b) => { b.onclick = () => { m.hidden = true; tlAdd(b.dataset.p); }; });
  $("#tlfile").onchange = async (e) => { m.hidden = true; for (const f of e.target.files) { const p = await upload(f); if (p) await tlAdd(p); } refreshClips(); };
}
function tlKey(e) {
  if (e.target.tagName === "INPUT" && e.target.type !== "range" && e.target.type !== "checkbox") return false;
  const k = e.key.toLowerCase(), ctl = e.ctrlKey || e.metaKey;
  if (k === "e" && !ctl) { tlToggle(); return true; }
  if (!TL.open) return false;
  if (k === " ") { e.preventDefault(); tlPlay(); return true; }
  if (ctl && k === "b") { e.preventDefault(); tlSplit(); return true; }
  if (ctl && k === "d") { e.preventDefault(); tlDuplicate(); return true; }
  if ((k === "delete" || k === "backspace") && TL.sel >= 0) { e.preventDefault(); tlDelete(); return true; }
  return false;
}
function tlToggle(open = !TL.open) {
  TL.open = open; $("#tl").hidden = !open; $("#tltoggle").classList.toggle("on", open);
  localStorage.setItem("depthr.tlopen", open ? "1" : "0");
  if (!open && TL.playing) tlPause();
  dispatchEvent(new Event("resize")); tlDraw();
  if (open) { TL.lookIdx = -1; TL.holdArgs = ""; tlPreview(true); }
}
function buildTimeline() {
  hydrateIcons($("#tl")); hydrateIcons($("#tltoggle").parentElement);
  $("#tltoggle").onclick = () => tlToggle();
  $("#tlplay").onclick = tlPlay; $("#tlsplit").onclick = tlSplit; $("#tldup").onclick = tlDuplicate; $("#tldel").onclick = tlDelete;
  $("#tlall").onclick = tlLookToAll; $("#tlrec").onclick = tlRec; $("#tlexport").onclick = tlExport; $("#tladd").onclick = tlMenu;
  $("#tlzoom").oninput = (e) => tlZoom(+e.target.value);
  document.addEventListener("pointerdown", (e) => { const m = $("#tlmenu"); if (!m.hidden && !e.target.closest("#tlmenu,#tladd")) m.hidden = true; });
  const tl = $("#tl");   // drop videos straight onto the timeline
  tl.addEventListener("dragover", (e) => e.preventDefault());
  tl.addEventListener("drop", async (e) => { e.preventDefault(); for (const f of e.dataTransfer.files) if (/^video\//.test(f.type) || /\.(mp4|mov|mkv|webm|avi|m4v)$/i.test(f.name)) { const p = await upload(f); if (p) await tlAdd(p); } refreshClips(); });
  tlPointer(); tlLoad(); tlTick();
  setInterval(() => { if (TL.rec) tlHead(); }, 250);
  if (localStorage.getItem("depthr.tlopen") === "1") tlToggle(true);
}
buildTimeline();
