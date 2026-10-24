// src/medium.mjs
var cache = /* @__PURE__ */ new Map();
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
var rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function paper(g, w, h, { base = [239, 228, 205], seed = 5, mottle = 16, grain: grain2 = 9 } = {}) {
  const key = `paper:${w}x${h}:${base.join(",")}:${seed}:${mottle}:${grain2}`;
  if (!cache.has(key)) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const cg = c.getContext("2d");
    const img = cg.createImageData(w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const low = (fbm(x * 35e-4, y * 35e-4, seed, 4) - 0.5) * mottle;
        const mid = (fbm(x * 0.02, y * 0.02, seed + 9, 3) - 0.5) * mottle * 0.5;
        const fine = (hash2(x, y, seed + 3) - 0.5) * grain2;
        const warm = fbm(x * 6e-3, y * 6e-3, seed + 21, 2) * 6;
        d[i] = base[0] + low + mid + fine + warm;
        d[i + 1] = base[1] + low + mid + fine + warm * 0.7;
        d[i + 2] = base[2] + low + mid + fine - warm * 0.3;
        d[i + 3] = 255;
      }
    }
    cg.putImageData(img, 0, 0);
    const r = (n) => hash2(n, 7, seed);
    cg.lineWidth = 0.7;
    for (let i = 0; i < Math.round(w * h / 5200); i++) {
      const x = r(i) * w;
      const y = r(i + 991) * h;
      const len = 4 + r(i + 17) * 16;
      const ang = r(i + 33) * Math.PI;
      cg.strokeStyle = r(i + 55) > 0.5 ? "rgba(255,252,240,0.35)" : "rgba(120,102,80,0.12)";
      cg.beginPath();
      cg.moveTo(x, y);
      cg.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
      cg.stroke();
    }
    cache.set(key, c);
  }
  g.drawImage(cache.get(key), 0, 0, w, h);
}
function inkStroke(g, pts, { width = 6, color = [38, 30, 22], dry = 0.45, seed = 1, cap = "round" } = {}) {
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
  for (let k = 0; k < 5; k++) {
    const off = (k / 4 - 0.5) * 0.9;
    g.strokeStyle = rgb(color, 0.18 + hash2(k, seed, 5) * 0.3);
    g.lineWidth = Math.max(0.6, width / 5 * (0.6 + hash2(k, seed, 9) * 0.8));
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
function halftone(g, w, h, { cell = 4, alpha = 0.1, seed = 2 } = {}) {
  const key = `halftone:${cell}:${seed}`;
  if (!cache.has(key)) {
    const c = document.createElement("canvas");
    c.width = cell * 2;
    c.height = cell * 2;
    const cg = c.getContext("2d");
    cg.fillStyle = "rgba(0,0,0,0)";
    cg.fillRect(0, 0, cell * 2, cell * 2);
    for (const [dx, dy] of [[0, 0], [cell, cell]]) {
      cg.fillStyle = "rgba(0,0,0,1)";
      cg.beginPath();
      cg.arc(dx + cell / 2, dy + cell / 2, cell * 0.3, 0, Math.PI * 2);
      cg.fill();
    }
    cache.set(key, c);
  }
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = g.createPattern(cache.get(key), "repeat");
  g.fillRect(0, 0, w, h);
  g.restore();
}
function bleed(g, w, h, { color = [38, 30, 22], amount = 0.12 } = {}) {
  if (amount <= 0) return;
  g.save();
  g.globalCompositeOperation = "multiply";
  const grad = g.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.42, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
  grad.addColorStop(0, rgb(color, 0));
  grad.addColorStop(1, rgb(color, amount));
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  g.restore();
}
var GROUND = {
  broken: null,
  // the picture's own colours underwrite it
  charcoal: "#141210",
  silk: "#efe7d6",
  print: "#efe6d2"
};
var STROKE_AREA = { broken: 60, charcoal: 45, silk: 1500 };
var clamp255 = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
var lumaOf = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
var hash1 = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function strokeField(kind, x, y, w, h, data, base) {
  if (kind === "broken") {
    return base + 1.1 * Math.sin(x * 0.011 + y * 7e-3) + 0.5 * Math.sin(y * 0.02 + 1.7);
  }
  if (kind === "charcoal") {
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
  if (kind === "silk") return base + 0.22 * Math.sin(x * 6e-3);
  return base + Math.PI / 4;
}
function tilt(color, contrast, brightness, seed) {
  const mid = 118;
  const j = 0.82 + hash1(seed * 3.7) * 0.36;
  return color.map((c) => clamp255(mid + (c - mid) * contrast * brightness * j));
}
function sampleColour(data, w, h, x, y, kind) {
  const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
  const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
  const i = (cy * w + cx) * 4;
  let r = data[i];
  let g = data[i + 1];
  let b = data[i + 2];
  if (kind === "charcoal") {
    const l = lumaOf(r, g, b) / 255;
    const k = 0.25 + 0.75 * l ** 1.15;
    r = r * (0.45 + 0.55 * k) + 232 * (1 - 0.45 - 0.55 * k);
    g = g * (0.45 + 0.55 * k) + 226 * (1 - 0.45 - 0.55 * k);
    b = b * (0.45 + 0.55 * k) + 214 * (1 - 0.45 - 0.55 * k);
  } else if (kind === "silk") {
    const k = 0.3 + 0.55 * (lumaOf(r, g, b) / 255);
    r = 26 + (r - 26) * k;
    g = 28 + (g - 28) * k;
    b = 30 + (b - 30) * k;
  }
  return [r, g, b];
}
function planStrokes({ w, h, data }, { kind = "broken", angle = 0, density = 1, seed = 1 } = {}) {
  const strokes = [];
  if (kind === "print") {
    const step = Math.max(3, Math.round(6 / Math.max(0.2, density)));
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const color = sampleColour(data, w, h, x, y, kind);
        const l = lumaOf(color[0], color[1], color[2]) / 255;
        strokes.push({
          x: x + (hash1(x * 0.7 + y) - 0.5) * step * 0.4,
          y: y + (hash1(y * 0.9 + x) - 0.5) * step * 0.4,
          r: Math.max(0.4, (1 - l) * step * 0.72),
          color,
          alpha: 1,
          kind
        });
      }
    }
    return strokes;
  }
  const u = Math.min(w, h) / 600;
  const count = Math.round(w * h / ((STROKE_AREA[kind] ?? 110) * u * u) * density);
  for (let i = 0; i < count; i++) {
    const x = hash1(i * 3.1 + seed * 17.3) * w;
    const y = hash1(i * 7.7 + seed * 23.9) * h;
    const color = sampleColour(data, w, h, x, y, kind);
    const a = strokeField(kind, x, y, w, h, data, angle);
    const jitter = hash1(i * 11.3 + seed) - 0.5;
    if (kind === "silk") {
      strokes.push({
        x,
        y,
        a: a + jitter * 0.2,
        len: (50 + hash1(i + 5) * 110) * u,
        wid: (10 + hash1(i + 9) * 26) * u,
        color: tilt(color, 1.05, 0.95, i + seed),
        alpha: 0.16 + hash1(i + 13) * 0.26,
        kind
      });
    } else if (kind === "charcoal") {
      strokes.push({
        x,
        y,
        a: a + jitter * 0.35,
        len: (9 + hash1(i + 3) * 24) * u,
        wid: (2 + hash1(i + 8) * 5) * u,
        color,
        alpha: 0.12 + hash1(i + 11) * 0.32,
        kind
      });
    } else {
      strokes.push({
        x,
        y,
        a: a + jitter * 0.3,
        len: (14 + hash1(i + 3) * 30) * u,
        wid: (4 + hash1(i + 8) * 7) * u,
        color: tilt(color, 1.22, 1, i + seed),
        alpha: 0.86 + hash1(i + 11) * 0.14,
        kind
      });
    }
  }
  return strokes;
}
function drawStrokes(g, strokes) {
  g.save();
  g.lineCap = "round";
  g.lineJoin = "round";
  const path = (s) => {
    const dx = Math.cos(s.a) * s.len * 0.5;
    const dy = Math.sin(s.a) * s.len * 0.5;
    const bend = 0.22 * s.len * (s.a > 0 ? 1 : -1);
    g.beginPath();
    g.moveTo(s.x - dx, s.y - dy);
    g.quadraticCurveTo(s.x - dy * bend * 0.04, s.y + dx * bend * 0.04, s.x + dx, s.y + dy);
  };
  const rgb2 = (c, k = 1) => `rgb(${clamp255(c[0] * k) | 0},${clamp255(c[1] * k) | 0},${clamp255(c[2] * k) | 0})`;
  for (const s of strokes) {
    if (s.kind === "print") {
      g.globalAlpha = s.alpha;
      g.fillStyle = rgb2(s.color);
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    if (s.kind === "broken" || s.kind === "silk") {
      g.globalAlpha = Math.min(1, s.alpha * 0.55);
      g.strokeStyle = rgb2(s.color, 0.72);
      g.lineWidth = s.wid * 1.45;
      path(s);
      g.stroke();
    }
    g.globalAlpha = s.alpha;
    g.strokeStyle = rgb2(s.color);
    g.lineWidth = s.wid;
    path(s);
    g.stroke();
  }
  g.restore();
}
function repaint(src, opts = {}) {
  const w = opts.width ?? src.width ?? src.naturalWidth;
  const h = opts.height ?? src.height ?? src.naturalHeight;
  const kind = opts.kind ?? "broken";
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  if (GROUND[kind]) {
    g.fillStyle = GROUND[kind];
    g.fillRect(0, 0, w, h);
  }
  if (kind !== "print") {
    const small = document.createElement("canvas");
    small.width = Math.max(2, Math.round(w / 8));
    small.height = Math.max(2, Math.round(h / 8));
    const sg = small.getContext("2d");
    sg.imageSmoothingEnabled = true;
    sg.drawImage(src, 0, 0, small.width, small.height);
    g.save();
    g.globalAlpha = GROUND[kind] ? kind === "charcoal" ? 0.4 : 0.62 : 1;
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, w, h);
    g.restore();
  }
  const read = document.createElement("canvas");
  read.width = w;
  read.height = h;
  const rg = read.getContext("2d", { willReadFrequently: true });
  rg.drawImage(src, 0, 0, w, h);
  const { data } = rg.getImageData(0, 0, w, h);
  drawStrokes(g, planStrokes({ w, h, data }, { ...opts, kind }));
  return canvas;
}
function film(src, opts = {}) {
  const w = opts.width ?? src.width ?? src.naturalWidth;
  const h = opts.height ?? src.height ?? src.naturalHeight;
  const grain2 = opts.grain ?? 0.055;
  const halo = opts.halation ?? 0.22;
  const vig = opts.vignette ?? 0.55;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext("2d");
  g.drawImage(src, 0, 0, w, h);
  const small = document.createElement("canvas");
  small.width = Math.max(2, Math.round(w / 6));
  small.height = Math.max(2, Math.round(h / 6));
  const sg = small.getContext("2d");
  if ("filter" in sg) sg.filter = "brightness(1.5) contrast(1.8) blur(5px)";
  sg.drawImage(src, 0, 0, small.width, small.height);
  g.save();
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = halo;
  g.drawImage(small, 0, 0, w, h);
  g.restore();
  if (grain2 > 0) {
    const noise2 = document.createElement("canvas");
    noise2.width = w;
    noise2.height = h;
    const ng = noise2.getContext("2d");
    const img = ng.createImageData(w, h);
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const v = 128 + (hash1(i * 0.37 + (opts.seed ?? 1) * 11.3) - 0.5) * 255;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = v;
      img.data[p + 3] = 255;
    }
    ng.putImageData(img, 0, 0);
    g.save();
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = grain2;
    g.drawImage(noise2, 0, 0);
    g.restore();
  }
  if (vig > 0) {
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.28, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, `rgba(0,0,0,${vig})`);
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  }
  return canvas;
}
var medium = {
  paper,
  inkStroke,
  halftone,
  bleed,
  broken: (src, opts) => repaint(src, { ...opts, kind: "broken" }),
  charcoal: (src, opts) => repaint(src, { ...opts, kind: "charcoal" }),
  silk: (src, opts) => repaint(src, { ...opts, kind: "silk" }),
  print: (src, opts) => repaint(src, { ...opts, kind: "print" }),
  film,
  repaint,
  planStrokes,
  drawStrokes,
  KINDS: ["broken", "charcoal", "silk", "print"]
};

// src/starters.mjs
var LOOP_SECONDS = 6;
var CATEGORIES = ["\u5168\u90E8", "\u6587\u5B57\u6392\u7248", "\u4FE1\u606F\u56FE\u89E3", "\u754C\u9762\u6F14\u793A", "\u573A\u666F\u53D9\u4E8B", "\u80CC\u666F\u7279\u6548"];
var TAU = Math.PI * 2;
var clamp01 = (v) => Math.min(1, Math.max(0, v));
var ease = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
var outCubic = (v) => 1 - (1 - clamp01(v)) ** 3;
var span = (t, from, to) => ease((t - from) / (to - from));
var noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
var SERIF = '"Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif';
var SANS = '-apple-system, "system-ui", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif';
var MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
var LOOKS = {
  desk: { bg: "#e9dbc9", ink: "#1b1712", dim: "rgba(27,23,18,0.5)" },
  paper: { bg: "#ece2cc", ink: "#1d1a16", dim: "rgba(29,26,22,0.55)", accent: "#3d8b86" },
  night: { bg: "#08090b", ink: "#ececea", dim: "rgba(236,236,234,0.45)", accent: "#7ee787" },
  lime: { bg: "#d9ff3d", ink: "#101010", dim: "rgba(16,16,16,0.5)" },
  navy: { bg: "#0b1322", ink: "#efece2", dim: "rgba(239,236,226,0.5)", accent: "#d8a94a" },
  dusk: { bg: "#140c26", ink: "#f6ecff", dim: "rgba(246,236,255,0.5)", accent: "#ff86c2" },
  plate: { bg: "#eee3cb", ink: "#2a2118", dim: "rgba(42,33,24,0.55)", accent: "#b04a2e", finish: false }
};
function ground(g, w, h, look) {
  g.fillStyle = look.bg;
  g.fillRect(0, 0, w, h);
}
function veil(g, w, h, t, look) {
  const fade = 1 - Math.min(1, t / 0.45) * Math.min(1, (LOOP_SECONDS - t) / 0.5);
  if (fade <= 0) return;
  g.save();
  g.globalAlpha = fade;
  g.fillStyle = look.bg;
  g.fillRect(0, 0, w, h);
  g.restore();
}
function label(g, text, x, y, size, color, p, track = "0.24em", font = MONO) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = p;
  g.fillStyle = color;
  g.font = `500 ${size}px ${font}`;
  g.letterSpacing = track;
  g.fillText(text, x, y);
  g.letterSpacing = "0em";
  g.restore();
}
function line(g, x, y, width, color, p) {
  if (p <= 0) return;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + width * ease(p), y);
  g.stroke();
  g.restore();
}
var brief = (what, detail) => `${what}\u3002${detail} \u5199\u5728\u5DE5\u4F5C\u533A\u7684 motion/ \u91CC\uFF08timeline.json + scenes\uFF09\uFF0C\u8DD1 \`dsh-motion validate\`\uFF0C\u518D\u628A\u5173\u952E\u5E27\u7ED9\u6211\u770B\u3002`;
function glassCard(g, x, y, w, h, card, p) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = Math.min(1, p * 1.6);
  g.shadowColor = "rgba(60, 40, 20, 0.26)";
  g.shadowBlur = h * 0.18;
  g.shadowOffsetY = h * 0.06;
  g.fillStyle = "rgba(255, 255, 255, 0.92)";
  g.beginPath();
  g.roundRect(x, y + (1 - p) * h * 0.25, w, h, Math.max(6, w * 0.035));
  g.fill();
  g.restore();
  const top = y + (1 - p) * h * 0.25;
  g.save();
  g.globalAlpha = Math.min(1, p * 1.6);
  g.fillStyle = card.tile;
  g.beginPath();
  g.roundRect(x + w * 0.06, top + h * 0.16, w * 0.17, w * 0.17, Math.max(3, w * 0.025));
  g.fill();
  g.fillStyle = card.glyph;
  for (let i = 0; i < 3; i++) {
    g.fillRect(x + w * 0.09, top + h * 0.22 + i * w * 0.045, w * 0.11 * (i === 1 ? 0.7 : 1), Math.max(1, w * 0.012));
  }
  g.fillStyle = "rgba(27,23,18,0.55)";
  g.font = `600 ${Math.max(6, w * 0.038)}px ${MONO}`;
  g.letterSpacing = "0.16em";
  g.fillText(card.step, x + w * 0.3, top + h * 0.26);
  g.letterSpacing = "0em";
  g.fillStyle = "#1b1712";
  g.font = `600 ${Math.max(8, w * 0.062)}px ${SANS}`;
  g.fillText(card.title, x + w * 0.3, top + h * 0.5);
  g.fillStyle = "rgba(27,23,18,0.58)";
  g.font = `400 ${Math.max(6, w * 0.042)}px ${SANS}`;
  g.fillText(card.note, x + w * 0.3, top + h * 0.66);
  g.fillStyle = "rgba(27,23,18,0.1)";
  g.fillRect(x + w * 0.06, top + h * 0.82, w * 0.88, Math.max(1, h * 0.012));
  g.fillStyle = card.tile;
  g.fillRect(x + w * 0.06, top + h * 0.82, w * 0.88 * Math.min(1, p * 0.8), Math.max(1, h * 0.012));
  g.restore();
}
function boardRow(g, x, y, w, h, row, p, highlight) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = p;
  if (highlight) {
    g.fillStyle = "rgba(126, 231, 135, 0.1)";
    g.beginPath();
    g.roundRect(x - w * 0.01, y, w, h, Math.max(3, h * 0.3));
    g.fill();
    g.fillStyle = "rgba(126, 231, 135, 0.5)";
    g.fillRect(x - w * 0.01, y + h * 0.2, Math.max(1.5, w * 4e-3), h * 0.6);
  }
  g.fillStyle = highlight ? "rgba(126,231,135,0.9)" : "rgba(236,236,234,0.42)";
  g.font = `500 ${Math.max(8, h * 0.42)}px ${MONO}`;
  g.fillText(row.rank, x + w * 0.02, y + h * 0.7);
  g.fillStyle = highlight ? "#7ee787" : "#ececea";
  g.font = `600 ${Math.max(9, h * 0.6)}px ${SANS}`;
  g.fillText(row.name, x + w * 0.1, y + h * 0.74);
  g.fillStyle = highlight ? "#7ee787" : "rgba(236,236,234,0.86)";
  g.font = `500 ${Math.max(9, h * 0.56)}px ${MONO}`;
  g.textAlign = "right";
  g.fillText(row.score, x + w * 0.93, y + h * 0.72);
  g.textAlign = "left";
  g.restore();
}
var SAMPLES = [
  {
    id: "desk",
    title: "\u4EA7\u54C1\u7247",
    tag: "\u754C\u9762\u6F14\u793A",
    ratio: 16 / 9,
    template: "desk",
    featured: true,
    look: { ...LOOKS.desk, medium: "photo" },
    prompt: brief(
      "\u590D\u523B\u8FD9\u4E2A\u52A8\u6548\uFF1A\u6696\u8272\u623F\u95F4\u91CC\u4E00\u53F0\u7B14\u8BB0\u672C\u7535\u8111\uFF0C\u5C4F\u5E55\u91CC\u662F\u4E00\u4E2A\u771F\u5B9E\u7684\u4EA7\u54C1\u754C\u9762\uFF08\u6DF1\u8272\u4FA7\u680F + \u4E00\u5927\u5757\u6A58\u7EA2\u4E3B\u89C6\u89C9\uFF09\uFF0C\u4E09\u5F20\u767D\u8272\u6B65\u9AA4\u5361\u4ECE\u4E0B\u6D6E\u5230\u524D\u666F\uFF0C\u9876\u90E8\u4E00\u6761\u80F6\u56CA\u5199\u7740\u8FD9\u6B21\u8981\u505A\u4EC0\u4E48",
      "\u8981\u6C42\uFF1A\u80CC\u666F\u6709\u666F\u6DF1\u3001\u5361\u7247\u6709\u67D4\u548C\u6295\u5F71\u548C\u8F7B\u5FAE\u89C6\u5DEE\u3001\u5361\u7247\u4F9D\u6B21\u9519\u5F00 0.15 \u79D2\uFF1B\u4E09\u5F20\u5361\u4E0D\u906E\u4F4F\u5C4F\u5E55\u4E3B\u4F53\uFF1B\u6696\u8C03\u914D\u8272\uFF0C\u4E0D\u8981\u8367\u5149\u3002"
    ),
    draw(g, w, h, t) {
      const look = this.look;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#d8c2a4");
      bg.addColorStop(0.55, "#b19373");
      bg.addColorStop(1, "#7a5f45");
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
      g.save();
      g.filter = `blur(${Math.max(8, w * 0.022)}px)`;
      g.fillStyle = "rgba(203,180,150,0.75)";
      g.beginPath();
      g.ellipse(w * 0.92, h * 0.18, w * 0.12, h * 0.2, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(255,251,243,0.34)";
      g.beginPath();
      g.ellipse(w * 0.1, h * 0.12, w * 0.15, h * 0.13, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgba(124,146,92,0.45)";
      g.beginPath();
      g.ellipse(w * 0.96, h * 0.62, w * 0.14, h * 0.16, 0, 0, TAU);
      g.fill();
      g.restore();
      const cam = 1 + t / LOOP_SECONDS * 0.06 + Math.sin(t * 0.3) * 4e-3;
      g.save();
      g.translate(w / 2, h / 2);
      g.scale(cam, cam);
      g.translate(-w / 2, -h / 2);
      g.save();
      g.filter = `blur(${Math.max(5, w * 0.012)}px)`;
      g.fillStyle = "rgba(90, 66, 44, 0.28)";
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.8, w * 0.36, h * 0.045, 0, 0, TAU);
      g.fill();
      g.restore();
      const poly = (pts, fill) => {
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
        g.fillStyle = fill;
        g.fill();
      };
      g.save();
      g.globalCompositeOperation = "lighter";
      const spill = g.createRadialGradient(w * 0.5, h * 0.42, h * 0.04, w * 0.5, h * 0.42, w * 0.55);
      spill.addColorStop(0, "rgba(255, 244, 222, 0.22)");
      spill.addColorStop(0.45, "rgba(255, 236, 206, 0.07)");
      spill.addColorStop(1, "rgba(255, 236, 206, 0)");
      g.fillStyle = spill;
      g.fillRect(0, 0, w, h);
      g.restore();
      const lid = g.createLinearGradient(0, h * 0.19, 0, h * 0.67);
      lid.addColorStop(0, "#2c2c33");
      lid.addColorStop(0.5, "#1e1e24");
      lid.addColorStop(1, "#141418");
      poly([[w * 0.17, h * 0.19], [w * 0.83, h * 0.19], [w * 0.87, h * 0.67], [w * 0.13, h * 0.67]], lid);
      const screen = [[w * 0.185, h * 0.205], [w * 0.815, h * 0.205], [w * 0.853, h * 0.652], [w * 0.147, h * 0.652]];
      poly(screen, "#fbf8f2");
      g.save();
      g.beginPath();
      g.moveTo(screen[0][0], screen[0][1]);
      for (let i = 1; i < 4; i++) g.lineTo(screen[i][0], screen[i][1]);
      g.closePath();
      g.clip();
      const sx = screen[0][0];
      const sy = screen[0][1];
      const sw = screen[1][0] - screen[0][0];
      const sh = screen[3][1] - screen[0][1];
      g.fillStyle = "#f1ece3";
      g.fillRect(sx, sy, sw, sh * 0.12);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = ["#e7a39c", "#d9d3c7", "#cfc8ba"][i];
        g.beginPath();
        g.arc(sx + sw * 0.035 + i * sw * 0.026, sy + sh * 0.06, Math.max(1.2, sw * 6e-3), 0, TAU);
        g.fill();
      }
      g.fillStyle = "#e2dbcf";
      g.beginPath();
      g.roundRect(sx + sw * 0.14, sy + sh * 0.033, sw * 0.66, sh * 0.055, sh * 0.028);
      g.fill();
      g.fillStyle = "#332b25";
      g.fillRect(sx, sy + sh * 0.12, sw * 0.12, sh * 0.88);
      for (let i = 0; i < 5; i++) {
        g.fillStyle = i === 1 ? "#e78a6a" : "rgba(255,255,255,0.16)";
        g.beginPath();
        g.roundRect(sx + sw * 0.038, sy + sh * (0.19 + i * 0.1), sw * 0.045, sw * 0.045, sw * 0.01);
        g.fill();
      }
      const hx = sx + sw * 0.19;
      const hy = sy + sh * 0.17;
      const hw = sw * 0.68;
      const hh = sh * 0.5;
      const hero = g.createLinearGradient(hx, hy, hx + hw, hy + hh);
      hero.addColorStop(0, "#d0603f");
      hero.addColorStop(1, "#b0402c");
      g.fillStyle = hero;
      g.beginPath();
      g.roundRect(hx, hy, hw, hh, Math.max(2, sw * 0.012));
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.92)";
      g.fillRect(hx + hw * 0.07, hy + hh * 0.16, hw * 0.5, Math.max(2, sh * 0.028));
      g.fillStyle = "rgba(255,255,255,0.55)";
      g.fillRect(hx + hw * 0.07, hy + hh * 0.3, hw * 0.34, Math.max(1.5, sh * 0.018));
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.beginPath();
      g.roundRect(hx + hw * 0.07, hy + hh * 0.66, hw * 0.24, hh * 0.2, hh * 0.1);
      g.fill();
      g.restore();
      const deck = g.createLinearGradient(0, h * 0.67, 0, h * 0.87);
      deck.addColorStop(0, "#e6ded0");
      deck.addColorStop(0.35, "#cfc6b6");
      deck.addColorStop(1, "#a99e8b");
      poly([[w * 0.13, h * 0.67], [w * 0.87, h * 0.67], [w * 0.98, h * 0.87], [w * 0.02, h * 0.87]], deck);
      g.save();
      g.globalCompositeOperation = "lighter";
      const pool = g.createRadialGradient(w * 0.5, h * 0.69, 0, w * 0.5, h * 0.69, w * 0.42);
      pool.addColorStop(0, "rgba(255, 246, 228, 0.22)");
      pool.addColorStop(1, "rgba(255, 246, 228, 0)");
      g.fillStyle = pool;
      g.fillRect(w * 0.02, h * 0.67, w * 0.96, h * 0.2);
      g.restore();
      for (let r = 0; r < 4; r++) {
        const inset = w * (0.2 + r * 0.015);
        const y = h * (0.7 + r * 0.04);
        const span2 = w - inset * 2;
        const kw = span2 / 12 * 0.82;
        for (let c = 0; c < 12; c++) {
          g.fillStyle = "rgba(120, 108, 92, 0.28)";
          g.beginPath();
          g.roundRect(inset + span2 / 12 * c + (span2 / 12 - kw) / 2, y, kw, h * 0.026, h * 6e-3);
          g.fill();
        }
      }
      g.restore();
      const cards = [
        { x: 0.05, y: 0.58, tile: "#c8f24a", glyph: "rgba(16,16,16,0.7)", step: "STEP 01", title: "Lift", note: "+11 m travel" },
        { x: 0.36, y: 0.62, tile: "#e7a39c", glyph: "rgba(255,255,255,0.85)", step: "STEP 02", title: "Body", note: "frame-ready" },
        { x: 0.67, y: 0.58, tile: "#1b1712", glyph: "rgba(255,255,255,0.85)", step: "STEP 03", title: "Build", note: "ready" }
      ];
      const cw = w * 0.28;
      const ch = h * 0.24;
      const leave = span(t, 4.5, 5.4);
      cards.forEach((card, i) => {
        const enter = outCubic((t - 0.3 - i * 0.15) / 0.55);
        const out = 1 - leave;
        const y = h * card.y + leave * h * 0.22;
        if (out <= 0.01) return;
        g.save();
        g.globalAlpha = out;
        glassCard(g, w * card.x, y, cw, ch, card, Math.min(enter, out));
        g.restore();
      });
      const pill = span(t, 0.1, 0.6);
      g.save();
      g.globalAlpha = pill;
      const pw = w * 0.44;
      const ph = h * 0.09;
      const px = w * 0.5 - pw / 2;
      const py = h * 0.04 + (1 - pill) * -h * 0.03;
      g.shadowColor = "rgba(60, 40, 20, 0.22)";
      g.shadowBlur = h * 0.05;
      g.fillStyle = "#fdfaf4";
      g.beginPath();
      g.roundRect(px, py, pw, ph, ph / 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = "#1b1712";
      g.beginPath();
      g.roundRect(px + pw * 0.035, py + ph * 0.22, ph * 0.56, ph * 0.56, ph * 0.16);
      g.fill();
      g.fillStyle = "#1b1712";
      g.font = `500 ${Math.max(7, h * 0.04)}px ${SANS}`;
      g.fillText("Planning with MCP", px + pw * 0.13, py + ph * 0.44);
      g.fillStyle = "rgba(27,23,18,0.45)";
      g.font = `500 ${Math.max(6, h * 0.03)}px ${SANS}`;
      g.fillText("build steps", px + pw * 0.13, py + ph * 0.74);
      g.fillStyle = "#c4553f";
      g.font = `600 ${Math.max(8, h * 0.043)}px ${MONO}`;
      g.textAlign = "right";
      g.fillText("0/3", px + pw * 0.95, py + ph * 0.62);
      g.textAlign = "left";
      g.restore();
      veil(g, w, h, t, look);
    }
  },
  {
    id: "guide",
    title: "\u56FE\u9274",
    tag: "\u4FE1\u606F\u56FE\u89E3",
    ratio: 4 / 3,
    template: "guide",
    look: { ...LOOKS.paper, medium: "print" },
    prompt: brief(
      "\u590D\u523B\u8FD9\u4E2A\u52A8\u6548\uFF1A\u4E00\u672C\u624B\u7ED8\u52A8\u7269\u56FE\u9274\u7684\u5BF9\u9875\u2014\u2014\u7C73\u8272\u7EB8\u3001\u9752\u8272\u6807\u9898\u6761\u3001\u7B49\u5BBD\u5C0F\u6807\u7B7E\u914D\u886C\u7EBF\u6570\u503C\u3001\u865A\u7EBF\u5F15\u7EBF\u6307\u5411\u4E00\u53EA\u63D2\u753B\u732B\uFF0C\u53F3\u8FB9\u662F\u82AF\u7247\u7F16\u53F7\u4E0E\u4F4D\u7F6E\uFF0C\u4E00\u53F0\u9752\u8272\u626B\u63CF\u5668\u626B\u8FC7\u5E76\u8BFB\u51FA\u7F16\u53F7",
      "\u8981\u6C42\uFF1A\u624B\u7ED8\u611F\uFF08\u7C97\u7CD9\u8FB9\u3001\u7EB8\u7EB9\u3001\u8F7B\u5FAE\u9519\u4F4D\uFF09\u3001\u53EA\u6709\u9752\u7EFF\u548C\u84DD\u7070\u4E24\u79CD\u4E3B\u8272\u3001\u5F15\u7EBF\u548C\u6570\u5B57\u4F9D\u6B21\u51FA\u73B0\uFF1B\u4E0D\u8981\u6E10\u53D8\u5927\u8272\u5757\u3002"
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      for (let i = 0; i < 220; i++) {
        g.globalAlpha = 0.05 + noise(i) * 0.05;
        g.fillStyle = noise(i + 5) > 0.5 ? "#8d7f66" : "#fffdf5";
        g.fillRect(noise(i + 11) * w, noise(i + 23) * h, 1.1, 1.1);
      }
      g.globalAlpha = 1;
      const gut = g.createLinearGradient(w * 0.47, 0, w * 0.53, 0);
      gut.addColorStop(0, "rgba(120, 100, 70, 0)");
      gut.addColorStop(0.5, "rgba(120, 100, 70, 0.18)");
      gut.addColorStop(1, "rgba(120, 100, 70, 0)");
      g.fillStyle = gut;
      g.fillRect(w * 0.47, 0, w * 0.06, h);
      g.strokeStyle = "rgba(120, 100, 70, 0.28)";
      g.lineWidth = 1;
      g.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);
      const teal = look.accent;
      const head = (x, y, ww, text, p) => {
        g.save();
        g.globalAlpha = p;
        g.fillStyle = teal;
        g.beginPath();
        g.roundRect(x, y, ww, h * 0.075, h * 0.014);
        g.fill();
        g.fillStyle = "#fbf6e8";
        g.font = `600 ${Math.max(6, h * 0.03)}px ${SANS}`;
        g.letterSpacing = "0.1em";
        g.fillText(text, x + ww * 0.05, y + h * 0.052);
        g.letterSpacing = "0em";
        g.restore();
      };
      head(w * 0.08, h * 0.09, w * 0.36, "DESCRIPTION", span(t, 0.1, 0.55));
      head(w * 0.56, h * 0.09, w * 0.36, "MARKING", span(t, 0.2, 0.65));
      const fields = [
        ["NAME", "Earl Grey"],
        ["SPECIES", "Cat"],
        ["BREED", "Shorthair"],
        ["SEX", "Male"],
        ["COAT", "Silver tabby"],
        ["BORN", "4 May 2022"]
      ];
      const catX = w * 0.37;
      fields.forEach((f, i) => {
        const p = span(t, 0.45 + i * 0.09, 0.8 + i * 0.09);
        if (p <= 0) return;
        const y = h * (0.24 + i * 0.092);
        g.save();
        g.globalAlpha = p;
        g.fillStyle = "rgba(61,139,134,0.95)";
        g.font = `600 ${Math.max(4.5, h * 0.019)}px ${MONO}`;
        g.letterSpacing = "0.12em";
        g.fillText(f[0], w * 0.08, y);
        g.letterSpacing = "0em";
        g.fillStyle = "#26221b";
        g.font = `400 ${Math.max(6, h * 0.036)}px ${SERIF}`;
        g.fillText(f[1], w * 0.08, y + h * 0.036);
        const startX = w * 0.08 + Math.max(g.measureText(f[1]).width, w * 0.1) + w * 0.02;
        g.setLineDash([2, 3]);
        g.strokeStyle = "rgba(29,26,22,0.3)";
        g.beginPath();
        g.moveTo(startX, y + h * 0.02);
        g.lineTo(startX + (catX - w * 0.06 - startX) * p, y + h * 0.02);
        g.stroke();
        g.setLineDash([]);
        g.restore();
      });
      const catP = span(t, 0.35, 1.1);
      g.save();
      g.globalAlpha = catP;
      g.fillStyle = "#4c5878";
      g.strokeStyle = "#2f3850";
      g.lineWidth = Math.max(1, w * 35e-4);
      g.beginPath();
      g.roundRect(catX - w * 0.045, h * 0.47, w * 0.09, h * 0.2, w * 0.03);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(catX, h * 0.44, w * 0.042, 0, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(catX - w * 0.035, h * 0.42);
      g.lineTo(catX - w * 0.018, h * 0.375);
      g.lineTo(catX - w * 2e-3, h * 0.415);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(catX + w * 0.02, h * 0.412);
      g.lineTo(catX + w * 0.038, h * 0.375);
      g.lineTo(catX + w * 0.045, h * 0.425);
      g.closePath();
      g.fill();
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.roundRect(catX - w * 0.038 + i * w * 0.026, h * 0.64, w * 0.018, h * 0.05, w * 8e-3);
        g.fill();
      }
      g.beginPath();
      g.moveTo(catX + w * 0.045, h * 0.63);
      g.quadraticCurveTo(catX + w * 0.1, h * 0.6, catX + w * 0.095, h * 0.53);
      g.stroke();
      g.restore();
      const numP = span(t, 1.3, 1.7);
      const num = Math.round(941000024681357 * outCubic((t - 1.4) / 1.2));
      g.save();
      g.globalAlpha = numP;
      g.fillStyle = "#d9f2c8";
      g.strokeStyle = teal;
      g.lineWidth = Math.max(1, w * 35e-4);
      g.beginPath();
      g.roundRect(w * 0.56, h * 0.3, w * 0.36, h * 0.1, h * 0.02);
      g.fill();
      g.stroke();
      g.fillStyle = "#173b36";
      g.font = `600 ${Math.max(6, h * 0.038)}px ${MONO}`;
      const chipDigits = String(num).replace(/(\d{3})(?=\d)/g, "$1 ");
      const startAt = 1.15;
      let dx = w * 0.58;
      let caret = null;
      for (let i = 0; i < chipDigits.length; i++) {
        const ch = chipDigits[i];
        const advance = g.measureText(ch).width;
        const p = clamp01((t - startAt - i * 0.045) / 0.1);
        if (p > 0 && ch !== " ") {
          g.globalAlpha = p;
          g.fillStyle = "#26221b";
          g.fillText(ch, dx, h * 0.362);
          g.globalAlpha = 1;
        }
        if (p < 1 && !caret) caret = [dx, advance];
        dx += advance;
      }
      if (caret) {
        g.fillStyle = "rgba(61,139,134,0.6)";
        g.fillRect(caret[0], h * 0.336, Math.max(2, caret[1] * 0.8), h * 0.032);
      }
      g.restore();
      label(g, "MICROCHIP NUMBER", w * 0.56, h * 0.24, Math.max(4.5, h * 0.019), "rgba(61,139,134,0.95)", span(t, 1.1, 1.5), "0.12em");
      for (let i = 0; i < 5; i++) {
        g.save();
        g.globalAlpha = span(t, 1.1 + i * 0.04, 1.4 + i * 0.04) * 0.45;
        g.fillStyle = "rgba(29,26,22,0.3)";
        g.fillRect(w * (0.56 + i * 0.032), h * 0.253, w * 0.022, h * 0.014);
        g.restore();
      }
      label(g, "LOCATION", w * 0.56, h * 0.46, Math.max(4.5, h * 0.019), "rgba(61,139,134,0.95)", span(t, 1.4, 1.8), "0.12em");
      g.save();
      g.globalAlpha = span(t, 1.5, 1.9);
      g.fillStyle = "#26221b";
      g.font = `400 ${Math.max(6, h * 0.036)}px ${SERIF}`;
      const typed = "Left side of neck";
      const shown = typed.slice(0, Math.round(typed.length * clamp01((t - 1.4) / 1.1)));
      g.fillText(shown, w * 0.56, h * 0.505);
      if (shown.length < typed.length && t > 1.4) {
        g.fillStyle = "#b4502f";
        g.fillRect(w * 0.56 + g.measureText(shown).width + 1, h * 0.475, Math.max(1, w * 5e-3), h * 0.034);
      }
      g.restore();
      g.save();
      g.globalAlpha = span(t, 1.6, 2.1);
      g.translate(w * 0.79, h * 0.66);
      g.rotate(-0.3);
      g.fillStyle = "#f2ead6";
      g.strokeStyle = "#3d8b86";
      g.lineWidth = Math.max(1, w * 3e-3);
      g.beginPath();
      g.roundRect(-w * 0.07, -h * 0.025, w * 0.14, h * 0.05, h * 0.025);
      g.fill();
      g.stroke();
      g.strokeStyle = "#b4502f";
      g.lineWidth = Math.max(0.8, w * 2e-3);
      g.beginPath();
      for (let i = 0; i < 14; i++) {
        const x = -w * 0.05 + i * w * 6e-3;
        g.moveTo(x, -h * 0.014);
        g.lineTo(x + w * 2e-3, h * 0.014);
      }
      g.stroke();
      g.restore();
      label(g, "MICROCHIP", w * 0.72, h * 0.74, Math.max(4.5, h * 0.018), "rgba(29,26,22,0.6)", span(t, 1.8, 2.2), "0.1em");
      const sweep = outCubic((t - 0.9) / 0.8);
      g.save();
      g.globalAlpha = span(t, 0.85, 1.2);
      g.translate(catX + w * 0.05 + (1 - sweep) * w * 0.4, h * 0.5 + (1 - sweep) * h * 0.04);
      g.rotate(-0.3);
      g.fillStyle = teal;
      g.beginPath();
      g.roundRect(0, 0, w * 0.12, h * 0.1, w * 0.014);
      g.fill();
      g.fillStyle = "#bfe6df";
      g.beginPath();
      g.roundRect(w * 0.012, h * 0.012, w * 0.05, h * 0.035, w * 6e-3);
      g.fill();
      g.strokeStyle = "rgba(191,230,223,0.55)";
      g.lineWidth = Math.max(1, w * 2e-3);
      g.beginPath();
      g.moveTo(w * 0.06, h * 0.045);
      g.lineTo(w * 0.16, h * 0.05);
      g.stroke();
      g.save();
      g.globalAlpha = span(t, 0.95, 1.15) * (1 - span(t, 2.2, 2.5));
      g.strokeStyle = "rgba(61,139,134,0.28)";
      g.lineWidth = Math.max(1.2, w * 3e-3);
      g.beginPath();
      g.moveTo(w * 0.1, h * 0.05);
      g.lineTo(w * 0.58, -h * 0.14);
      g.stroke();
      g.restore();
      g.restore();
      label(g, "2", w * 0.07, h * 0.94, Math.max(4.5, h * 0.018), "rgba(29,26,22,0.4)", 1, "0.1em");
      label(g, "3", w * 0.93, h * 0.94, Math.max(4.5, h * 0.018), "rgba(29,26,22,0.4)", 1, "0.1em");
    }
  },
  {
    id: "tree",
    title: "\u6811",
    tag: "\u573A\u666F\u53D9\u4E8B",
    ratio: 3 / 4,
    template: "tree",
    look: { bg: "#efe7d4", ink: "#2b2620", dim: "rgba(43,38,32,0.55)", medium: "paper", finish: false },
    prompt: brief(
      "\u590D\u523B\u8FD9\u4E2A\u52A8\u6548\uFF1A\u7EE2\u672C\u6C34\u58A8\uFF0C\u4E00\u68F5\u6811\u7ACB\u5728\u7EB8\u4E0A\uFF0C\u679D\u5E72\u7528\u6E7F\u7B14\u4ECE\u4E0B\u5F80\u4E0A\u957F\u51FA\u6765\uFF0C\u672B\u68A2\u7684\u58A8\u70B9\u968F\u540E\u4E00\u4E2A\u4E2A\u843D\u4E0A\u53BB\uFF0C\u53F3\u4E0A\u89D2\u4E00\u8F6E\u6DE1\u58A8\u6708\uFF0C\u5DE6\u4E0B\u89D2\u4E00\u679A\u6731\u6587\u5C0F\u5370",
      "\u8981\u6C42\uFF1A\u58A8\u8272\u8981\u6709\u6D53\u6DE1\u548C\u98DE\u767D\uFF0C\u7EB8\u8981\u6709\u7EA4\u7EF4\uFF1B\u6574\u5E45\u53EA\u7528\u58A8\u3001\u7EB8\u548C\u4E00\u70B9\u6731\u7EA2\uFF1B\u751F\u957F\u8981\u6709\u5148\u540E\uFF0C\u4E0D\u8981\u4E00\u5E27\u5168\u5E72\u3002"
    ),
    draw(g, w, h, t) {
      paper(g, w, h, { base: [239, 231, 212], seed: 17, mottle: 14, grain: 8 });
      const mx = w * 0.76;
      const my = h * 0.14;
      const mr = Math.min(w, h) * 0.062;
      const moon = g.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, mr * 0.1, mx, my, mr * 1.12);
      moon.addColorStop(0, "rgba(94, 84, 68, 0.20)");
      moon.addColorStop(0.75, "rgba(94, 84, 68, 0.10)");
      moon.addColorStop(1, "rgba(94, 84, 68, 0)");
      g.fillStyle = moon;
      g.beginPath();
      g.arc(mx, my, mr * 1.12, 0, TAU);
      g.fill();
      const wash = g.createRadialGradient(w * 0.5, h * 0.9, 0, w * 0.5, h * 0.9, w * 0.09);
      wash.addColorStop(0, "rgba(43,38,32,0.20)");
      wash.addColorStop(1, "rgba(43,38,32,0)");
      g.fillStyle = wash;
      g.fillRect(0, 0, w, h);
      const grow = span(t, 0.25, 2.5);
      const root = { x: w * 0.5, y: h * 0.92 };
      const tips = [];
      const STEP = 0.15;
      const branch = (x, y, angle, len, depth, at) => {
        if (depth <= 0 || len < 1) return;
        const p = clamp01((grow - at) / STEP);
        if (p <= 0) return;
        const ex = x + Math.cos(angle) * len * p;
        const ey = y + Math.sin(angle) * len * p;
        const bend = (noise(depth + x * 0.01) - 0.5) * 0.18;
        const mx2 = (x + ex) / 2 - (ey - y) * bend;
        const my2 = (y + ey) / 2 + (ex - x) * bend;
        const w0 = Math.max(0.9, depth * 0.72);
        const w1 = Math.max(0.5, depth * 0.5);
        const N = 7;
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const q = i / N;
          const px = (1 - q) * (1 - q) * x + 2 * (1 - q) * q * mx2 + q * q * ex;
          const py = (1 - q) * (1 - q) * y + 2 * (1 - q) * q * my2 + q * q * ey;
          pts.push([px, py, w0 + (w1 - w0) * q]);
        }
        g.fillStyle = "#2b2620";
        g.globalAlpha = depth > 3 ? 0.85 : 0.62;
        g.beginPath();
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)];
          const b = pts[Math.min(pts.length - 1, i + 1)];
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const d = Math.hypot(dx, dy) || 1;
          g.lineTo(pts[i][0] - dy / d * pts[i][2] * 0.5, pts[i][1] + dx / d * pts[i][2] * 0.5);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
          const a = pts[Math.max(0, i - 1)];
          const b = pts[Math.min(pts.length - 1, i + 1)];
          const dx = b[0] - a[0];
          const dy = b[1] - a[1];
          const d = Math.hypot(dx, dy) || 1;
          g.lineTo(pts[i][0] + dy / d * pts[i][2] * 0.5, pts[i][1] - dx / d * pts[i][2] * 0.5);
        }
        g.closePath();
        g.fill();
        if (p < 0.99) return;
        if (depth === 1) {
          tips.push([ex, ey]);
          return;
        }
        branch(ex, ey, angle - 0.36 - noise(depth + x) * 0.16, len * 0.74, depth - 1, at + STEP);
        branch(ex, ey, angle + 0.34 + noise(depth + y) * 0.16, len * 0.72, depth - 1, at + STEP);
        if (depth >= 4) branch(ex, ey, angle + noise(depth * 3 + x) * 0.7 - 0.35, len * 0.56, depth - 1, at + STEP);
      };
      branch(root.x, root.y, -Math.PI / 2, h * 0.24, 6, 0);
      const leaf = span(t, 1.9, 3.4);
      for (let i = 0; i < tips.length; i++) {
        const p = clamp01((leaf - i * 6e-3) * 2.6);
        if (p <= 0) continue;
        const [tx, ty] = tips[i];
        const r = Math.max(1, w * 7e-3 * (0.6 + 0.4 * p));
        g.fillStyle = noise(i + 41) > 0.88 ? "#a8442a" : "#2b2620";
        g.globalAlpha = 0.4 + 0.5 * p;
        g.beginPath();
        g.arc(tx, ty, r, 0, TAU);
        g.fill();
        g.globalAlpha *= 0.6;
        g.beginPath();
        g.arc(tx + r * 1.6, ty - r * 0.9, r * 0.7, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      veil(g, w, h, t, this.look);
    }
  },
  {
    id: "board",
    title: "\u699C\u5C4F",
    tag: "\u754C\u9762\u6F14\u793A",
    ratio: 16 / 9,
    template: "board",
    look: { ...LOOKS.night, medium: "screen" },
    prompt: brief(
      "\u590D\u523B\u8FD9\u4E2A\u52A8\u6548\uFF1A\u6DF1\u8272\u7A7A\u95F4\u91CC\u4E00\u5757\u6392\u884C\u699C\u5C4F\u5E55\uFF0C\u6574\u4F53\u8F7B\u5FAE\u900F\u89C6\u503E\u659C\uFF0C\u56DB\u884C\u300C\u540D\u6B21 / \u540D\u5B57 / \u5206\u6570\u300D\uFF0C\u699C\u9996\u4E00\u884C\u7EFF\u8272\u9AD8\u4EAE\uFF0C\u7B2C\u4E8C\u540D\u5728\u7B2C\u4E09\u79D2\u53CD\u8D85\uFF0C\u955C\u5934\u7F13\u6162\u63A8\u8FD1",
      "\u8981\u6C42\uFF1A\u56DB\u5468\u6709\u660E\u663E\u6697\u89D2\u548C\u67D4\u5149\u3001\u5C4F\u5E55\u6709\u8FB9\u6846\u548C\u8868\u5934\u3001\u6587\u5B57\u5728\u5C0F\u5C3A\u5BF8\u4E0B\u4E5F\u80FD\u8BFB\u6E05\uFF08\u5B81\u5C11\u52FF\u5C0F\uFF09\uFF1B\u8282\u594F\u662F\u7F13\u6162\u63A8\u8FD1\uFF0C\u4E0D\u662F\u5FEB\u901F\u5207\u6362\u3002"
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const glow = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.72);
      glow.addColorStop(0, "rgba(86, 122, 255, 0.12)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      const push = 0.94 + 0.06 * outCubic(t / 2.4);
      const climb = 1 - outCubic(t / LOOP_SECONDS);
      g.save();
      g.translate(w * 0.5, h * 0.5 + climb * h * 0.05);
      g.transform(1, 0, -0.1, 0.97, 0, 0);
      g.scale(push, push);
      g.translate(-w * 0.5, -h * 0.5);
      g.fillStyle = "rgba(8, 10, 14, 0.72)";
      g.strokeStyle = "rgba(255, 255, 255, 0.12)";
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84, Math.max(4, w * 0.012));
      g.fill();
      g.stroke();
      label(g, "MODEL SCORE", w * 0.12, h * 0.17, Math.max(5, h * 0.028), "rgba(236,236,234,0.4)", span(t, 0.1, 0.6), "0.26em");
      g.save();
      g.globalAlpha = span(t, 0.3, 0.9);
      g.fillStyle = "#7ee787";
      g.beginPath();
      g.arc(w * 0.84, h * 0.16, Math.max(1.4, h * 6e-3), 0, TAU);
      g.fill();
      g.restore();
      label(g, "LIVE", w * 0.86, h * 0.17, Math.max(4.5, h * 0.024), "rgba(126,231,135,0.75)", span(t, 0.3, 0.9), "0.2em");
      const rows = [
        { rank: "01", name: "Anthropic", score: "1496" },
        { rank: "02", name: "Alibaba", score: "1486" },
        { rank: "03", name: "Google", score: "1485" },
        { rank: "04", name: "Moonshot", score: "1483" }
      ];
      const x = w * 0.13;
      const rw = w * 0.74;
      const rh = h * 0.165;
      const swap = span(t, 2.1, 3);
      rows.forEach((row, i) => {
        const p = outCubic((t - 0.15 - i * 0.09) / 0.5);
        const base = h * 0.24 + i * rh;
        let y = base;
        if (i === 0) y = base + swap * rh;
        if (i === 1) y = base - swap * rh;
        const lead = i === 0 && swap < 0.5 || i === 1 && swap >= 0.5;
        const rank = i === 0 ? swap >= 0.5 ? "02" : "01" : i === 1 ? swap >= 0.5 ? "01" : "02" : row.rank;
        const nudge = i < 2 ? (1 - Math.abs(swap - 0.5) * 2) * w * 0.04 * (i === 0 ? 1 : -1) : 0;
        boardRow(g, x + nudge, y, rw, rh, { ...row, rank }, p, lead);
      });
      const scan = t * 0.22 % 1 * 0.84 + 0.08;
      const grad = g.createLinearGradient(0, h * scan - h * 0.06, 0, h * scan + h * 0.02);
      grad.addColorStop(0, "rgba(126, 231, 135, 0)");
      grad.addColorStop(1, "rgba(126, 231, 135, 0.05)");
      g.fillStyle = grad;
      g.fillRect(w * 0.08, h * scan - h * 0.06, w * 0.84, h * 0.08);
      g.restore();
      const vig = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.34, w * 0.5, h * 0.5, w * 0.78);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.66)");
      g.fillStyle = vig;
      g.fillRect(0, 0, w, h);
      veil(g, w, h, t, look);
    }
  },
  {
    id: "cards3d",
    title: "\u7ACB\u4F53\u5361\u7247",
    tag: "\u754C\u9762\u6F14\u793A",
    template: "cards3d",
    ratio: 16 / 9,
    engine: "webgl",
    backdrop: "radial-gradient(circle at 50% 40%, #1a1a1d 0%, #0a0a0b 70%)",
    look: { bg: "#0a0a0b", ink: "#f2f2f2", dim: "rgba(242,242,242,0.5)" },
    prompt: brief(
      "\u590D\u523B\u8FD9\u4E2A\u52A8\u6548\uFF1A\u6DF1\u8272\u821E\u53F0\u4E0A\u4E09\u5F20\u6709\u539A\u5EA6\u3001\u5E26\u5012\u89D2\u7684\u5361\u7247\u5FAE\u5FAE\u8F6C\u52A8\uFF0C\u91D1\u5C5E\u8FB9\u7F18\u5403\u5149\uFF0C\u811A\u4E0B\u6709\u6295\u5F71",
      "\u8981\u6C42\uFF1A\u771F 3D\uFF08WebGL\uFF09\u3001PBR \u6750\u8D28\u3001\u771F\u5B9E\u9634\u5F71\u4E0E\u53CD\u5C04\uFF1B\u4E0D\u8981\u5E73\u9762\u77E9\u5F62\u548C\u8D34\u56FE\u5192\u5145\u3002"
    ),
    build({ THREE, renderer, width, height }) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#0a0a0b");
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
      camera.position.set(0, 0.5, 7);
      camera.lookAt(0, 0, 0);
      scene.add(new THREE.HemisphereLight(16777215, 526346, 0.4));
      const key = new THREE.DirectionalLight(16777215, 2.6);
      key.position.set(3, 6, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);
      const rim = new THREE.PointLight(16777215, 24, 18);
      rim.position.set(-3, 1.5, -2);
      scene.add(rim);
      const room = new THREE.Scene();
      room.background = new THREE.Color("#050506");
      const strip = (x, y, z, sw, sh, rot, rgb2, scale) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(sw, sh),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(rgb2[0], rgb2[1], rgb2[2]).multiplyScalar(scale),
            side: THREE.DoubleSide
          })
        );
        m.position.set(x, y, z);
        m.rotation.set(rot[0], rot[1], rot[2]);
        room.add(m);
      };
      strip(0, 4, -3, 9, 3, [0, 0, 0], [1, 1, 1], 1);
      strip(-4, 0.5, 0, 6, 8, [0, Math.PI / 2, 0], [1, 0.24, 0.5], 2.6);
      strip(4, -0.5, 1, 4, 6, [0, -Math.PI / 2, 0], [0.2, 0.62, 1], 2);
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(room, 0.06).texture;
      const wash = document.createElement("canvas");
      wash.width = 256;
      wash.height = 256;
      const wg = wash.getContext("2d");
      const wgrad = wg.createRadialGradient(128, 128, 0, 128, 128, 128);
      wgrad.addColorStop(0, "rgba(120, 170, 255, 0.55)");
      wgrad.addColorStop(0.45, "rgba(90, 120, 220, 0.16)");
      wgrad.addColorStop(1, "rgba(90, 120, 220, 0)");
      wg.fillStyle = wgrad;
      wg.fillRect(0, 0, 256, 256);
      const washMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 9),
        new THREE.MeshBasicMaterial({
          map: new THREE.CanvasTexture(wash),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      );
      washMesh.position.set(0, 0.9, -2.6);
      scene.add(washMesh);
      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.012, 12, 160),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.72, 0.85, 1).multiplyScalar(0.9),
          toneMapped: false
        })
      );
      halo.position.set(0, 0.55, -2.2);
      scene.add(halo);
      const haloWide = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.055, 12, 160),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.55, 0.72, 1).multiplyScalar(0.5),
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      );
      haloWide.position.copy(halo.position);
      scene.add(haloWide);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 526346, roughness: 0.22, metalness: 0.65, envMapIntensity: 1.4 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.5;
      floor.receiveShadow = true;
      scene.add(floor);
      const shape = new THREE.Shape();
      const w = 1.02;
      const h = 1.56;
      const r = 0.16;
      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const geom = new THREE.ExtrudeGeometry(shape, {
        depth: 0.07,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.025,
        bevelSegments: 4,
        curveSegments: 24
      });
      geom.center();
      const material = new THREE.MeshPhysicalMaterial({
        color: 1513243,
        metalness: 0.42,
        roughness: 0.15,
        envMapIntensity: 2.4,
        clearcoat: 1,
        clearcoatRoughness: 0.06
      });
      const faceTexture = (count) => {
        const cv = document.createElement("canvas");
        cv.width = 256;
        cv.height = 392;
        const g = cv.getContext("2d");
        g.fillStyle = "#0c0c0d";
        g.fillRect(0, 0, 256, 392);
        const screen = g.createLinearGradient(0, 40, 0, 190);
        screen.addColorStop(0, "#6f6f6f");
        screen.addColorStop(1, "#1d1d1d");
        g.fillStyle = screen;
        g.beginPath();
        g.roundRect(22, 40, 212, 150, 16);
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.95)";
        g.font = "500 44px -apple-system, system-ui, sans-serif";
        g.fillText(String(count), 22, 296);
        g.fillStyle = "rgba(255,255,255,0.42)";
        g.font = "400 22px -apple-system, system-ui, sans-serif";
        g.fillText("Views", 22, 330);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };
      const cards = [];
      [-1.15, 0, 1.15].forEach((x, i) => {
        const holder = new THREE.Group();
        holder.position.set(x, i % 2 ? -0.12 : 0.12, i % 2 ? 0.1 : -0.1);
        holder.rotation.y = -x * 0.16;
        const body = new THREE.Mesh(geom, material);
        body.castShadow = true;
        body.receiveShadow = true;
        holder.add(body);
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(0.94, 1.44),
          new THREE.MeshBasicMaterial({ map: faceTexture([15038, 518797, 9864421][i]), toneMapped: false })
        );
        face.position.z = 0.09;
        holder.add(face);
        scene.add(holder);
        cards.push({ holder, base: holder.rotation.y, phase: i * 0.8 });
      });
      return {
        resize(w2, h2) {
          renderer.setSize(w2, h2, false);
          camera.aspect = w2 / h2;
          camera.updateProjectionMatrix();
        },
        render(t) {
          const env = Math.min(1, t / 0.5) * Math.min(1, (LOOP_SECONDS - t) / 0.55);
          for (const card of cards) {
            card.holder.rotation.y = card.base + Math.sin(t * 0.7 + card.phase) * 0.28;
            card.holder.scale.setScalar(0.55 + env * 0.45);
          }
          camera.position.x = Math.sin(t * 0.25) * 0.4;
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
        }
      };
    }
  },
  {
    id: "type",
    title: "\u52A8\u8D77\u6765",
    tag: "\u6587\u5B57\u6392\u7248",
    template: "kinetic",
    ratio: 16 / 9,
    look: { ...LOOKS.lime, medium: "print" },
    prompt: brief(
      "\u590D\u523B\u8FD9\u4E2A\u52A8\u6548\uFF1A\u4EAE\u9EC4\u7EFF\u5E95\u4E0A\u4E09\u884C\u8D85\u5927\u9ED1\u8272\u65E0\u886C\u7EBF\u5B57\u300CMAKE / IT / MOVE\u300D\uFF0C\u6BCF\u884C\u4ECE\u906E\u7F69\u91CC\u5411\u4E0A\u63A8\u51FA\u3001\u9010\u884C\u9519\u5F00\uFF0C\u6700\u540E\u4E00\u6761\u7EC6\u7EBF\u5212\u8FC7",
      "\u8981\u6C42\uFF1A\u5B57\u8DDD\u6536\u7D27\u3001\u5B57\u91CD 700\u3001\u7559\u767D\u6781\u5927\uFF1B\u53EA\u7528\u9ED1\u8272\uFF0C\u4E0D\u8981\u9634\u5F71\u548C\u6E10\u53D8\u3002"
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const pad = w * 0.08;
      label(g, "01 \u2014 KINETIC TYPE", pad, h * 0.16, h * 0.032, look.dim, span(t, 0.15, 0.7), "0.28em");
      const words = ["MAKE", "IT", "MOVE"];
      const size = h * 0.235;
      words.forEach((word, i) => {
        const p = outCubic((t - 0.25 - i * 0.22) / 0.7);
        if (p <= 0) return;
        const y = h * (0.42 + i * 0.24);
        g.save();
        g.beginPath();
        g.rect(0, y - size * 1.02, w, size * 1.22);
        g.clip();
        g.fillStyle = look.ink;
        g.font = `700 ${size}px ${SANS}`;
        g.letterSpacing = "-0.035em";
        g.fillText(word, pad, y + (1 - p) * size * 0.95);
        g.letterSpacing = "0em";
        g.restore();
      });
      line(g, pad, h * 0.92, (w - pad * 2) * 0.34, look.ink, (t - 1.4) / 0.9);
      veil(g, w, h, t, look);
    }
  },
  {
    id: "orbit",
    title: "\u884C\u661F",
    tag: "\u573A\u666F\u53D9\u4E8B",
    ratio: 16 / 9,
    template: "orbit",
    look: { ...LOOKS.navy, medium: "film" },
    prompt: brief(
      "\u590D\u523B\u8FD9\u4E2A\u52A8\u6548\uFF1A\u6DF1\u8272\u661F\u573A\u91CC\u4E00\u9897\u6C14\u6001\u884C\u661F\uFF0C\u4E00\u9897\u5C0F\u536B\u661F\u4ECE\u5DE6\u5230\u53F3\u7A7F\u8FC7\u5B83\u7684disk\u3001\u5728\u4E91\u5C42\u4E0A\u6295\u4E0B\u4E00\u4E2A\u6A21\u7CCA\u7684\u5F71\u5B50\uFF0C\u73AF\u5E26\u88AB\u7403\u4F53\u906E\u4F4F\u4E00\u534A\uFF0C\u80CC\u5149\u4FA7\u6709\u7EC6\u4EAE\u7684\u8FB9\u754C\u5149",
      "\u8981\u6C42\uFF1A\u661F\u7403\u8981\u771F\u7684\u88AB\u5149\u7167\u7740\uFF08\u660E\u6697\u4EA4\u754C\u3001\u8FB9\u7F18\u5149\u3001\u5927\u6C14\u8F89\u5149\uFF09\uFF0C\u73AF\u5E26\u8981\u6709\u539A\u5EA6\u548C\u524D\u540E\u906E\u6321\uFF0C\u5F71\u5B50\u8981\u8DDF\u7740\u536B\u661F\u8D70\uFF1B\u661F\u70B9\u7EC6\u3001\u4E0D\u8981\u4E94\u89D2\u661F\u3002"
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const drift = Math.sin(t * 0.18) * w * 6e-3;
      const cx = w * 0.63 + drift;
      const cy = h * 0.53;
      const r = Math.min(h * 0.3, w * 0.19);
      const moonT = clamp01(t / LOOP_SECONDS);
      const mx = cx + r * (1.9 - moonT * 3.5);
      const my = cy - r * 0.34 - Math.sin(moonT * Math.PI) * r * 0.1;
      const mr = r * 0.1;
      g.save();
      g.globalCompositeOperation = "lighter";
      const neb = [
        { x: cx - r * 1.6, y: cy - r * 0.9, rad: r * 3.4, c: "64, 82, 180", a: 0.3 },
        { x: cx + r * 1.9, y: cy + r * 1.1, rad: r * 3, c: "44, 96, 140", a: 0.22 },
        { x: cx + r * 0.2, y: cy - r * 2, rad: r * 2.4, c: "108, 70, 150", a: 0.18 }
      ];
      for (const n of neb) {
        const grd = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.rad);
        grd.addColorStop(0, `rgba(${n.c}, ${n.a})`);
        grd.addColorStop(0.55, `rgba(${n.c}, ${n.a * 0.28})`);
        grd.addColorStop(1, `rgba(${n.c}, 0)`);
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      }
      g.restore();
      for (let i = 0; i < 260; i++) {
        const depth = 0.3 + noise(i + 5) * 0.7;
        const sx = ((noise(i) * w + w - drift * depth * 2.2) % w + w) % w;
        const sy = noise(i + 90) * h;
        const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + depth) + i);
        g.globalAlpha = (0.12 + noise(i + 31) * 0.55) * tw * depth;
        g.fillStyle = noise(i + 7) > 0.82 ? "#cfe0ff" : "#e8eefc";
        g.beginPath();
        g.arc(sx, sy, 0.35 + depth * 0.85, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      const ringRot = -0.2;
      const rx = r * 1.92;
      const ry = r * 0.43;
      const drawRings = (front) => {
        g.save();
        g.translate(cx, cy);
        g.rotate(ringRot);
        for (let i = 0; i < 46; i++) {
          const k = i / 45;
          const s = 0.58 + k * 0.56;
          const grain2 = noise(i + 13);
          if (Math.abs(k - 0.47) < 0.035 || Math.abs(k - 0.74) < 0.022) continue;
          const edge = Math.pow(1 - Math.abs(k - 0.52) * 1.7, 0.9);
          const a = (front ? 0.22 : 0.42) * (0.3 + grain2 * 0.7) * edge;
          g.strokeStyle = `rgba(${214 + grain2 * 34}, ${218 + grain2 * 22}, 238, ${a.toFixed(3)})`;
          g.lineWidth = ry * 0.085;
          g.beginPath();
          g.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU);
          g.stroke();
        }
        g.restore();
      };
      const clipHalf = (sign) => {
        g.save();
        g.beginPath();
        g.translate(cx, cy);
        g.rotate(ringRot);
        g.rect(-w * 3, sign > 0 ? 0 : -h * 3, w * 6, h * 3);
        g.restore();
        g.clip();
      };
      g.save();
      clipHalf(-1);
      drawRings(false);
      g.restore();
      const lx = cx - r * 0.45;
      const ly = cy - r * 0.52;
      const sphere = g.createRadialGradient(lx, ly, r * 0.05, cx, cy, r * 1.06);
      sphere.addColorStop(0, "#8a9dc4");
      sphere.addColorStop(0.32, "#54648c");
      sphere.addColorStop(0.62, "#26304d");
      sphere.addColorStop(0.86, "#0d1224");
      sphere.addColorStop(1, "#05080f");
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.clip();
      g.fillStyle = sphere;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      for (let i = 0; i < 7; i++) {
        const by = cy + (noise(i + 40) - 0.5) * r * 1.7;
        const bh = r * (0.06 + noise(i + 60) * 0.12);
        g.globalAlpha = 0.05 + noise(i + 70) * 0.07;
        g.fillStyle = i % 2 ? "#cfd9f2" : "#0a1020";
        g.beginPath();
        g.ellipse(cx + Math.sin(i) * r * 0.1, by, r * 1.1, bh, Math.sin(i * 2.1) * 0.12, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      if (mx > cx - r && mx < cx + r) {
        const sd = g.createRadialGradient(mx + r * 0.2, my + r * 0.26, 0, mx + r * 0.2, my + r * 0.26, mr * 1.5);
        sd.addColorStop(0, "rgba(4, 6, 12, 0.55)");
        sd.addColorStop(1, "rgba(4, 6, 12, 0)");
        g.fillStyle = sd;
        g.beginPath();
        g.ellipse(mx + r * 0.2, my + r * 0.26, mr * 1.5, mr * 1.5, 0, 0, TAU);
        g.fill();
      }
      for (const [dy, a, ry2] of [
        [-r * 0.02, 0.1, r * 0.22],
        [r * 0.02, 0.08, r * 0.19]
      ]) {
        g.globalAlpha = a;
        g.fillStyle = "#04060c";
        g.beginPath();
        g.ellipse(cx, cy + dy, r * 1.15, ry2, ringRot, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      g.restore();
      g.save();
      g.globalCompositeOperation = "lighter";
      const rim = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      rim.addColorStop(0, "rgba(196, 220, 255, 0.85)");
      rim.addColorStop(0.45, "rgba(150, 180, 240, 0.30)");
      rim.addColorStop(0.72, "rgba(90, 120, 200, 0.0)");
      rim.addColorStop(1, "rgba(60, 90, 170, 0.45)");
      g.strokeStyle = rim;
      g.lineWidth = Math.max(1, r * 0.022);
      g.beginPath();
      g.arc(cx, cy, r * 0.995, 0, TAU);
      g.stroke();
      const atmo = g.createRadialGradient(cx, cy, r * 0.99, cx, cy, r * 1.24);
      atmo.addColorStop(0, "rgba(126, 170, 255, 0.34)");
      atmo.addColorStop(0.45, "rgba(90, 130, 220, 0.12)");
      atmo.addColorStop(1, "rgba(90, 130, 220, 0)");
      g.fillStyle = atmo;
      g.beginPath();
      g.arc(cx, cy, r * 1.24, 0, TAU);
      g.arc(cx, cy, r * 0.99, 0, TAU, true);
      g.fill("evenodd");
      g.restore();
      g.save();
      clipHalf(1);
      drawRings(true);
      g.restore();
      const moon = g.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr);
      moon.addColorStop(0, "#dbe4f6");
      moon.addColorStop(0.7, "#5b6684");
      moon.addColorStop(1, "#0a0f1c");
      g.fillStyle = moon;
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.fill();
      g.strokeStyle = "rgba(200, 220, 255, 0.35)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.stroke();
      veil(g, w, h, t, look);
    }
  },
  {
    id: "prism",
    title: "\u68F1\u955C",
    tag: "\u80CC\u666F\u7279\u6548",
    ratio: 1,
    template: "prism",
    look: LOOKS.plate,
    prompt: brief(
      "\u590D\u523B\u8FD9\u4E2A\u52A8\u6548\uFF1A\u7C73\u8272\u7EB8\u4E0A\u7684\u4E00\u5E45\u5370\u5237\u56FE\u89E3\uFF0C\u4E00\u675F\u5149\u4ECE\u5DE6\u4E0A\u5C04\u5165\u73BB\u7483\u4E09\u68F1\u955C\uFF0C\u51FA\u5C04\u9762\u6563\u6210\u516D\u6761\u5370\u5237\u8272\u5E26\uFF0C\u7EB8\u9762\u6709\u7EA4\u7EF4\u548C\u7F51\u70B9\uFF0C\u56DB\u5468\u662F\u4E00\u5708\u58A8\u7EBF\u6846",
      "\u8981\u6C42\uFF1A\u6574\u5F20\u56FE\u662F\u300C\u5370\u5728\u7EB8\u4E0A\u300D\u7684\uFF08\u7EB8\u7EA4\u7EF4\u3001\u7F51\u70B9\u3001\u8F7B\u5FAE\u5957\u5370\u4E0D\u51C6\uFF09\uFF0C\u5149\u7684\u90E8\u5206\u6BD4\u7EB8\u66F4\u4EAE\uFF1B\u4E0D\u8981\u53D1\u5149\u6E10\u53D8\u3001\u4E0D\u8981\u7D2B\u5E95\u3001\u4E0D\u8981\u77E2\u91CF\u63CF\u8FB9\u611F\u3002"
    ),
    draw(g, w, h, t) {
      const look = this.look;
      const ink = [42, 33, 24];
      paper(g, w, h, { base: [238, 227, 203], seed: 11, mottle: 18, grain: 10 });
      const cx = w * 0.6 + Math.sin(t * 0.22) * w * 5e-3;
      const cy = h * 0.44;
      const R = Math.min(w * 0.19, h * 0.19);
      const rot = 0.15 + Math.sin(t * 0.45) * 0.075;
      const ca = Math.cos(rot);
      const sa = Math.sin(rot);
      const P = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
      const apex = P(0, -R);
      const left = P(-0.866 * R, 0.5 * R);
      const right = P(0.866 * R, 0.5 * R);
      const inFace = [(apex[0] + left[0]) / 2, (apex[1] + left[1]) / 2];
      const outFace = [(apex[0] + right[0]) / 2, (apex[1] + right[1]) / 2];
      const beamFrom = [-w * 0.08, cy - R * 1.55];
      const softBand = (a, b, halfA, halfB, color, peak, steps = 20) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        g.lineCap = "butt";
        for (let i = 0; i < steps; i++) {
          const s = (i + 0.5) / steps;
          const u = (s - 0.5) * 2;
          const prof = Math.exp(-u * u * 1.7);
          g.strokeStyle = `rgba(${color}, ${(peak * prof).toFixed(3)})`;
          g.lineWidth = (halfA + halfB) / steps * 2.2;
          g.beginPath();
          g.moveTo(a[0] + nx * u * halfA, a[1] + ny * u * halfA);
          g.lineTo(b[0] + nx * u * halfB, b[1] + ny * u * halfB);
          g.stroke();
        }
      };
      g.save();
      g.globalCompositeOperation = "lighter";
      softBand(beamFrom, inFace, R * 0.62, R * 0.2, "255, 246, 214", 0.1, 12);
      softBand(beamFrom, inFace, R * 0.22, R * 0.06, "255, 250, 232", 0.26);
      g.restore();
      const SPECTRUM = ["228, 74, 74", "236, 138, 54", "240, 200, 66", "104, 176, 112", "74, 140, 208", "146, 106, 194"];
      g.save();
      for (let i = 0; i < SPECTRUM.length; i++) {
        const k = (i + 0.5) / SPECTRUM.length;
        const wob = Math.sin(t * 0.5 + i * 1.3) * R * 0.012;
        const ey = outFace[1] + R * (0.05 + k * 2.15) + wob;
        const ex = w * 0.9;
        const near = R * 0.03;
        const far = R * (0.1 + k * 0.11);
        const grad = g.createLinearGradient(outFace[0], outFace[1], ex, ey);
        grad.addColorStop(0, `rgba(${SPECTRUM[i]}, 0.9)`);
        grad.addColorStop(0.5, `rgba(${SPECTRUM[i]}, 0.6)`);
        grad.addColorStop(1, `rgba(${SPECTRUM[i]}, 0)`);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(outFace[0], outFace[1] - near);
        g.lineTo(ex, ey - far);
        g.lineTo(ex, ey + far);
        g.lineTo(outFace[0], outFace[1] + near);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.save();
      g.globalAlpha = 0.22;
      g.translate(w * 25e-4, h * 2e-3);
      for (let i = 0; i < 3; i++) {
        const k = (i + 0.5) / 3;
        const ey = outFace[1] + R * (0.05 + k * 2.15);
        g.fillStyle = `rgba(${SPECTRUM[i * 2]}, 0.7)`;
        g.beginPath();
        g.moveTo(outFace[0], outFace[1] - R * 0.03);
        g.lineTo(w * 0.9, ey - R * 0.14);
        g.lineTo(w * 0.9, ey + R * 0.14);
        g.lineTo(outFace[0], outFace[1] + R * 0.03);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.save();
      g.beginPath();
      g.moveTo(apex[0], apex[1]);
      g.lineTo(left[0], left[1]);
      g.lineTo(right[0], right[1]);
      g.closePath();
      g.fillStyle = "rgba(252, 248, 236, 0.55)";
      g.fill();
      g.save();
      g.clip();
      const shade = g.createLinearGradient(cx, apex[1], cx, right[1]);
      shade.addColorStop(0, "rgba(255,255,255,0.5)");
      shade.addColorStop(1, "rgba(150, 132, 104, 0.18)");
      g.fillStyle = shade;
      g.fillRect(left[0] - R, apex[1], R * 3, R * 2.4);
      g.strokeStyle = "rgba(255, 246, 214, 0.85)";
      g.lineWidth = R * 0.05;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(inFace[0], inFace[1]);
      g.lineTo(outFace[0], outFace[1]);
      g.stroke();
      g.restore();
      g.restore();
      inkStroke(g, [apex, left, right, apex], { width: Math.max(1.6, R * 0.045), color: ink, dry: 0.5, seed: 4 });
      for (let i = 0; i < 40; i++) {
        const x = noise(i + 3) * w;
        const y = noise(i + 7) * h;
        g.globalAlpha = 0.1 + noise(i + 11) * 0.16;
        g.fillStyle = `rgba(${ink.join(",")}, 0.6)`;
        g.beginPath();
        g.arc(x, y, 0.6 + noise(i + 13) * 0.8, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      halftone(g, w, h, { cell: Math.max(3, w * 5e-3), alpha: 0.05 });
      g.strokeStyle = "rgba(42, 33, 24, 0.55)";
      g.lineWidth = 1;
      g.strokeRect(w * 0.055, h * 0.05, w * 0.89, h * 0.9);
      label(g, "PLATE III \u2014 DISPERSION", w * 0.085, h * 0.935, h * 0.022, "rgba(42,33,24,0.62)", span(t, 0.3, 1), "0.22em");
      bleed(g, w, h, { color: ink, amount: 0.1 });
      veil(g, w, h, t, look);
    }
  }
];

// src/look.mjs
var cache2 = /* @__PURE__ */ new Map();
function scratch(key, w, h) {
  let c = cache2.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    cache2.set(key, c);
  }
  return c;
}
function luma(hex) {
  if (typeof hex !== "string") return 0;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = (n >> 16 & 255) / 255;
  const g = (n >> 8 & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
var GRAIN = 96;
var grainTiles = null;
function grain() {
  if (grainTiles) return grainTiles;
  grainTiles = [];
  for (let phase = 0; phase < 3; phase++) {
    const c = document.createElement("canvas");
    c.width = GRAIN;
    c.height = GRAIN;
    const g = c.getContext("2d");
    const img = g.createImageData(GRAIN, GRAIN);
    for (let i = 0; i < GRAIN * GRAIN; i++) {
      const n = Math.sin((i + phase * 977) * 12.9898) * 43758.5453;
      const v = 128 + (n - Math.floor(n) - 0.5) * 190;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTiles.push(c);
  }
  return grainTiles;
}
function finish(g, w, h, t, look = {}) {
  if (look.finish === false) return;
  const min = Math.min(w, h);
  const dark = luma(look.bg) < 0.35;
  const bw = Math.max(8, Math.round(w / 4));
  const bh = Math.max(8, Math.round(h / 4));
  const a = scratch(`bloom-a${bw}x${bh}`, bw, bh);
  const b = scratch(`bloom-b${bw}x${bh}`, bw, bh);
  const ag = a.getContext("2d");
  const bg = b.getContext("2d");
  ag.globalCompositeOperation = "source-over";
  ag.clearRect(0, 0, bw, bh);
  ag.filter = `blur(${Math.max(1.5, min * 0.012)}px)`;
  ag.drawImage(g.canvas, 0, 0, bw, bh);
  ag.filter = "none";
  bg.globalCompositeOperation = "copy";
  bg.drawImage(a, 0, 0);
  bg.globalCompositeOperation = "multiply";
  bg.drawImage(a, 0, 0);
  ag.globalCompositeOperation = "copy";
  ag.drawImage(b, 0, 0);
  ag.globalCompositeOperation = "multiply";
  ag.drawImage(b, 0, 0);
  ag.globalCompositeOperation = "source-over";
  g.save();
  g.globalCompositeOperation = "lighter";
  g.globalAlpha = dark ? 0.85 : 0.34;
  g.drawImage(b, 0, 0, w, h);
  g.restore();
  if (look.medium !== "print") {
    g.save();
    g.globalCompositeOperation = "soft-light";
    const warm = g.createLinearGradient(0, 0, w, h);
    warm.addColorStop(0, dark ? "rgba(255, 176, 120, 0.30)" : "rgba(255, 190, 140, 0.20)");
    warm.addColorStop(0.55, "rgba(255, 255, 255, 0)");
    warm.addColorStop(1, dark ? "rgba(70, 110, 255, 0.30)" : "rgba(90, 120, 230, 0.18)");
    g.fillStyle = warm;
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  if (dark) {
    g.save();
    const key = g.createLinearGradient(0, 0, 0, h * 0.7);
    key.addColorStop(0, "rgba(255, 255, 255, 0.06)");
    key.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = key;
    g.fillRect(0, 0, w, h * 0.7);
    g.restore();
  }
  g.save();
  const vig = g.createRadialGradient(
    w * 0.5,
    h * 0.46,
    min * 0.3,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.78
  );
  vig.addColorStop(0, "rgba(0, 0, 0, 0)");
  vig.addColorStop(0.65, dark ? "rgba(0, 0, 0, 0.12)" : "rgba(40, 28, 16, 0.05)");
  vig.addColorStop(1, dark ? "rgba(0, 0, 0, 0.38)" : "rgba(40, 28, 16, 0.16)");
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  g.restore();
  if (look.medium === "film") {
    g.save();
    g.globalCompositeOperation = "screen";
    g.globalAlpha = 0.28;
    const halo = g.createRadialGradient(w * 0.5, h * 0.45, min * 0.1, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    halo.addColorStop(0, "rgba(255, 186, 128, 0.30)");
    halo.addColorStop(0.6, "rgba(255, 150, 110, 0.08)");
    halo.addColorStop(1, "rgba(255, 150, 110, 0)");
    g.fillStyle = halo;
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  if (look.medium === "print") {
    halftone(g, w, h, { cell: Math.max(3, w * 42e-4), alpha: dark ? 0.05 : 0.08 });
    g.save();
    g.globalCompositeOperation = "multiply";
    g.globalAlpha = 0.14;
    const edge = g.createLinearGradient(0, 0, w, h);
    edge.addColorStop(0, "rgba(196, 178, 146, 0.5)");
    edge.addColorStop(0.5, "rgba(255,255,255,0)");
    edge.addColorStop(1, "rgba(196, 178, 146, 0.5)");
    g.fillStyle = edge;
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  if (look.medium === "screen") {
    g.save();
    g.globalCompositeOperation = "screen";
    const sheen = g.createLinearGradient(0, 0, w * 0.9, h);
    sheen.addColorStop(0, "rgba(255,255,255,0.07)");
    sheen.addColorStop(0.35, "rgba(255,255,255,0.012)");
    sheen.addColorStop(0.55, "rgba(255,255,255,0)");
    g.fillStyle = sheen;
    g.fillRect(0, 0, w, h);
    g.restore();
  }
  const tiles = grain();
  const tile = tiles[Math.floor(Math.abs(t) * 24) % tiles.length];
  const off = Math.abs(t) * 37 % GRAIN;
  g.save();
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = dark ? 0.16 : 0.09;
  for (let y = -GRAIN - off * 0.6; y < h; y += GRAIN) {
    for (let x = -GRAIN - off; x < w; x += GRAIN) g.drawImage(tile, x, y);
  }
  g.restore();
}

export {
  medium,
  LOOP_SECONDS,
  CATEGORIES,
  SAMPLES,
  finish
};
