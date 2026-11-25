// =============================================================== Timeline (CapCut-style editor)
// A row of segments: each is a slice (in..out seconds) of a filmed clip plus its own look
// (base preset + library effect + A/B/Mix). Select a segment and deliberate changes in the panel
// (not auto-cycle or gestures) are stored on it. Play previews the edit live through the source switch
// (media.js); Export renders every segment frame-exact with its look (same size, rate and timebase)
// and the server joins them, optionally with one song whose beats drive each segment at its place.
"use strict";
const TL = { segs: [], sel: -1, t: 0, playing: false, pps: 60, open: false, cur: -1, wall: 0, exporting: false, cancel: false,
  applying: false, rec: null, meta: {}, lookIdx: -1, drag: null, panelLook: null,
  exp: { size: 1920, q: 18, alpha: "" } };
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
// a clip is being styled: deliberate panel changes go to it; auto-cycle and gestures hold still
function tlEditing() { return TL.open && TL.sel >= 0 && !!TL.segs[TL.sel] && !TL.playing && !TL.exporting; }
// called by app.js whenever the preset, the effect or a knob changes
function tlTouch() {
  if (TL.applying || !tlEditing()) return;
  tlSnap("look"); TL.segs[TL.sel].look = curLook(); tlDraw(); tlSave();
}

// ------------------------------------------------------------- undo / redo (whole-timeline snapshots)
const UNDO = [], REDO = []; let lastSnap = { k: "", t: 0, i: -1 };
const tlState = () => JSON.stringify({ segs: TL.segs, sel: TL.sel });
function tlSnap(kind, state) {   // call before a change; rapid knob moves on one clip collapse into one step
  const t = performance.now();
  if (kind === "look" && lastSnap.k === "look" && lastSnap.i === TL.sel && t - lastSnap.t < 1200) { lastSnap.t = t; return; }
  UNDO.push(state || tlState()); if (UNDO.length > 150) UNDO.shift(); REDO.length = 0;
  lastSnap = { k: kind, t, i: TL.sel }; tlButtons();
}
function tlRestore(s) {
  const o = JSON.parse(s); TL.segs = o.segs; TL.sel = Math.min(o.sel, TL.segs.length - 1);
  TL.t = Math.min(TL.t, tlDur()); TL.lookIdx = -1; lastSnap = { k: "", t: 0, i: -1 };
  tlDraw(); tlSave(); tlPreview(true);
}
function tlUndo() { if (!UNDO.length || TL.exporting) return; REDO.push(tlState()); tlRestore(UNDO.pop()); toast("undo"); }
function tlRedo() { if (!REDO.length || TL.exporting) return; UNDO.push(tlState()); tlRestore(REDO.pop()); toast("redo"); }

// ------------------------------------------------------------- persistence
let tlSaveT = 0;
function tlSave() {
  localStorage.setItem("depthr.tl", JSON.stringify(TL.segs));
  clearTimeout(tlSaveT);
  tlSaveT = setTimeout(() => fetch("/project", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version: 1, segs: TL.segs, pps: TL.pps, exp: TL.exp }) }).catch(() => {}), 400);
}
async function tlLoad() {
  try {
    const r = await (await fetch("/project", { cache: "no-store" })).json(); if (!Array.isArray(r.segs)) throw 0;
    TL.segs = r.segs; if (r.pps) TL.pps = r.pps; if (r.exp) Object.assign(TL.exp, r.exp);
  } catch { try { TL.segs = JSON.parse(localStorage.getItem("depthr.tl") || "[]"); } catch { TL.segs = []; } }
  $("#tlzoom").value = TL.pps; paintRange($("#tlzoom")); tlExpUi(); tlDraw();
}
async function tlMeta(p) {
  if (!TL.meta[p]) { const m = await (await fetch("/probe?p=" + encodeURIComponent(p))).json(); if (!m.ok) return m; TL.meta[p] = m; }
  return TL.meta[p];
}

// ------------------------------------------------------------- editing
async function tlAdd(path, at = TL.segs.length, inT = 0, outT = 0) {
  const m = await tlMeta(path); if (!m.ok) { toast(m.err || "cannot open clip"); return; }
  if (!(m.dur > 0)) { toast("clip has no frames"); return; }
  const a = Math.max(0, Math.min(inT || 0, m.dur - .2)), b = outT > a ? Math.min(outT, m.dur) : m.dur;
  tlSnap("add");
  const g = { id: tlUid(), clip: m.path, name: m.name, dur: m.dur, in: a, out: b, look: curLook() };
  TL.segs.splice(at, 0, g); TL.sel = at; tlDraw(); tlSave(); tlSeek(tlStartOf(at));
}
function tlSplit() {
  const a = tlAt(TL.t); if (!a) return;
  if (a.local - a.g.in < .1 || a.g.out - a.local < .1) { toast("move the playhead inside a clip"); return; }
  tlSnap("split");
  const b = { ...a.g, id: tlUid(), in: a.local, look: { ...a.g.look } };
  a.g.out = a.local; TL.segs.splice(a.i + 1, 0, b); TL.sel = a.i + 1; tlDraw(); tlSave();
}
function tlDelete() {
  if (TL.sel < 0) return; tlSnap("delete");
  TL.segs.splice(TL.sel, 1); TL.sel = Math.min(TL.sel, TL.segs.length - 1);
  TL.t = Math.min(TL.t, tlDur()); TL.lookIdx = -1; tlDraw(); tlSave(); tlPreview(true);
}
function tlDuplicate() {
  if (TL.sel < 0) return; tlSnap("dup"); const g = TL.segs[TL.sel];
  TL.segs.splice(TL.sel + 1, 0, { ...g, id: tlUid(), look: { ...g.look } }); TL.sel++; tlDraw(); tlSave();
}
function tlSelect(i, seek = true) {
  TL.sel = i; const g = TL.segs[i];
  if (g) { const s = tlStartOf(i); if (seek && (TL.t < s || TL.t >= s + tlLen(g))) TL.t = s; TL.lookIdx = -1; }
  tlDraw(); tlPreview(true);
}
function tlDeselect() { if (TL.sel < 0) return; TL.sel = -1; tlDraw(); toast("panel no longer edits a clip"); }
function tlLookToAll() {
  if (TL.sel < 0) return; tlSnap("lookall"); const L = TL.segs[TL.sel].look;
  TL.segs.forEach((g) => { g.look = { ...L }; }); tlDraw(); tlSave(); toast("look applied to every clip");
}

// ------------------------------------------------------------- preview / playback (through the source switch)
let tlPrevT = 0;
function tlPreview(force) {   // paused: the frame under the playhead with its clip's look
  if (!TL.open || TL.playing || TL.exporting || !TL.segs.length || TL.rec) return;
  const a = tlAt(TL.t); if (!a) return;
  if (a.i !== TL.lookIdx) { TL.lookIdx = a.i; applyLook(a.g.look); }
  clearTimeout(tlPrevT);
  const go = () => { if (!TL.playing && !TL.exporting && !TL.rec) srcTimeline(a.g.clip, a.local, true, force); };
  if (force) go(); else tlPrevT = setTimeout(go, 90);
}
function tlPlay() {
  if (TL.playing) return tlPause();
  if (!TL.segs.length || TL.exporting || TL.rec) return;
  if (TL.t >= tlDur() - .05) TL.t = 0;
  clearTimeout(tlPrevT); TL.playing = true; TL.cur = -1; TL.wall = performance.now() - TL.t * 1000; tlButtons(); tlDraw();
}
function tlPause() { TL.playing = false; TL.cur = -1; TL.lookIdx = -1; tlButtons(); tlDraw(); tlPreview(true); }
function tlSeek(t) {
  TL.t = Math.max(0, Math.min(t, tlDur()));
  if (TL.playing) { TL.wall = performance.now() - TL.t * 1000; TL.cur = -1; }
  else tlPreview(false);
  tlHead();
}
function tlTick() { requestAnimationFrame(tlTick); tlStep(); }
function tlStep() {
  if (!TL.playing) return;
  TL.t = (performance.now() - TL.wall) / 1000;
  if (TL.t >= tlDur()) { TL.t = tlDur(); tlPause(); tlHead(); return; }
  const a = tlAt(TL.t);
  if (a && a.i !== TL.cur) { TL.cur = a.i; TL.sel = a.i; applyLook(a.g.look); srcTimeline(a.g.clip, a.local, false, true); tlDraw(); }
  tlHead();
}

// ------------------------------------------------------------- record a clip from the webcam
async function tlRec() {
  if (TL.rec) {
    const r = await (await fetch("/record/stop")).json(); TL.rec = null; tlButtons();
    if (!r.ok) { toast(r.err || "recording failed"); return; }
    toast(`recorded ${r.dur.toFixed(1)} s`); await refreshClips(); await tlAdd(r.path);
    return;
  }
  if (TL.playing) tlPause();
  if (SRC.mode !== "cam") { toast("starting camera…"); if (!(await srcCamera())) return; }
  const r = await (await fetch("/record/start")).json(); if (!r.ok) { toast(r.err); return; }
  TL.rec = { t0: performance.now() }; tlButtons(); toast("recording clip");
}

// ------------------------------------------------------------- export (popup with its own settings)
function tlExpUi() {
  $("#txsize").value = String(TL.exp.size); $("#txq").value = String(TL.exp.q);
  const cut = chk("cut"); $("#txalpha").disabled = !cut; $("#txalpha").value = cut ? TL.exp.alpha : "";
  $("#txalphanote").textContent = cut ? "Transparent exports keep only you (and your glow)." : "Turn on “Only me, no background” in View to export with transparency.";
  songUi();
}
function tlExpMenu(show = $("#tlexp").hidden) { if (TL.exporting) return; $("#tlmenu").hidden = true; $("#tlexp").hidden = !show; if (show) tlExpUi(); }
async function tlExport() {
  if (TL.exporting) { TL.cancel = true; BK.cancel = true; return; }
  $("#tlexp").hidden = true;
  if (!TL.segs.length) { toast("add clips first"); return; }
  if (BK.on || TL.rec) return;
  if (TL.playing) tlPause();
  const m0 = await tlMeta(TL.segs[0].clip); if (!m0.ok) { toast(m0.err); return; }
  const maxw = +TL.exp.size || m0.w, W = Math.round(Math.min(maxw, m0.w) / 2) * 2, H = Math.round(m0.h * W / m0.w / 2) * 2;
  const alpha = chk("cut") ? TL.exp.alpha : "", song = BK.song || "", parts = []; let off = 0, fail = "";
  TL.exporting = true; TL.cancel = false; tlButtons(); tlDraw();
  for (let i = 0; i < TL.segs.length && !TL.cancel; i++) {
    const g = TL.segs[i]; TL.sel = i; tlDraw();
    applyLook(g.look);
    tlStatus(`Rendering clip ${i + 1} of ${TL.segs.length}…`);
    const r = await bake({ clip: g.clip, start: g.in, end: g.out, fit: `${W}x${H}`, fps: Math.min(60, Math.round(m0.fps) || 30), silent: true,
      song, songOff: song ? off : -1, alpha, crf: TL.exp.q, tag: `tl${String(i + 1).padStart(2, "0")}`, quiet: true, label: `Clip ${i + 1}/${TL.segs.length} · ` });
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
  TL.exporting = false; TL.lookIdx = -1; tlButtons(); tlDraw();
  if (fail) tlStatus((fail === "cancelled" ? "Export cancelled" : ic("alert") + " " + escH(fail)));
  else {
    BK.last = res.out;
    tlStatus(`${ic("check")} <b>${escH(baseName(res.out))}</b> · <a href="#" id="tlreveal">show file</a>`);
    $("#tlreveal").onclick = (e) => { e.preventDefault(); fetch("/reveal?p=" + encodeURIComponent(res.out)); };
    toast("timeline exported");
  }
  setTimeout(() => tlPreview(true), 300);
}
function tlStatus(h) { $("#tlstat").innerHTML = h; }

// ------------------------------------------------------------- drawing
function tlButtons() {
  const has = TL.segs.length > 0, busy = TL.exporting, rec = !!TL.rec;
  $("#tlplay").innerHTML = ic(TL.playing ? "pause" : "play"); $("#tlplay").disabled = !has || busy || rec;
  for (const id of ["tlsplit", "tldup", "tldel", "tlall"]) $("#" + id).disabled = !has || busy || rec || (id !== "tlsplit" && TL.sel < 0);
  $("#tlundo").disabled = !UNDO.length || busy; $("#tlredo").disabled = !REDO.length || busy;
  $("#tladd").disabled = busy || rec; $("#tlrec").disabled = busy;
  $("#tlrec").classList.toggle("live", rec);
  $("#tlrec").innerHTML = ic(rec ? "stop" : "record") + (rec ? "Stop" : "Record clip");
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
function tlBanner() {   // the Effects panel says when it is styling a clip
  const b = $("#editing"), g = tlEditing() && TL.segs[TL.sel];
  b.hidden = !g;
  if (g) $("#editingtxt").innerHTML = `Styling <b>clip ${TL.sel + 1}</b> · ${escH(g.name)}<small>Changes here apply to this clip. Esc to stop.</small>`;
}
function tlDraw() {
  const tr = $("#tltrack"); if (!tr) return;
  const total = tlDur(); let x = 0, h = "";
  TL.segs.forEach((g, i) => {
    const d = tlLen(g), w = Math.max(8, d * TL.pps), n = Math.max(1, Math.min(16, Math.round(w / 92)));
    let th = ""; for (let k = 0; k < n; k++) th += `<img draggable="false" src="/thumb?p=${encodeURIComponent(g.clip)}&t=${(Math.round((g.in + (k + .5) / n * d) * 2) / 2).toFixed(1)}&h=64" alt="">`;
    h += `<div class="seg${i === TL.sel ? " sel" : ""}" data-i="${i}" style="left:${x}px;width:${w}px;--h:${lookHue(g.look)}">
      <div class="th">${th}</div><div class="lbl"><span class="lk">${ic("sparkle")}${escH(lookName(g.look))}</span><span class="nm">${i + 1} · ${escH(g.name)} · ${d.toFixed(1)} s</span></div>
      <i class="hd l" data-side="l"></i><i class="hd r" data-side="r"></i></div>`;
    x += w;
  });
  tr.innerHTML = h || `<div class="empty">${ic("film")}Drop videos here, use Add clip, or Record clip to start editing</div>`;
  tr.style.width = Math.max(x + 300, $("#tlscroll").clientWidth) + "px";
  tlRuler(total); tlHead(); tlButtons(); tlBanner();
  const s = TL.sel >= 0 && TL.segs[TL.sel];
  $("#tlsel").innerHTML = TL.playing ? "Playing · Space to pause" : s ? `Clip ${TL.sel + 1} selected · <b>${escH(lookName(s.look))}</b> · ${tlLen(s).toFixed(1)} s` :
    (TL.segs.length ? "Click a clip to style it" : "");
}

// ------------------------------------------------------------- pointer: scrub, select, trim, reorder
function tlPointer() {
  const sc = $("#tlscroll"), xAt = (e) => e.clientX - sc.getBoundingClientRect().left + sc.scrollLeft - 12;   // 12 = left padding
  sc.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || TL.exporting) return;
    const hd = e.target.closest(".hd"), seg = e.target.closest(".seg");
    sc.setPointerCapture(e.pointerId);
    if (hd && seg) { const i = +seg.dataset.i, g = TL.segs[i]; TL.drag = { mode: "trim", i, side: hd.dataset.side, x0: xAt(e), in0: g.in, out0: g.out, before: tlState() }; tlSelect(i, false); return; }
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
    if (D.mode === "trim") { const g = TL.segs[D.i]; if (g.in !== D.in0 || g.out !== D.out0) tlSnap("trim", D.before); tlSave(); tlPreview(true); }
    if (D.mode === "move" && D.moved) {
      tlSnap("move");
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

// ------------------------------------------------------------- add-clip menu (shared media list), keys, open/close
async function tlMenu() {
  const m = $("#tlmenu");
  if (!m.hidden) { m.hidden = true; return; }
  $("#tlexp").hidden = true; await refreshClips();
  m.innerHTML = `<label class="it up"><input type="file" id="tlfile" accept="video/*,audio/*" multiple hidden>${ic("upload")}Upload videos…</label>` +
    (MEDIA.length ? MEDIA.map((c) => `<button class="it" data-p="${escH(c.path)}"><img src="/thumb?p=${encodeURIComponent(c.path)}&t=1.0&h=64" alt=""><span>${escH(c.name)}</span><small>${c.mb} MB</small></button>`).join("")
      : `<div class="it none">No filmed clips yet</div>`);
  m.hidden = false;
  m.querySelectorAll("button[data-p]").forEach((b) => { b.onclick = () => { m.hidden = true; tlAdd(b.dataset.p); }; });
  $("#tlfile").onchange = (e) => { m.hidden = true; importFiles([...e.target.files], "timeline"); e.target.value = ""; };
}
function tlKey(e) {
  if (e.target.tagName === "INPUT" && e.target.type !== "range" && e.target.type !== "checkbox") return false;
  const k = e.key.toLowerCase(), ctl = e.ctrlKey || e.metaKey;
  if (k === "e" && !ctl) { tlToggle(); return true; }
  if (!TL.open) return false;
  if (k === " ") { e.preventDefault(); tlPlay(); return true; }
  if (k === "escape") { if (!$("#tlexp").hidden || !$("#tlmenu").hidden) { $("#tlexp").hidden = $("#tlmenu").hidden = true; return true; } if (TL.sel >= 0) { tlDeselect(); return true; } return false; }
  if (ctl && k === "z" && !e.shiftKey) { e.preventDefault(); tlUndo(); return true; }
  if (ctl && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); tlRedo(); return true; }
  if (ctl && k === "b") { e.preventDefault(); tlSplit(); return true; }
  if (ctl && k === "d") { e.preventDefault(); tlDuplicate(); return true; }
  if ((k === "delete" || k === "backspace") && TL.sel >= 0) { e.preventDefault(); tlDelete(); return true; }
  return false;
}
function tlToggle(open = !TL.open) {
  if (open === TL.open) return;
  TL.open = open; $("#tl").hidden = !open; $("#tltoggle").classList.toggle("on", open);
  localStorage.setItem("depthr.tlopen", open ? "1" : "0");
  if (open) {
    TL.panelLook = curLook(); TL.lookIdx = -1;   // the timeline takes over the picture; your own look comes back on close
    dispatchEvent(new Event("resize")); tlDraw(); tlPreview(true);
  } else {
    if (TL.playing) { TL.playing = false; TL.cur = -1; }
    $("#tlmenu").hidden = $("#tlexp").hidden = true;
    if (TL.panelLook) { TL.applying = true; try { applyLook(TL.panelLook); } finally { TL.applying = false; } }
    srcLeaveTimeline(); dispatchEvent(new Event("resize")); tlBanner();
  }
}
function buildTimeline() {
  hydrateIcons($("#tl")); hydrateIcons($("#tltoggle").parentElement);
  $("#tltoggle").onclick = () => tlToggle();
  $("#tlplay").onclick = tlPlay; $("#tlsplit").onclick = tlSplit; $("#tldup").onclick = tlDuplicate; $("#tldel").onclick = tlDelete;
  $("#tlundo").onclick = tlUndo; $("#tlredo").onclick = tlRedo;
  $("#tlall").onclick = tlLookToAll; $("#tlrec").onclick = tlRec; $("#tladd").onclick = tlMenu;
  $("#tlexport").onclick = () => (TL.exporting ? tlExport() : tlExpMenu());
  $("#txgo").onclick = tlExport;
  $("#txsize").onchange = (e) => { TL.exp.size = +e.target.value; tlSave(); };
  $("#txq").onchange = (e) => { TL.exp.q = +e.target.value; tlSave(); };
  $("#txalpha").onchange = (e) => { TL.exp.alpha = e.target.value; tlSave(); };
  $("#txsongf").onchange = async (e) => { const f = e.target.files[0]; e.target.value = ""; if (!f) return; const p = await upload(f); if (p) setSong(p); };
  $("#txsongx").onclick = () => setSong("");
  $("#editingx").onclick = tlDeselect;
  $("#tlzoom").oninput = (e) => tlZoom(+e.target.value);
  document.addEventListener("pointerdown", (e) => {
    if (!$("#tlmenu").hidden && !e.target.closest("#tlmenu,#tladd")) $("#tlmenu").hidden = true;
    if (!$("#tlexp").hidden && !e.target.closest("#tlexp,#tlexport")) $("#tlexp").hidden = true;
  });
  tlPointer(); tlLoad(); tlTick();
  setInterval(() => { if (TL.rec) tlHead(); }, 250);
  if (localStorage.getItem("depthr.tlopen") === "1") tlToggle(true);
}
buildTimeline();
