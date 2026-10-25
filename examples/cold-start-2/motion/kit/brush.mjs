// SAMPLE — not engine API. Delete this file and the engine is unaffected.
//
// The painterly kit: a mark maker and the two shapes almost every painterly
// style needs. It is one honest implementation, not the only one. Copy it into
// a project, change the numbers, or throw it away and write your own.

const TAU = Math.PI * 2;

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Deterministic hash-based random in [0,1). Never Math.random: render(t) is pure. */
export function rng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 8) & 0xffffff) / 0x1000000;
  };
}

/** Catmull-Rom through points — the outline of every living thing. */
export function smoothPath(g, pts, closed = true, tension = 0.5) {
  if (pts.length < 3) return;
  const p = (i) => pts[closed ? (i + pts.length) % pts.length : Math.max(0, Math.min(pts.length - 1, i))];
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < (closed ? pts.length : pts.length - 1); i++) {
    const [x0, y0] = p(i - 1);
    const [x1, y1] = p(i);
    const [x2, y2] = p(i + 1);
    const [x3, y3] = p(i + 2);
    g.bezierCurveTo(
      x1 + ((x2 - x0) / 6) * tension * 2, y1 + ((y2 - y0) / 6) * tension * 2,
      x2 - ((x3 - x1) / 6) * tension * 2, y2 - ((y3 - y1) / 6) * tension * 2,
      x2, y2,
    );
  }
  if (closed) g.closePath();
}

/** A stroke with a width, not a line: taper in, taper out. */
export function capsule(g, a, b, wa, wb = wa) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  g.beginPath();
  g.moveTo(a[0] + nx * wa, a[1] + ny * wa);
  g.lineTo(b[0] + nx * wb, b[1] + ny * wb);
  g.lineTo(b[0] - nx * wb, b[1] - ny * wb);
  g.lineTo(a[0] - nx * wa, a[1] - ny * wa);
  g.closePath();
}

/**
 * Repaint a picture out of marks.
 *
 * Walk a jittered grid over `base`, read the colour under each cell, and lay a
 * short stroke there along the direction field. The colour comes from the
 * picture, so the result keeps its light; the direction comes from the field,
 * so it reads as brushwork rather than noise.
 *
 * `boil` re-seeds the whole layer every 1/boil seconds. Boiling the whole frame
 * reads as flicker on screen — the reference scene only boils the region that
 * should look hand-made and leaves the rest at 0.
 */
export function strokes(base, options = {}) {
  const {
    cell = 12,
    len = 22,
    width = 7,
    angle = 0,          // number, or (x, y, t) => radians
    seed = 1,
    t = 0,
    boil = 0,
    outline = 0,
    outlineColor = '#14193c',
    jitter = 18,
    mask = null,        // canvas: only paint where it is opaque
    palette = null,     // (x, y, [r,g,b], rand) => [r,g,b] | null
    cap = 'round',
  } = options;

  const w = base.width;
  const h = base.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d');

  const src = base.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const mk = mask?.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, mask.width, mask.height).data;
  const at = (x, y) => (Math.min(h - 1, Math.max(0, y | 0)) * w + Math.min(w - 1, Math.max(0, x | 0))) * 4;
  const rand = rng(seed * 7919 + Math.floor(t * (boil || 0.0001)));

  g.lineCap = cap;
  g.lineJoin = 'round';

  for (let y = -cell; y < h + cell; y += cell) {
    for (let x = -cell; x < w + cell; x += cell) {
      const px = x + (rand() - 0.5) * jitter;
      const py = y + (rand() - 0.5) * jitter;
      if (mask && mk[at(px, py) + 3] < 40) continue;
      const i = at(px, py);
      if (src[i + 3] < 24) continue;
      const col = [src[i], src[i + 1], src[i + 2]];
      // No palette means "keep the picture's own colour"; a palette that
      // returns null means "leave this cell alone". They are not the same.
      const swap = palette ? palette(px, py, col, rand) : col;
      if (swap === null) continue;
      const [r, gg, b] = swap;
      const a = typeof angle === 'function' ? angle(px, py, t) : angle;
      const l = len * (0.6 + rand() * 0.8);
      const wd = width * (0.55 + rand() * 0.9);
      g.strokeStyle = `rgb(${r | 0},${gg | 0},${b | 0})`;
      g.lineWidth = wd;
      if (outline > 0 && rand() < outline) {
        g.strokeStyle = outlineColor;
        g.lineWidth = wd * 0.45;
      }
      g.beginPath();
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      const bend = (rand() - 0.5) * l * 0.35;
      g.moveTo(px - cx * l * 0.5, py - cy * l * 0.5);
      g.quadraticCurveTo(px - cy * bend, py + cx * bend, px + cx * l * 0.5, py + cy * l * 0.5);
      g.stroke();
    }
  }
  return out;
}

/** Fill a path in several offset passes so the edge sits down into the paper. */
export function wash(g, path, color, { layers = 5, spread = 6, alpha = 0.16, seed = 1 } = {}) {
  const rand = rng(seed);
  g.save();
  for (let i = 0; i < layers; i++) {
    const dx = (rand() - 0.5) * spread;
    const dy = (rand() - 0.5) * spread;
    g.globalAlpha = alpha;
    g.fillStyle = color;
    path(g, dx, dy);
    g.fill();
  }
  g.restore();
}
