// Shared behaviour for the #back-button anchor on every page.
//
// Each page declares its own desired destination in the anchor's `href`
// (e.g. game → lobby, lobby → landing). We intentionally do NOT use
// history.back(), because that would break the fixed page structure when
// users deep-link or navigate via in-game transitions.
//
// Pages whose destination differs in singleplayer can opt into a fallback
// via `data-sp-fallback` — when localStorage.roomCode === "Singleplayer"
// the href is swapped to that fallback at load time.
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("back-button");
  if (!btn) return;
  const spFallback = btn.dataset.spFallback;
  if (spFallback) {
    try {
      const rc = JSON.parse(localStorage.getItem("roomCode"));
      if (rc === "Singleplayer") btn.href = spFallback;
    } catch (_) { /* malformed storage — keep the default href */ }
  }
});
