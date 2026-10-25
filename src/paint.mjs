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

/**
 * A camera looking into a room. This is the one thing every interior shot needs
 * and nothing else provides: without it, a "room" collapses into a front
 * elevation with no depth, which is what a canvas defaults to.
 *
 * Pure maths, no canvas: `at` maps a world point to screen x, y and k, where k
 * is how many pixels one world unit covers at that depth. Use k for line widths
 * and for anything that should get bigger as it comes closer.
 *
 *   const cam = ctx.paint.space({ w: ctx.width, h: ctx.height, eye: [0, 1.6, 4], look: [0, 1.5, -6] });
 *   const [x, y, k] = cam.at(0, 0, -3);
 *
 * World units are whatever you want them to be — metres, shelf widths. Y is up.
 */
export function space({ w = 1920, h = 1080, eye = [0, 1.6, 0], look = [0, 1.6, -1], up = [0, 1, 0], fov = 50 } = {}) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => {
    const l = Math.hypot(...a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  };

  const forward = norm(sub(look, eye));
  const right = norm(cross(forward, up));
  const tilted = cross(right, forward);
  // Vertical fov sets the focal length in pixels; 50° is close to a 40mm lens,
  // which is what a room reads as "filmed" rather than "wide-angle distorted".
  const focal = h / 2 / Math.tan(((fov * Math.PI) / 180) / 2);

  /** World point -> [x, y, k]. Points behind the eye come back with k <= 0. */
  const at = (x, y, z) => {
    const d = sub([x, y, z], eye);
    const depth = dot(d, forward);
    if (depth < 0.02) return [w / 2, h / 2, 0];
    const k = focal / depth;
    return [w / 2 + dot(d, right) * k, h / 2 - dot(d, tilted) * k, k];
  };

  /** Pixels per world unit at depth z — for strokes that should not get thinner. */
  const depth = (z) => {
    const d = sub([0, 0, z], eye);
    const along = dot(d, forward);
    return along < 0.02 ? 0 : focal / along;
  };

  /** A closed quad from four world points, as a path. Walls, floors, shelf sides. */
  const quad = (a, b, c, d) => {
    const p = new Path2D();
    [a, b, c, d].forEach((pt, i) => {
      const [x, y] = at(...pt);
      i ? p.lineTo(x, y) : p.moveTo(x, y);
    });
    p.closePath();
    return p;
  };

  return { at, depth, quad, eye, look, focal };
}

/**
 * The stroke layer: repaint a finished base as short brush marks, on a jittered
 * grid, from the base's own colours. This is the mechanism behind "the whole
 * frame is paint" — and the reason a picture stops looking like vector shapes
 * with a texture on top.
 *
 * It runs *every frame* (unlike ctx.medium, which paints once): the grid re-seeds
 * every `1 / boil` seconds, so the surface trembles. Give `boil = 0` to freeze it
 * and cache the layer — a full-frame boil reads as flicker, and a still region
 * (floor, props, a character sitting still) should not boil.
 *
 *   // in mount(): the flat base, drawn once
 *   base = ctx.still((g, w, h) => { …shapes… });
 *
 *   // in render(t): the paint over it, re-seeded 8 times a second
 *   const n = Math.floor(t * 8);
 *   if (n !== last) { last = n; layer = ctx.paint.strokes(base, { angle, palette, t, boil: 8 }); }
 *   g.drawImage(layer, 0, 0);
 *
 * `angle(x, y, t)` is the direction field (water is horizontal, foliage is not).
 * `palette(x, y, rgb, rand)` returns a colour to use for that mark, or null to
 * keep the sampled one — that is how one base becomes five materials.
 * `mask(x, y)` and `alphaMask` limit which cells get painted.
 */
export function strokes(base, options = {}) {
  const {
    cell = 12,
    len = 22,
    width = 7,
    angle = null,
    seed = 1,
    t = 0,
    boil = 8,
    outline = 0.35,
    outlineColor = '#14193c',
    outlineMix = 0.55,
    jitter = 18,
    mask = null,
    alphaMask = false,
    palette = null,
    cap = 'round',
  } = options;

  const W = base.width;
  const H = base.height;
  const bctx = base.getContext('2d', { willReadFrequently: true });
  const data = bctx.getImageData(0, 0, W, H).data;

  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const g = out.getContext('2d');
  g.lineCap = cap;

  // One seed per boil step: the whole layer jumps, it does not drift.
  const step = boil > 0 ? Math.floor(t * boil) : 0;
  let a = (seed * 1000 + step) >>> 0 || 1;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const mix = (c, d, k) => [c[0] + (d[0] - c[0]) * k, c[1] + (d[1] - c[1]) * k, c[2] + (d[2] - c[2]) * k];
  const rgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

  for (let y = 0; y < H + cell; y += cell) {
    for (let x = 0; x < W + cell; x += cell) {
      const px = x + (rand() - 0.5) * cell;
      const py = y + (rand() - 0.5) * cell;
      const ix = Math.max(0, Math.min(W - 1, px | 0));
      const iy = Math.max(0, Math.min(H - 1, py | 0));
      const i = (iy * W + ix) * 4;
      if (mask && !mask(px, py)) continue;
      if (alphaMask && data[i + 3] < 200) continue;

      let col = [data[i], data[i + 1], data[i + 2]];
      const swapped = palette ? palette(px, py, col, rand) : null;
      if (swapped) col = swapped;

      const ang = angle ? angle(px, py, t) : 0;
      const l = len * (0.7 + rand() * 0.6);
      const dx = (Math.cos(ang) * l) / 2;
      const dy = (Math.sin(ang) * l) / 2;

      if (outline > 0) {
        g.globalAlpha = outline;
        g.strokeStyle = rgb(mix(col, hex(outlineColor), outlineMix));
        g.lineWidth = width + 2.5;
        g.beginPath();
        g.moveTo(px - dx, py - dy);
        g.lineTo(px + dx, py + dy);
        g.stroke();
      }

      const j = swapped ? col : mix(col, [128, 128, 128], (rand() - 0.5) * (jitter / 255) * 2);
      g.globalAlpha = 1;
      g.strokeStyle = rgb(j);
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(px - dx, py - dy);
      g.lineTo(px + dx, py + dy);
      g.stroke();
    }
  }
  return out;
}

/** A colour group, so one base can become several materials. */
export function swatch(hexes, mixBase = 0.35) {
  const pool = hexes.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  return (col, rand) => {
    const k = pool[(rand() * pool.length) | 0];
    return [k[0] + (col[0] - k[0]) * mixBase, k[1] + (col[1] - k[1]) * mixBase, k[2] + (col[2] - k[2]) * mixBase];
  };
}

/**
 * A pixel sprite, from rows of characters. This is the other half of a
 * hand-painted plate: the painting carries the material, the sprite carries the
 * acting — and the sprite has to stay on its own grid, or the two read as one
 * blurry picture instead of two materials in collision.
 *
 *   const walk = [
 *     '..HH..',
 *     '.HHHH.',
 *     '.HEEH.',   // H hair, E eye, C coat, L leg
 *     '.CCCC.',
 *     '..LL..',
 *   ];
 *   ctx.paint.sprite(g, walk, { H: '#f0e0c8', E: '#111', C: '#2b4a6f', L: '#3a2a20' }, { x: 820, y: 700, scale: 8 });
 *
 * `scale` is snapped to a whole number of pixels: a sprite on a fractional grid
 * stops being a sprite. Returns the drawn size so a caller can place the shadow.
 */
export function sprite(g, rows, palette, { x = 0, y = 0, scale = 1, flip = false, alpha = 1, outline = null } = {}) {
  const s = Math.max(1, Math.round(scale));
  const w = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const ox = Math.round(x);
  const oy = Math.round(y);
  const at = (r, c) => (r >= 0 && r < rows.length && c >= 0 && c < w ? rows[r][c] : '.');
  const filled = (r, c) => Boolean(palette[at(r, c)]);

  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha *= alpha;

  // A one-cell outline, drawn first and on the same grid. Without it a sprite
  // sinks into a busy plate: the painting's edges are as dark as the character's.
  if (outline) {
    g.fillStyle = outline;
    for (let r = -1; r <= rows.length; r++) {
      for (let c = -1; c <= w; c++) {
        if (filled(r, c)) continue;
        if (!filled(r - 1, c) && !filled(r + 1, c) && !filled(r, c - 1) && !filled(r, c + 1)) continue;
        const cx = flip ? w - c : c;
        g.fillRect(ox + cx * s, oy + r * s, s, s);
      }
    }
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const color = palette[row[c]];
      if (!color) continue;
      const cx = flip ? w - 1 - c : c;
      g.fillStyle = color;
      g.fillRect(ox + cx * s, oy + r * s, s, s);
    }
  }
  g.restore();
  return { x: ox, y: oy, w: (w + (outline ? 2 : 0)) * s, h: (rows.length + (outline ? 2 : 0)) * s };
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

export const paint = { smoothPath, capsule, wash, strokeOutline, grain, space, sprite, strokes, swatch, TAU };
