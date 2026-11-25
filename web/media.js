// =============================================================== what's on screen + media import
// One switch decides what the server feeds the picture: the live camera, a clip preview (Film to FX)
// or the timeline (a held frame or playback). Every feature goes through it, so the HUD chip is always
// right, closing the timeline returns to whatever was on before, and renders can put the picture back.
"use strict";
const SRC = { mode: "cam", clip: "", t: 0, hold: false, before: null, key: "", pending: "" };
const escH = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const baseName = (p) => String(p || "").split(/[\\/]/).pop();
async function srcGo(spec, t = 0, hold = false) {
  let r;
  try { r = await (await fetch(`/source?s=${encodeURIComponent(spec)}${t ? "&t=" + t.toFixed(3) : ""}${hold ? "&hold=1" : ""}`)).json(); }
  catch { r = { ok: false, err: "server offline" }; }
  if (!r.ok) toast(r.err || "cannot switch source");
  plateInit = true; fxClear = true; ghostClear = true;
  return r.ok;
}
async function srcCamera(spec = "auto") {
  SRC.pending = "LIVE";   // opening a webcam can take a few seconds; the chip says so meanwhile
  const ok = await srcGo(spec); SRC.pending = "";
  if (!ok) return false;
  Object.assign(SRC, { mode: "cam", clip: "", key: "", before: null });
  if (!chk("mirror")) $("#mirror").click(); $("#src").value = spec;
  return true;
}
async function srcClip(path) {
  if (!(await srcGo(path))) return false;
  Object.assign(SRC, { mode: "clip", clip: path, key: "", before: null });
  if (chk("mirror")) $("#mirror").click(); $("#src").value = path;   // filmed footage is already the right way round
  return true;
}
// timeline frames (held while paused/scrubbing, running while playing); entering remembers what was on screen
function srcTimeline(clip, t, hold, force) {
  const key = `${clip}|${hold ? t.toFixed(2) : "play" + t.toFixed(2)}`;
  if (!force && SRC.mode === "timeline" && key === SRC.key) return;
  if (SRC.mode !== "timeline") SRC.before = { mode: SRC.mode, clip: SRC.clip };
  Object.assign(SRC, { mode: "timeline", clip, t, hold, key });
  if (chk("mirror")) $("#mirror").click();
  srcGo(clip, t, hold);
}
async function srcLeaveTimeline() {
  if (SRC.mode !== "timeline") return;
  const b = SRC.before || { mode: "cam" };
  if (b.mode === "clip" && b.clip) await srcClip(b.clip); else await srcCamera();
}
// after an offline render: the server showed a held frame only once, so fetch it again
function srcRefresh() { if (SRC.mode === "timeline") srcTimeline(SRC.clip, SRC.t, SRC.hold, true); }
function srcChip() {
  if (typeof TL !== "undefined" && TL.rec) return `<span class="pill rec">${ic("record")}REC CLIP <b>${tlFmt((performance.now() - TL.rec.t0) / 1000)}</b></span>`;
  if (SRC.pending) return `<span class="pill src">${ic("video")}${SRC.pending} <b>starting…</b></span>`;
  if (SRC.mode === "timeline") return `<span class="pill src">${ic("timeline")}TIMELINE <b>${tlFmt(TL.t)}</b></span>`;
  if (SRC.mode === "clip") return `<span class="pill src">${ic("film")}CLIP <b>${escH(baseName(SRC.clip))}</b></span>`;
  return `<span class="pill src">${ic("video")}LIVE</span>`;
}

// ------------------------------------------------------------- media: one import path for every button and drop
let MEDIA = [];
const isVideo = (f) => /^video\//.test(f.type) || /\.(mp4|mov|mkv|webm|avi|m4v|mts|wmv)$/i.test(f.name);
const isAudio = (f) => /^audio\//.test(f.type) || /\.(mp3|wav|m4a|aac|flac|ogg|opus)$/i.test(f.name);
function songUi() {
  const nm = baseName(BK.song);
  $("#bksongl").innerHTML = ic("music") + (nm ? escH(nm) : "Use a song instead of the clip's sound");
  const t = document.getElementById("txsong"); if (t) t.textContent = nm || "Each clip's own sound";
}
function setSong(path) { BK.song = path || ""; songUi(); }
async function importFiles(files, target) {
  const vids = files.filter(isVideo), auds = files.filter((f) => !isVideo(f) && isAudio(f));
  if (!vids.length && !auds.length) { toast("drop video or audio files"); return; }
  if (auds.length) { const p = await upload(auds[0]); if (p) { setSong(p); toast("song · " + auds[0].name); } }
  if (!vids.length) return;
  const paths = [];
  for (const f of vids) { const p = await upload(f); if (p) paths.push(p); }
  if (!paths.length) return;
  await refreshClips();
  if (target === "timeline") {
    if (!TL.open) tlToggle(true);
    for (const p of paths) await tlAdd(p);
    toast(paths.length > 1 ? `${paths.length} clips added` : "clip added");
  } else {
    await refreshClips(paths[0]); await pickClip(paths[0]);
    if (paths.length > 1) toast(`${paths.length} clips loaded · previewing the first`);
  }
}
// drop anywhere; with the timeline open you choose Preview or Add to timeline
let dropN = 0;
const hasFiles = (e) => [...((e.dataTransfer && e.dataTransfer.types) || [])].includes("Files");
function dropShow(on) { const d = $("#drop"); d.hidden = !on; d.classList.toggle("two", !!(on && typeof TL !== "undefined" && TL.open)); }
addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); dropN++; dropShow(true); });
addEventListener("dragleave", (e) => { if (!hasFiles(e)) return; if (--dropN <= 0) { dropN = 0; dropShow(false); } });
addEventListener("dragover", (e) => {
  if (!hasFiles(e)) return; e.preventDefault();
  document.querySelectorAll("#drop [data-drop]").forEach((z) => z.classList.toggle("hot", z.contains(e.target)));
});
addEventListener("drop", (e) => {
  if (!hasFiles(e)) return; e.preventDefault(); dropN = 0;
  const z = e.target.closest && e.target.closest("#drop [data-drop]"); dropShow(false);
  const target = z && !z.hidden ? z.dataset.drop : (typeof TL !== "undefined" && TL.open ? "timeline" : "preview");
  importFiles([...e.dataTransfer.files], target);
});
