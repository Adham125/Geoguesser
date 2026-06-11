// SVG board renderer. Builds the static island once from catan:state.board,
// then re-renders only the dynamic layers (roads, buildings, robber,
// highlights) from each public-state snapshot. The client derives no IDs —
// everything comes from the server's board maps; this module only turns
// IDs into pixels (scripts/catan/layout.js).

import {
  hexCenter, hexCorners, vertexCenter, edgeEndpoints, boardViewBox, HEX_SIZE,
} from "./layout.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function el(name, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, name);
  for (const k in attrs) node.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(node);
  return node;
}

function pointsAttr(pts) {
  return pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
}

// Shrink an edge segment so road pieces don't crowd the vertices.
function roadSegment(eid, inset = 13) {
  const [a, b] = edgeEndpoints(eid);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  return {
    x1: a.x + ux * inset, y1: a.y + uy * inset,
    x2: b.x - ux * inset, y2: b.y - uy * inset,
  };
}

// Probability pips under a number token (6 and 8 get five).
const PIPS = { 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };

// Resource glyphs shown above the number token (matches the hand cards).
const RESOURCE_ICONS = { wood: "🪵", brick: "🧱", sheep: "🐑", wheat: "🌾", ore: "🪨" };

function settlementPoints(c, s = 11) {
  // Little house: roof apex, eaves, floor.
  return pointsAttr([
    { x: c.x, y: c.y - s },
    { x: c.x + s * 0.9, y: c.y - s * 0.25 },
    { x: c.x + s * 0.9, y: c.y + s * 0.8 },
    { x: c.x - s * 0.9, y: c.y + s * 0.8 },
    { x: c.x - s * 0.9, y: c.y - s * 0.25 },
  ]);
}

function cityPoints(c, s = 12) {
  // House with a tower on the left.
  return pointsAttr([
    { x: c.x - s * 1.1, y: c.y - s * 1.05 },
    { x: c.x - s * 0.3, y: c.y - s * 1.05 },
    { x: c.x - s * 0.3, y: c.y - s * 0.35 },
    { x: c.x + s * 0.35, y: c.y - s * 0.85 },
    { x: c.x + s * 1.1, y: c.y - s * 0.35 },
    { x: c.x + s * 1.1, y: c.y + s * 0.85 },
    { x: c.x - s * 1.1, y: c.y + s * 0.85 },
  ]);
}

export function createRenderer(svg, board, opts = {}) {
  svg.innerHTML = "";
  const hexKeys = board.hexes.map(h => `${h.q},${h.r}`);
  const baseVB = boardViewBox(hexKeys);
  svg.setAttribute("viewBox", `${baseVB.x} ${baseVB.y} ${baseVB.width} ${baseVB.height}`);

  // Transparent drag surface beneath every layer so pan gestures starting
  // over empty sea still register (only filled shapes emit pointer events).
  if (opts.interactive) {
    el("rect", {
      x: baseVB.x - baseVB.width * 2,
      y: baseVB.y - baseVB.height * 2,
      width: baseVB.width * 5,
      height: baseVB.height * 5,
      fill: "transparent",
      class: "pan-surface",
    }, svg);
  }

  // Layer order: sand frame, tiles, tokens, roads, robber, buildings, hits.
  const gFrame = el("g", { class: "layer-frame" }, svg);
  const gTiles = el("g", { class: "layer-tiles" }, svg);
  const gTokens = el("g", { class: "layer-tokens" }, svg);
  const gRoads = el("g", { class: "layer-roads" }, svg);
  const gRobber = el("g", { class: "layer-robber" }, svg);
  const gBuildings = el("g", { class: "layer-buildings" }, svg);
  const gHits = el("g", { class: "layer-hits" }, svg);

  // --- static island -----------------------------------------------------
  for (const h of board.hexes) {
    const key = `${h.q},${h.r}`;
    el("polygon", {
      points: pointsAttr(hexCorners(key, HEX_SIZE * 1.14)),
      class: "hex-frame",
    }, gFrame);
  }
  for (const h of board.hexes) {
    const key = `${h.q},${h.r}`;
    el("polygon", {
      points: pointsAttr(hexCorners(key, HEX_SIZE * 0.985)),
      class: `hex-tile hex-${h.resource}`,
      "data-hex": key,
    }, gTiles);

    if (h.number !== null) {
      const c = hexCenter(key);
      const hot = h.number === 6 || h.number === 8;
      const g = el("g", { class: `num-token${hot ? " num-hot" : ""}`, "data-hex": key }, gTokens);
      // Resource icon sits above the number token.
      const icon = el("text", { x: c.x, y: c.y - 21, class: "tile-icon" }, g);
      icon.textContent = RESOURCE_ICONS[h.resource] || "";
      el("circle", { cx: c.x, cy: c.y + 9, r: 14, class: "num-circle" }, g);
      const t = el("text", { x: c.x, y: c.y + 10.5, class: "num-text" }, g);
      t.textContent = h.number;
      const pips = PIPS[h.number] || 0;
      for (let i = 0; i < pips; i++) {
        el("circle", {
          cx: c.x + (i - (pips - 1) / 2) * 4.4,
          cy: c.y + 17.5,
          r: 1.3,
          class: "num-pip",
        }, g);
      }
    }
  }

  // --- invisible hit targets ----------------------------------------------
  const hitVertices = {};
  const hitEdges = {};
  const hitHexes = {};
  for (const vid in board.vertexToHexes) {
    const c = vertexCenter(vid);
    hitVertices[vid] = el("circle", {
      cx: c.x, cy: c.y, r: 15, class: "hit hit-vertex", "data-id": vid,
    }, gHits);
  }
  for (const eid in board.edgeToVertices) {
    const seg = roadSegment(eid, 15);
    hitEdges[eid] = el("line", {
      x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2,
      class: "hit hit-edge", "data-id": eid,
    }, gHits);
  }
  for (const key of hexKeys) {
    hitHexes[key] = el("polygon", {
      points: pointsAttr(hexCorners(key, HEX_SIZE * 0.82)),
      class: "hit hit-hex", "data-id": key,
    }, gHits);
  }

  const panZoom = opts.interactive ? enablePanZoom(svg, baseVB) : null;

  let handlers = {};
  gHits.addEventListener("click", (e) => {
    // A pan/pinch gesture ends with a click — swallow it so dragging the
    // board never places a piece.
    if (panZoom && panZoom.consumedDrag()) return;
    const t = e.target.closest(".hit");
    if (!t || !t.classList.contains("hit-active")) return;
    const id = t.getAttribute("data-id");
    if (t.classList.contains("hit-vertex") && handlers.onVertex) handlers.onVertex(id);
    else if (t.classList.contains("hit-edge") && handlers.onEdge) handlers.onEdge(id);
    else if (t.classList.contains("hit-hex") && handlers.onHex) handlers.onHex(id);
  });

  function setTargets({ vertices = [], edges = [], hexes = [] } = {}) {
    clearTargets();
    for (const vid of vertices) hitVertices[vid] && hitVertices[vid].classList.add("hit-active");
    for (const eid of edges) hitEdges[eid] && hitEdges[eid].classList.add("hit-active");
    for (const hk of hexes) hitHexes[hk] && hitHexes[hk].classList.add("hit-active");
  }

  function clearTargets() {
    for (const node of svg.querySelectorAll(".hit-active")) node.classList.remove("hit-active");
  }

  // --- dynamic layers ------------------------------------------------------
  function render(pub) {
    gRoads.innerHTML = "";
    gBuildings.innerHTML = "";
    gRobber.innerHTML = "";

    for (const eid in pub.occupied.edges) {
      const seat = pub.occupied.edges[eid].seat;
      const colour = pub.seats[seat].colour;
      const seg = roadSegment(eid);
      el("line", { ...lineAttrs(seg), class: "road-outline" }, gRoads);
      el("line", { ...lineAttrs(seg), class: "road", stroke: colour }, gRoads);
    }

    for (const vid in pub.occupied.vertices) {
      const { seat, type } = pub.occupied.vertices[vid];
      const colour = pub.seats[seat].colour;
      const c = vertexCenter(vid);
      el("polygon", {
        points: type === "city" ? cityPoints(c) : settlementPoints(c),
        class: `building building-${type}`,
        fill: colour,
      }, gBuildings);
    }

    const rc = hexCenter(pub.robberHex);
    const robber = el("g", { class: "robber" }, gRobber);
    el("ellipse", { cx: rc.x - 24, cy: rc.y + 10, rx: 10, ry: 13, class: "robber-body" }, robber);
    el("circle", { cx: rc.x - 24, cy: rc.y - 8, r: 7, class: "robber-body" }, robber);
  }

  function lineAttrs(seg) {
    return { x1: seg.x1, y1: seg.y1, x2: seg.x2, y2: seg.y2 };
  }

  return {
    render,
    setTargets,
    clearTargets,
    setHandlers(h) { handlers = h; },
    zoomIn() { panZoom && panZoom.zoomBy(1 / 1.25); },
    zoomOut() { panZoom && panZoom.zoomBy(1.25); },
    resetView() { panZoom && panZoom.reset(); },
  };
}

// Pan (drag / one-finger) + zoom (wheel / pinch / buttons) over the SVG
// viewBox. Pure view transform — never touches the board geometry, so the
// server-authoritative coordinates are untouched. `consumedDrag()` lets the
// click handler distinguish a tap-to-place from a drag-to-pan.
function enablePanZoom(svg, baseVB) {
  const view = { x: baseVB.x, y: baseVB.y, w: baseVB.width, h: baseVB.height };
  const MIN_W = baseVB.width * 0.35; // most zoomed in
  const MAX_W = baseVB.width * 1.3;  // most zoomed out
  const pointers = new Map();
  let panStart = null;   // { cx, cy, view, a, d }
  let pinchStart = null; // { dist, view, anchor }
  let moved = false;

  function apply() {
    svg.setAttribute("viewBox", `${view.x} ${view.y} ${view.w} ${view.h}`);
  }

  function clientToSvg(cx, cy) {
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  // Zoom so `anchor` (an SVG-space point) stays under the same pixel.
  function zoomTo(targetW, anchor, from = view) {
    const newW = Math.max(MIN_W, Math.min(MAX_W, targetW));
    const factor = newW / from.w;
    view.w = from.w * factor;
    view.h = from.h * factor;
    view.x = anchor.x - (anchor.x - from.x) * factor;
    view.y = anchor.y - (anchor.y - from.y) * factor;
    apply();
  }

  svg.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    if (pointers.size === 1) {
      const ctm = svg.getScreenCTM();
      panStart = { cx: e.clientX, cy: e.clientY, view: { ...view }, a: ctm.a, d: ctm.d };
      pinchStart = null;
    } else if (pointers.size === 2) {
      const [p1, p2] = [...pointers.values()];
      pinchStart = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        view: { ...view },
        anchor: clientToSvg((p1.x + p2.x) / 2, (p1.y + p2.y) / 2),
      };
      panStart = null;
    }
  });

  window.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size >= 2 && pinchStart) {
      const [p1, p2] = [...pointers.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (dist > 0) zoomTo(pinchStart.view.w * (pinchStart.dist / dist), pinchStart.anchor, pinchStart.view);
      moved = true;
      return;
    }
    if (panStart) {
      const dx = e.clientX - panStart.cx;
      const dy = e.clientY - panStart.cy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      view.x = panStart.view.x - dx / panStart.a;
      view.y = panStart.view.y - dy / panStart.d;
      apply();
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (pointers.size === 0) {
      panStart = null;
    } else {
      const [only] = [...pointers.values()];
      const ctm = svg.getScreenCTM();
      panStart = { cx: only.x, cy: only.y, view: { ...view }, a: ctm.a, d: ctm.d };
    }
  }
  window.addEventListener("pointerup", endPointer);
  window.addEventListener("pointercancel", endPointer);

  svg.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomTo(view.w * (e.deltaY > 0 ? 1.12 : 1 / 1.12), clientToSvg(e.clientX, e.clientY));
  }, { passive: false });

  return {
    consumedDrag: () => moved,
    zoomBy(factor) {
      zoomTo(view.w * factor, { x: view.x + view.w / 2, y: view.y + view.h / 2 });
    },
    reset() {
      view.x = baseVB.x; view.y = baseVB.y; view.w = baseVB.width; view.h = baseVB.height;
      apply();
    },
  };
}
