// Drawing verbs. Not a framework, not a rule — a small set of tools that make a
// shape look drawn instead of computed. Use them when they fit; ignore them when
// they don't. Every function is pure: given the same input it draws the same
// thing, so render(t) stays a pure function of t.

const TAU = Math.PI * 2;

/** Catmull-Rom through the points, as a path. Corners stop being corners. */
export function smoothPath(pts, closed = true, tension = 0.5) {
  const p = new Path2D();
  if (pts.length < 2) return p;
  const at = (i) => pts[(i + pts.length) % pts.length];
  p.moveTo(pts[0][0], pts[0][1]);
  const n = closed ? pts.length : pts.length - 1;
  for (let i = 0; i < n; i++) {
    const p0 = closed ? at(i - 1) : pts[Math.max(0, i - 1)];
    const p1 = closed ? at(i) : pts[i];
    const p2 = closed ? at(i + 1) : pts[i + 1];
    const p3 = closed ? at(i + 2) : pts[Math.min(pts.length - 1, i + 2)];
    const k = tension / 3;
    p.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * k,
      p1[1] + (p2[1] - p0[1]) * k,
      p2[0] - (p3[0] - p1[0]) * k,
      p2[1] - (p3[1] - p1[1]) * k,
      p2[0],
      p2[1],
    );
  }
  if (closed) p.closePath();
  return p;
}

/** A segment with real thickness: round caps, and each end its own width. */
export function capsule(g, a, b, wa, wb = wa) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ang = Math.atan2(dy, dx);
  const steps = 14;
  // Half-circle at each end, walked explicitly: arc() sweep flags are easy to
  // get backwards, and a capsule with the caps turned inward looks like a spike.
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const th = ang + Math.PI / 2 + (i / steps) * Math.PI;
    const x = a[0] + Math.cos(th) * (wa / 2);
    const y = a[1] + Math.sin(th) * (wa / 2);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  for (let i = 0; i <= steps; i++) {
    const th = ang - Math.PI / 2 + (i / steps) * Math.PI;
    const x = b[0] + Math.cos(th) * (wb / 2);
    const y = b[1] + Math.sin(th) * (wb / 2);
    g.lineTo(x, y);
  }
  g.closePath();
}

/**
 * A wash: several offset, low-alpha copies of the same shape. That is what makes
 * a flat fill read as pigment instead of paint bucket.
 */
export function wash(g, path, color, { layers = 5, spread = 6, alpha = 0.16, seed = 1 } = {}) {
  const h = (n) => {
    const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  g.save();
  for (let i = 0; i < layers; i++) {
    const dx = (h(i) - 0.5) * spread;
    const dy = (h(i + 91) - 0.5) * spread;
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.save();
    g.translate(dx, dy);
    g.fill(path);
    g.restore();
  }
  g.restore();
}

/**
 * Draw a shape, then trace its edge with a slightly wobbling line. The vector
 * edge stops being the last thing the eye sees.
 */
export function strokeOutline(g, pts, { width = 3, color = 'rgba(20,16,12,0.6)', wobble = 2.2, seed = 2, closed = true } = {}) {
  const h = (n) => {
    const v = Math.sin(n * 41.9 + seed * 17.3) * 43758.5453;
    return v - Math.floor(v);
  };
  const moved = pts.map((p, i) => [p[0] + (h(i) - 0.5) * wobble, p[1] + (h(i + 37) - 0.5) * wobble]);
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.stroke(smoothPath(moved, closed));
  g.restore();
}

/** Grain with a direction: fibres, not static. */
export function grain(g, w, h, { angle = 0, density = 0.0016, alpha = 0.05, seed = 3, color = '#000' } = {}) {
  const r = (n) => {
    const v = Math.sin(n * 91.7 + seed * 57.1) * 43758.5453;
    return v - Math.floor(v);
  };
  const count = Math.round(w * h * density);
  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = color;
  g.lineWidth = 0.8;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let i = 0; i < count; i++) {
    const x = r(i) * w;
    const y = r(i + 17) * h;
    const len = 2 + r(i + 33) * 10;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + cos * len, y + sin * len);
    g.stroke();
  }
  g.restore();
}

export const paint = { smoothPath, capsule, wash, strokeOutline, grain, TAU };
