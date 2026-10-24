// The material layer: what a frame is *made of*, separate from what is in it.
//
// Same geometry, different medium, reads as a different piece. That is the whole
// trick behind a style library: paper, ink, printing, light and grain are a
// channel you run a drawing through, not a filter you put on top of it.
//
// Everything here is deterministic: seeded hashes, no Math.random, no clock.

const cache = new Map();

function scratch(key, w, h) {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    cache.set(key, c);
  }
  return c;
}

// --- deterministic value noise -------------------------------------------
function hash2(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smooth(v) {
  return v * v * (3 - 2 * v);
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf;
}

function fbm(x, y, seed, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 13);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** A sheet of paper: low-frequency mottling, fibers, fine grain. Cached. */
export function paper(g, w, h, { base = [239, 228, 205], seed = 5, mottle = 16, grain = 9 } = {}) {
  const key = `paper:${w}x${h}:${base.join(',')}:${seed}:${mottle}:${grain}`;
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cg = c.getContext('2d');
    const img = cg.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const low = (fbm(x * 0.0035, y * 0.0035, seed, 4) - 0.5) * mottle;
        const mid = (fbm(x * 0.02, y * 0.02, seed + 9, 3) - 0.5) * mottle * 0.5;
        const fine = (hash2(x, y, seed + 3) - 0.5) * grain;
        const warm = fbm(x * 0.006, y * 0.006, seed + 21, 2) * 6;
        d[i] = base[0] + low + mid + fine + warm;
        d[i + 1] = base[1] + low + mid + fine + warm * 0.7;
        d[i + 2] = base[2] + low + mid + fine - warm * 0.3;
        d[i + 3] = 255;
      }
    }
    cg.putImageData(img, 0, 0);
    // fibers: a few hundred short hairs, lighter and darker than the sheet
    const r = (n) => hash2(n, 7, seed);
    cg.lineWidth = 0.7;
    for (let i = 0; i < Math.round((w * h) / 5200); i++) {
      const x = r(i) * w;
      const y = r(i + 991) * h;
      const len = 4 + r(i + 17) * 16;
      const ang = r(i + 33) * Math.PI;
      cg.strokeStyle = r(i + 55) > 0.5 ? 'rgba(255,252,240,0.35)' : 'rgba(120,102,80,0.12)';
      cg.beginPath();
      cg.moveTo(x, y);
      cg.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      cg.stroke();
    }
    cache.set(key, c);
  }
  g.drawImage(cache.get(key), 0, 0, w, h);
}

/** A variable-width stroke with dry-brush breaks — ink, not a polyline. */
export function inkStroke(g, pts, { width = 6, color = [38, 30, 22], dry = 0.45, seed = 1, cap = 'round' } = {}) {
  if (pts.length < 2) return;
  const n = pts.length;
  const normals = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    normals.push([-dy / d, dx / d]);
  }
  const profile = (q) => Math.sin(Math.PI * Math.min(1, 0.15 + q * 0.9)) * (0.75 + 0.25 * valueNoise(q * 6, seed, 3));
  g.save();
  g.lineCap = cap;
  g.strokeStyle = rgb(color, 0.9);
  g.fillStyle = rgb(color, 0.86);
  // core
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const w = width * profile(i / (n - 1));
    const [nx, ny] = normals[i];
    g.lineTo(pts[i][0] + nx * w * 0.5, pts[i][1] + ny * w * 0.5);
  }
  for (let i = n - 1; i >= 0; i--) {
    const w = width * profile(i / (n - 1));
    const [nx, ny] = normals[i];
    g.lineTo(pts[i][0] - nx * w * 0.5, pts[i][1] - ny * w * 0.5);
  }
  g.closePath();
  g.fill();
  // bristles: each one a continuous path, broken by noise so the paper shows
  for (let k = 0; k < 5; k++) {
    const off = (k / 4 - 0.5) * 0.9;
    g.strokeStyle = rgb(color, 0.18 + hash2(k, seed, 5) * 0.3);
    g.lineWidth = Math.max(0.6, (width / 5) * (0.6 + hash2(k, seed, 9) * 0.8));
    g.beginPath();
    let on = false;
    for (let i = 0; i < n; i++) {
      const q = i / (n - 1);
      const vis = valueNoise(k * 1.7 + seed, i * 0.18, 11) > dry * Math.pow(q, 1.3) * 0.9;
      const w = width * profile(q) * off;
      const x = pts[i][0] + normals[i][0] * w;
      const y = pts[i][1] + normals[i][1] * w;
      if (vis) {
        on ? g.lineTo(x, y) : g.moveTo(x, y);
        on = true;
      } else on = false;
    }
    g.stroke();
  }
  g.restore();
}

/** Printing: a halftone dot screen and a registration shift, on demand. */
export function halftone(g, w, h, { cell = 4, alpha = 0.1, seed = 2 } = {}) {
  const key = `halftone:${cell}:${seed}`;
  if (!cache.has(key)) {
    const c = document.createElement('canvas');
    c.width = cell * 2;
    c.height = cell * 2;
    const cg = c.getContext('2d');
    cg.fillStyle = 'rgba(0,0,0,0)';
    cg.fillRect(0, 0, cell * 2, cell * 2);
    for (const [dx, dy] of [[0, 0], [cell, cell]]) {
      cg.fillStyle = 'rgba(0,0,0,1)';
      cg.beginPath();
      cg.arc(dx + cell / 2, dy + cell / 2, cell * 0.3, 0, Math.PI * 2);
      cg.fill();
    }
    cache.set(key, c);
  }
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = g.createPattern(cache.get(key), 'repeat');
  g.fillRect(0, 0, w, h);
  g.restore();
}

/** Ink bleed: a soft dark halo just inside an edge, like ink on unsized paper. */
export function bleed(g, w, h, { color = [38, 30, 22], amount = 0.12 } = {}) {
  if (amount <= 0) return;
  g.save();
  g.globalCompositeOperation = 'multiply';
  const grad = g.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.42, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  grad.addColorStop(0, rgb(color, 0));
  grad.addColorStop(1, rgb(color, amount));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.restore();
}

// --- passes: repaint a finished picture as a medium ---------------------------
//
// The helpers above put a material *on a surface* while you draw; the passes
// below take a picture that is already drawn and paint it again. Both are
// needed: `paper` and `inkStroke` are for a scene that draws in ink from the
// start, `broken` is for one that has a picture and wants it to look painted.
//
// A pass is deliberately not a brush API: a scene says "I have the picture, now
// make it paint" without learning a drawing system. It is cheap enough to run
// once per shot (in mount), which is what a static plate is.

const GROUND = {
  broken: null, // the picture's own colours underwrite it
  charcoal: '#141210',
  silk: '#efe7d6',
  print: '#efe6d2',
  mist: null, // fog sits *in front of* the picture, it does not replace it
};

const STROKE_AREA = { broken: 60, charcoal: 45, silk: 1500, mist: 22000 };

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
const lumaOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const hash1 = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * The direction a stroke at (x, y) follows, in radians. Each medium has a
 * different relationship between the picture and the brush:
 *   broken   — a slow swirl laid over the image (moving sky, moving water)
 *   charcoal — follows the picture's own luminance gradient, like a rubbed stick
 *   silk     — near-horizontal with a slow drift (a brush on absorbent paper)
 *   print    — a fixed screen angle; the tone lives in the dot, not the stroke
 *   glass    — long diagonals: the reflection, not the object
 */
function strokeField(kind, x, y, w, h, data, base) {
  if (kind === 'broken') {
    return base + 1.1 * Math.sin(x * 0.011 + y * 0.007) + 0.5 * Math.sin(y * 0.02 + 1.7);
  }
  if (kind === 'mist') return base; // no direction: a blob has no brush line
  if (kind === 'charcoal') {
    const at = (xx, yy) => {
      const cx = Math.max(0, Math.min(w - 1, Math.round(xx)));
      const cy = Math.max(0, Math.min(h - 1, Math.round(yy)));
      const i = (cy * w + cx) * 4;
      return lumaOf(data[i], data[i + 1], data[i + 2]);
    };
    const dx = at(x + 4, y) - at(x - 4, y);
    const dy = at(x, y + 4) - at(x, y - 4);
    return Math.atan2(dy, dx) + Math.PI / 2;
  }
  if (kind === 'silk') return base + 0.22 * Math.sin(x * 0.006);
  return base + Math.PI / 4;
}

/**
 * One stroke's colour, nudged off the sampled one so neighbours separate.
 *
 * The nudge is multiplicative, not a push away from mid-grey. A night picture is
 * mostly dark values, and shifting those by a constant destroys the silhouette
 * they encode — the first version turned a lit street into a blue swirl. Scaling
 * instead keeps 40 at 40±6 and 200 at 200±30, which is where paint varies anyway.
 */
function tilt(color, variation, brightness, seed) {
  const j = 1 + (hash1(seed * 3.7) - 0.5) * variation;
  return color.map((c) => clamp255(c * j * brightness));
}

function sampleColour(data, w, h, x, y, kind) {
  const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
  const i = (cy * w + cx) * 4;
  let r = data[i];
  let g = data[i + 1];
  let b = data[i + 2];
  if (kind === 'charcoal') {
    // Chalk is light and it sits on dark paper: the brighter the picture, the
    // whiter the stick. Multiplying the source down would just dim the image.
    const l = lumaOf(r, g, b) / 255;
    const k = 0.25 + 0.75 * l ** 1.15;
    r = r * (0.45 + 0.55 * k) + 232 * (1 - 0.45 - 0.55 * k);
    g = g * (0.45 + 0.55 * k) + 226 * (1 - 0.45 - 0.55 * k);
    b = b * (0.45 + 0.55 * k) + 214 * (1 - 0.45 - 0.55 * k);
  } else if (kind === 'silk') {
    // ink is darker than the picture, and it pools: keep the hue, drop the value
    const k = 0.3 + 0.55 * (lumaOf(r, g, b) / 255);
    r = 26 + (r - 26) * k;
    g = 28 + (g - 28) * k;
    b = 30 + (b - 30) * k;
  }
  return [r, g, b];
}

/**
 * The strokes, as data. Pure: no canvas, no DOM — a test can check them.
 * `density` 1 covers the surface roughly once in the medium's own stroke size.
 */
export function planStrokes({ w, h, data }, { kind = 'broken', angle = 0, density = 1, seed = 1, size = 1 } = {}) {
  const strokes = [];

  // A halftone is a lattice, not a scattering: the dot spacing *is* the screen.
  if (kind === 'print') {
    const step = Math.max(3, Math.round(6 / Math.max(0.2, density)));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const color = sampleColour(data, w, h, x, y, kind);
        const l = lumaOf(color[0], color[1], color[2]) / 255;
        // The dot is ink, so it keeps the colour but never goes lighter than the
        // paper: a halftone has no white dots, only bigger and smaller ones.
        strokes.push({
          x: x + (hash1(x * 0.7 + y) - 0.5) * step * 0.4,
          y: y + (hash1(y * 0.9 + x) - 0.5) * step * 0.4,
          r: Math.max(0.4, (1 - l) * step * 0.72),
          color,
          alpha: 1,
          kind,
        });
      }
    }
    return strokes;
  }

  // Strokes are sized relative to the frame, so a 640-wide render and a 1920-wide
  // render of the same scene read as the same painting rather than as paint and
  // confetti.
  const u = (Math.min(w, h) / 600) * size;
  const count = Math.round(((w * h) / ((STROKE_AREA[kind] ?? 110) * u * u)) * density);
  for (let i = 0; i < count; i++) {
    const x = hash1(i * 3.1 + seed * 17.3) * w;
    const y = hash1(i * 7.7 + seed * 23.9) * h;
    const color = sampleColour(data, w, h, x, y, kind);
    const a = strokeField(kind, x, y, w, h, data, angle);
    const jitter = hash1(i * 11.3 + seed) - 0.5;
    if (kind === 'mist') {
      // Soft material: a big translucent blob with no edge at all. Fog, steam,
      // breath on glass — anything whose whole character is an absence of edge.
      strokes.push({
        x, y, a: 0, len: 0, wid: 0,
        r: (60 + hash1(i + 5) * 120) * u,
        color: tilt(color, 0.08, 1.04, i + seed),
        // Fog softens; it does not erase. Anything above ~0.08 stacked a dozen
        // deep turns a detailed picture into a flat wash.
        alpha: 0.02 + hash1(i + 13) * 0.05,
        kind,
      });
    } else if (kind === 'silk') {
      strokes.push({
        x, y, a: a + jitter * 0.2, len: (50 + hash1(i + 5) * 110) * u, wid: (10 + hash1(i + 9) * 26) * u,
        color: tilt(color, 0.14, 0.96, i + seed), alpha: 0.16 + hash1(i + 13) * 0.26, kind,
      });
    } else if (kind === 'charcoal') {
      strokes.push({
        x, y, a: a + jitter * 0.35, len: (9 + hash1(i + 3) * 24) * u, wid: (2 + hash1(i + 8) * 5) * u,
        color, alpha: 0.12 + hash1(i + 11) * 0.32, kind,
      });
    } else {
      // paint separates from its own ground by value, not by hue
      strokes.push({
        x, y, a: a + jitter * 0.3, len: (14 + hash1(i + 3) * 30) * u, wid: (4 + hash1(i + 8) * 7) * u,
        color: tilt(color, 0.34, 1, i + seed),
        alpha: 0.86 + hash1(i + 11) * 0.14, kind,
      });
    }
  }
  return strokes;
}

/** Draw pre-planned strokes. The only part that needs a canvas. */
export function drawStrokes(g, strokes) {
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const path = (s) => {
    const dx = Math.cos(s.a) * s.len * 0.5;
    const dy = Math.sin(s.a) * s.len * 0.5;
    const bend = 0.22 * s.len * (s.a > 0 ? 1 : -1);
    g.beginPath();
    g.moveTo(s.x - dx, s.y - dy);
    // one quadratic bend: a straight stroke reads as a smear, not a brush
    g.quadraticCurveTo(s.x - dy * bend * 0.04, s.y + dx * bend * 0.04, s.x + dx, s.y + dy);
  };
  const rgb = (c, k = 1) =>
    `rgb(${clamp255(c[0] * k) | 0},${clamp255(c[1] * k) | 0},${clamp255(c[2] * k) | 0})`;

  for (const s of strokes) {
    if (s.kind === 'mist') {
      // A radial gradient, not a filled circle: the falloff *is* the material.
      const grad = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r);
      const rgbStr = `rgb(${clamp255(s.color[0]) | 0},${clamp255(s.color[1]) | 0},${clamp255(s.color[2]) | 0})`;
      grad.addColorStop(0, rgbStr);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = s.alpha;
      g.fillStyle = grad;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    if (s.kind === 'print') {
      g.globalAlpha = s.alpha;
      g.fillStyle = rgb(s.color);
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    // Impasto edge: a darker pass slightly wider than the stroke, then the
    // stroke itself. Paint has a lit side and a shadowed side; without that the
    // surface reads as a soft gradient, which is what a filter looks like.
    // Only where there is light to catch. On a dark stroke the darker edge is
    // the loudest thing in it, and a night full of those reads as fur.
    const lit = 0.299 * s.color[0] + 0.587 * s.color[1] + 0.114 * s.color[2] > 62;
    if ((s.kind === 'broken' || s.kind === 'silk') && lit) {
      g.globalAlpha = Math.min(1, s.alpha * 0.55);
      g.strokeStyle = rgb(s.color, 0.72);
      g.lineWidth = s.wid * 1.45;
      path(s);
      g.stroke();
    }
    g.globalAlpha = s.alpha;
    g.strokeStyle = rgb(s.color);
    g.lineWidth = s.wid;
    path(s);
    g.stroke();
  }
  g.restore();
}

/**
 * Repaint `src` as a medium. Returns a new canvas the size of the source.
 *
 * The ground matters: paint goes onto a surface, so the picture's own colour is
 * laid down first (softened) and the strokes go over it. Without that, a pass at
 * low density leaves holes and reads as a filter, not as material.
 */
export function repaint(src, opts = {}) {
  const w = opts.width ?? src.width ?? src.naturalWidth;
  const h = opts.height ?? src.height ?? src.naturalHeight;
  const kind = opts.kind ?? 'broken';

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');

  if (GROUND[kind]) {
    g.fillStyle = GROUND[kind];
    g.fillRect(0, 0, w, h);
  }

  // The halftone is the one medium with no picture underneath: the dots *are*
  // the tone, so an image under them would only dull the screen.
  if (kind !== 'print') {
    const small = document.createElement('canvas');
    small.width = Math.max(2, Math.round(w / 8));
    small.height = Math.max(2, Math.round(h / 8));
    const sg = small.getContext('2d');
    sg.imageSmoothingEnabled = true;
    sg.drawImage(src, 0, 0, small.width, small.height);
    g.save();
    // No paper under `broken`, so the ground has to be opaque or the whole
    // canvas comes out half-transparent and composites as a dark stain.
    g.globalAlpha = GROUND[kind] ? (kind === 'charcoal' ? 0.4 : 0.62) : 1;
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, w, h);
    g.restore();
  }

  const read = document.createElement('canvas');
  read.width = w;
  read.height = h;
  const rg = read.getContext('2d', { willReadFrequently: true });
  rg.drawImage(src, 0, 0, w, h);
  const { data } = rg.getImageData(0, 0, w, h);

  drawStrokes(g, planStrokes({ w, h, data }, { ...opts, kind }));
  return canvas;
}

/**
 * Film: the one channel that does not repaint. A picture that is already right
 * still reads as "rendered" until it has been through a lens — halation on the
 * highlights, grain, and a vignette that lets the edges fall away.
 */
export function film(src, opts = {}) {
  const w = opts.width ?? src.width ?? src.naturalWidth;
  const h = opts.height ?? src.height ?? src.naturalHeight;
  const grain = opts.grain ?? 0.055;
  const halo = opts.halation ?? 0.22;
  const vig = opts.vignette ?? 0.55;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.drawImage(src, 0, 0, w, h);

  // halation: the brightest parts bleed into their neighbours
  const small = document.createElement('canvas');
  small.width = Math.max(2, Math.round(w / 6));
  small.height = Math.max(2, Math.round(h / 6));
  const sg = small.getContext('2d');
  if ('filter' in sg) sg.filter = 'brightness(1.5) contrast(1.8) blur(5px)';
  sg.drawImage(src, 0, 0, small.width, small.height);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = halo;
  g.drawImage(small, 0, 0, w, h);
  g.restore();

  // grain, seeded: an image without noise reads as an illustration
  if (grain > 0) {
    const noise = document.createElement('canvas');
    noise.width = w;
    noise.height = h;
    const ng = noise.getContext('2d');
    const img = ng.createImageData(w, h);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const v = 128 + (hash1(i * 0.37 + (opts.seed ?? 1) * 11.3) - 0.5) * 255;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
      img.data[p + 3] = 255;
    }
    ng.putImageData(img, 0, 0);
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = grain;
    g.drawImage(noise, 0, 0);
    g.restore();
  }

  if (vig > 0) {
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${vig})`);
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  }
  return canvas;
}

/** The material channel: per-surface helpers above, whole-picture passes here. */
export const medium = {
  paper,
  inkStroke,
  halftone,
  bleed,
  broken: (src, opts) => repaint(src, { ...opts, kind: 'broken' }),
  mist: (src, opts) => repaint(src, { ...opts, kind: 'mist' }),
  charcoal: (src, opts) => repaint(src, { ...opts, kind: 'charcoal' }),
  silk: (src, opts) => repaint(src, { ...opts, kind: 'silk' }),
  print: (src, opts) => repaint(src, { ...opts, kind: 'print' }),
  film,
  repaint,
  planStrokes,
  drawStrokes,
  KINDS: ['broken', 'charcoal', 'silk', 'print', 'mist'],
};
