// Line icons (24px grid, 1.75 stroke, currentColor). Markup uses <button data-i="name">Label</button>;
// hydrateIcons() puts the SVG in front of the label. JS strings use ic("name").
"use strict";
const ICONS = {
  star: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.5l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  starFill: '<path fill="currentColor" d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.5l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  shuffle: '<path d="M3 17h2.5c1.4 0 2.6-.7 3.4-1.8l5.2-7.4C14.9 6.7 16.1 6 17.5 6H21"/><path d="M18 3l3 3-3 3"/><path d="M3 7h2.5c1.2 0 2.3.5 3 1.4"/><path d="M21 18h-3.5c-1.3 0-2.5-.6-3.2-1.6l-.6-.8"/><path d="M18 15l3 3-3 3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20.5 20.5l-4.6-4.6"/>',
  play: '<path fill="currentColor" stroke="none" d="M8 5.5v13a.8.8 0 0 0 1.2.7l10.3-6.5a.8.8 0 0 0 0-1.4L9.2 4.8A.8.8 0 0 0 8 5.5z"/>',
  video: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>',
  film: '<rect x="3" y="3.5" width="18" height="17" rx="2.5"/><path d="M7.5 3.5v17M16.5 3.5v17M3 8.5h4.5M3 15.5h4.5M16.5 8.5H21M16.5 15.5H21"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.2h7.5A2.5 2.5 0 0 1 21 9.7v7.8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
  music: '<path d="M9 17.5V5.5l11-2v12"/><circle cx="6.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
  record: '<circle cx="12" cy="12" r="5.5" fill="currentColor" stroke="none"/>',
  camera: '<path d="M3.5 8.5A2 2 0 0 1 5.5 6.5h2l1.6-2h5.8l1.6 2h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/>',
  eraser: '<path d="M20 20H9"/><path d="M4.6 14.6l9.2-9.2a2 2 0 0 1 2.8 0l2.9 2.9a2 2 0 0 1 0 2.8L12 18.6a2 2 0 0 1-1.4.6H8.4a2 2 0 0 1-1.4-.6l-2.4-2.4a1.6 1.6 0 0 1 0-2.2zM9.5 9.8l5.6 5.6"/>',
  check: '<path d="M4.5 12.5l4.8 4.8L19.5 7"/>',
  alert: '<path d="M10.3 4.1L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  chevron: '<path d="M9.5 6l6 6-6 6"/>',
  render: '<path d="M12 3.5v11M7.5 10L12 14.5 16.5 10"/><path d="M4.5 19.5h15"/>',
  wave: '<path d="M3 12h1.5M7 8.5v7M11 5v14M15 8v8M19 10.5v3M21 12h0"/>',
  hand: '<path d="M8 12.5V6.2a1.6 1.6 0 0 1 3.2 0v5"/><path d="M11.2 11V4.6a1.6 1.6 0 0 1 3.2 0V11"/><path d="M14.4 11V6.2a1.6 1.6 0 0 1 3.2 0v7.3a7 7 0 0 1-7 7h-.7a6 6 0 0 1-4.3-1.8L3 16a1.6 1.6 0 0 1 2.3-2.2L8 16.3"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 9.5h5v5h-5zM9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  layers: '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12.2L12 16.7l8.5-4.5M3.5 16.2L12 20.7l8.5-4.5"/>',
  gauge: '<path d="M4.5 17.5a8.5 8.5 0 1 1 15 0"/><path d="M12 13.5l4-4.5"/><circle cx="12" cy="14" r="1.3" fill="currentColor"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1-1.6-1-2.8 0-1 .8-1.6 1.8-1.6h2a3.9 3.9 0 0 0 3.9-3.9c0-3.9-3.8-7-8.5-7z"/><circle cx="7.8" cy="11.5" r="1.1" fill="currentColor"/><circle cx="10.5" cy="7.6" r="1.1" fill="currentColor"/><circle cx="15" cy="8" r="1.1" fill="currentColor"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  pause: '<rect x="7" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.4" y="5" width="3.6" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  undo: '<path d="M9 14.5L4.5 10 9 5.5"/><path d="M4.5 10h10a5 5 0 0 1 0 10H12"/>',
  redo: '<path d="M15 14.5l4.5-4.5L15 5.5"/><path d="M19.5 10h-10a5 5 0 0 0 0 10H12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  scissors: '<circle cx="6" cy="6.5" r="2.6"/><circle cx="6" cy="17.5" r="2.6"/><path d="M8.2 8l11.3 9.5M8.2 16l11.3-9.5"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2.2"/><path d="M15.5 8.5V6.7a2.2 2.2 0 0 0-2.2-2.2H6.7a2.2 2.2 0 0 0-2.2 2.2v6.6a2.2 2.2 0 0 0 2.2 2.2h1.8"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M6.5 7l.8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7M10.3 11v5.5M13.7 11v5.5"/>',
  timeline: '<rect x="3" y="13.5" width="7.5" height="5.5" rx="1.4"/><rect x="12" y="13.5" width="9" height="5.5" rx="1.4"/><path d="M3 9.5h18M7.5 4v15.5" />',
  wand: '<path d="M4.5 19.5l10-10M13 6l1-2.5 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1zM18.5 12.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/><path d="M18.5 16v4M16.5 18h4"/>',
};
function ic(name, cls = "") { return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`; }
function hydrateIcons(root = document) {
  root.querySelectorAll("[data-i]").forEach((el) => {
    const old = el.querySelector(":scope > svg.ic"); if (old) old.remove();
    el.insertAdjacentHTML("afterbegin", ic(el.dataset.i));
  });
}
