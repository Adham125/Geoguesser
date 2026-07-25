// The disconnected indicator, shared by Catan and GeoGuesser.
//
// The two games' stylesheets are deliberately separate (no Catan page loads
// tokens.css, no GeoGuesser page loads catan-tokens.css), so the SHARED thing
// has to be this module rather than a CSS rule. The SVG paints with
// `currentColor`, and each theme sets that colour on `.disconnect-icon` in its
// own stylesheet — catan.css via --c-danger, components.css via
// --color-destructive.
//
// A plug pulled clear of its socket: the two halves are drawn apart with the
// prongs left hanging, which reads as "unplugged" at 14px in a way the plain
// 🔌 emoji (which just reads as "power") does not.

// A plug with its cable hanging loose — prongs up, body below, and a short
// cable that stops in mid-air rather than reaching anything. Rendered at 16px
// with a heavy stroke: at 14px / 2px the curve smudged into an unreadable
// blob. (A plug-and-socket-pulled-apart version was tried and rejected — at
// this size the two halves read as letterforms, not hardware.)
const SVG = `<svg class="disconnect-icon" viewBox="0 0 24 24" width="16" height="16" role="img" aria-label="Disconnected" focusable="false">
  <title>Disconnected</title>
  <g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 2.5v5"/>
    <path d="M14 2.5v5"/>
    <path d="M4.5 7.5h13v3.5a6.5 6.5 0 0 1-13 0z"/>
    <path d="M11 17.5v4"/>
  </g>
</svg>`;

// For sites that build markup with template strings + innerHTML.
// Contains no interpolation, so it is safe to concatenate into escaped markup.
export function disconnectedIconHTML() {
  return SVG;
}

// For sites that build the DOM with createElement and never touch innerHTML
// (GeoGuesser's in-game scoreboard). Returns a detached element.
export function disconnectedIconEl() {
  const wrap = document.createElement("span");
  wrap.className = "disconnect-icon-wrap";
  wrap.title = "Disconnected";
  wrap.innerHTML = SVG; // static markup, no user input
  return wrap;
}
