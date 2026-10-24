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
