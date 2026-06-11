// Pure hex-board geometry for the Catan SVG renderer.
//
// Pointy-top axial coordinates, matching server/src/catan/board.js.
// The vertex/edge ID algorithm is textually identical to the server's
// (pinned there by catan-engine.test.mjs) — keep both in sync. In normal
// play the client never derives IDs though: it reads them from
// catan:state.board and only computes pixel positions here.

export const HEX_SIZE = 56; // circumradius in SVG units

export function parseHexKey(key) {
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

export function hexCenter(key) {
  const { q, r } = parseHexKey(key);
  return {
    x: HEX_SIZE * Math.sqrt(3) * (q + r / 2),
    y: HEX_SIZE * 1.5 * r,
  };
}

// A vertex ID is the 3 touching hex coords — its pixel position is the
// centroid of those 3 hex centers (a hex corner is equidistant from all
// three neighbouring centers).
export function vertexCenter(vid) {
  const hexes = vid.split("|");
  let x = 0, y = 0;
  for (const hk of hexes) {
    const c = hexCenter(hk);
    x += c.x; y += c.y;
  }
  return { x: x / 3, y: y / 3 };
}

export function edgeEndpoints(eid) {
  const [v1, v2] = eid.split("&");
  return [vertexCenter(v1), vertexCenter(v2)];
}

export function edgeMidpoint(eid) {
  const [a, b] = edgeEndpoints(eid);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Corner points of a hex polygon (pointy-top).
export function hexCorners(key, size = HEX_SIZE) {
  const c = hexCenter(key);
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI / 180) * (60 * k - 30);
    pts.push({ x: c.x + size * Math.cos(angle), y: c.y + size * Math.sin(angle) });
  }
  return pts;
}

// Bounding viewBox for a list of hex keys, with margin for the sea frame.
export function boardViewBox(hexKeys, margin = HEX_SIZE * 1.6) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const key of hexKeys) {
    for (const p of hexCorners(key)) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  return {
    x: minX - margin,
    y: minY - margin,
    width: maxX - minX + 2 * margin,
    height: maxY - minY + 2 * margin,
  };
}
