// Centralised server URL for all frontend scripts. The dev and prod copies
// used to hardcode `const server = 'https://localhost'` in every file, which
// drifted whenever one was edited in isolation. This module derives the
// origin from `window.location` so opening the site on any host (localhost,
// 127.0.0.1, adhamgames.co.uk) talks to the same-origin backend.
const hostname = window.location.hostname;
export const serverURL = (hostname === "localhost" || hostname === "127.0.0.1")
  ? "https://localhost"
  : `https://${hostname}`;
