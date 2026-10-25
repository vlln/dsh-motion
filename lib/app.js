import {
  CATEGORIES,
  LOOP_SECONDS,
  SAMPLES,
  finish,
  medium
} from "./chunks/chunk-EQH5C3H5.js";
import {
  __export
} from "./chunks/chunk-WSFCRVEQ.js";

// src/palette.mjs
function makeResolver(timeline2) {
  const palettes = timeline2.palettes ?? {};
  const overrides = timeline2.overrides ?? {};
  return function color(scene3, token, elementId) {
    const chain = [];
    if (elementId) chain.push(overrides[`${scene3.id}/${elementId}`]);
    chain.push(overrides[scene3.id]);
    chain.push(palettes[scene3.palette]);
    chain.push(palettes.main);
    for (const p of chain) {
      if (p && typeof p[token] === "string") return p[token];
    }
    throw new Error(
      `palette token "${token}" is missing (scene=${scene3.id}${elementId ? ` element=${elementId}` : ""})`
    );
  };
}
function patchPalettes(timeline2, patch) {
  for (const [name, tokens] of Object.entries(patch)) {
    timeline2.palettes[name] = { ...timeline2.palettes[name] ?? {}, ...tokens };
  }
}

// src/texts.mjs
function resolveText(timeline2, scene3, slots6, slot) {
  const stored = timeline2.texts?.[scene3.id]?.[slot];
  if (typeof stored === "string") return stored;
  const spec = slots6?.[slot];
  if (spec && typeof spec.default === "string") return spec.default;
  console.warn(`[motion] slot "${slot}" missing in scene "${scene3.id}"`);
  return "";
}
function setText(timeline2, scene3, slots6, slot, value) {
  if (!slots6 || !(slot in slots6)) {
    throw new Error(
      `unknown slot "${slot}" for scene "${scene3.id}"; available: ${Object.keys(slots6 ?? {}).join(", ") || "(none)"}`
    );
  }
  timeline2.texts ??= {};
  timeline2.texts[scene3.id] ??= {};
  timeline2.texts[scene3.id][slot] = String(value);
}
function makeCounter() {
  let counts = /* @__PURE__ */ Object.create(null);
  return {
    reset() {
      counts = /* @__PURE__ */ Object.create(null);
    },
    hit(slot) {
      counts[slot] = (counts[slot] ?? 0) + 1;
    },
    snapshot() {
      return { ...counts };
    },
    verify(scene3) {
      const declared = scene3.textUsage ?? {};
      const warnings = [];
      for (const [slot, n] of Object.entries(counts)) {
        if (!(slot in declared)) warnings.push(`slot "${slot}" read but not declared in textUsage`);
        else if (n > declared[slot]) warnings.push(`slot "${slot}" read ${n}\xD7, declared ${declared[slot]}\xD7`);
      }
      return warnings;
    }
  };
}

// src/params.mjs
function resolveParam(timeline2, scene3, params4, key) {
  const stored = timeline2.params?.[scene3.id]?.[key];
  if (typeof stored === "number" && Number.isFinite(stored)) return stored;
  const spec = params4?.[key];
  if (spec && typeof spec.default === "number") return spec.default;
  throw new Error(`param "${key}" is not declared by scene "${scene3.id}"`);
}
function checkParam(params4, key, value) {
  const declared = Object.keys(params4 ?? {});
  const spec = params4?.[key];
  if (!spec) {
    throw new Error(`unknown param "${key}"; declared: ${declared.join(", ") || "(none)"}`);
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`param "${key}" must be a finite number (got ${JSON.stringify(value)})`);
  }
  if (value < spec.min || value > spec.max) {
    throw new Error(`param "${key}" must be ${spec.min}..${spec.max} (got ${value})`);
  }
  return value;
}
function describeParams(timeline2, scene3, params4) {
  return Object.entries(params4 ?? {}).map(([key, spec]) => ({
    key,
    label: spec.label ?? key,
    min: spec.min,
    max: spec.max,
    step: spec.step ?? 0.01,
    default: spec.default,
    value: resolveParam(timeline2, scene3, params4, key),
    unit: spec.unit ?? null
  }));
}

// src/values.mjs
function resolveValue(timeline2, scene3, specs, key) {
  const stored = timeline2.values?.[scene3.id]?.[key];
  if (typeof stored === "number" && Number.isFinite(stored)) return stored;
  const spec = specs?.[key];
  if (spec && typeof spec.default === "number") return spec.default;
  throw new Error(`value "${key}" is not declared by scene "${scene3.id}"`);
}
function checkValue(specs, key, value) {
  const declared = Object.keys(specs ?? {});
  const spec = specs?.[key];
  if (!spec) throw new Error(`unknown value "${key}"; declared: ${declared.join(", ") || "(none)"}`);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`value "${key}" must be a finite number (got ${JSON.stringify(value)})`);
  }
  if (value < spec.min || value > spec.max) {
    throw new Error(`value "${key}" must be ${spec.min}..${spec.max} (got ${value})`);
  }
  return value;
}
function formatValue(value, spec = {}) {
  const format = spec.format ?? "int";
  let body2;
  if (format === "int") body2 = String(Math.round(value));
  else if (format === "decimal") body2 = value.toFixed(spec.places ?? 1);
  else if (format === "percent") body2 = `${Math.round(value * 100)}%`;
  else if (format === "compact") body2 = Math.abs(value) >= 1e3 ? `${(value / 1e3).toFixed(1)}k` : String(value);
  else throw new Error(`unknown value format "${format}" (int | decimal | percent | compact)`);
  return `${body2}${spec.suffix ?? ""}`;
}
function describeValues(timeline2, scene3, specs) {
  return Object.entries(specs ?? {}).map(([key, spec]) => ({
    key,
    label: spec.label ?? key,
    min: spec.min,
    max: spec.max,
    step: spec.step ?? 1,
    format: spec.format ?? "int",
    suffix: spec.suffix ?? "",
    default: spec.default,
    value: resolveValue(timeline2, scene3, specs, key),
    display: formatValue(resolveValue(timeline2, scene3, specs, key), spec)
  }));
}

// src/text.mjs
var CJK = /[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af\uff00-\uffef]/;
var NO_START = "\uFF09\u3011\u300B\u300D\u300F\u201D\u2019\uFF0C\u3002\u3001\uFF1B\uFF1A\uFF1F\uFF01\u2026\u2014\xB7%\u2030\u3001\uFE12\uFE14\uFE15\uFE16";
var NO_END = "\uFF08\u3010\u300A\u300C\u300E\u201C\u2018([{";
var isSpace = (ch) => ch === " " || ch === "	" || ch === "\n" || ch === "\xA0";
function segments(text) {
  const units = [];
  let word = "";
  let space2 = false;
  const flushWord = () => {
    if (!word) return;
    units.push({ text: (space2 ? " " : "") + word, kind: "word" });
    word = "";
    space2 = false;
  };
  for (const ch of String(text ?? "")) {
    if (isSpace(ch)) {
      flushWord();
      space2 = true;
      continue;
    }
    if (CJK.test(ch)) {
      flushWord();
      units.push({ text: (space2 ? " " : "") + ch, kind: "cjk" });
      space2 = false;
      continue;
    }
    word += ch;
  }
  flushWord();
  const merged = [];
  for (const unit of units) {
    const prev = merged[merged.length - 1];
    const cannotStart = NO_START.includes(unit.text[0]);
    const cannotEnd = prev && NO_END.includes(prev.text[prev.text.length - 1]);
    if (prev && (cannotStart || cannotEnd)) prev.text += unit.text;
    else merged.push({ ...unit });
  }
  return merged;
}
function layoutText({ text, measure, maxWidth, maxLines = Infinity, ellipsis = "\u2026" }) {
  const units = segments(text);
  const lines = [];
  let current = "";
  for (const unit of units) {
    if (!current) {
      current = unit.text.trimStart();
      continue;
    }
    if (measure(current + unit.text) <= maxWidth) {
      current += unit.text;
      continue;
    }
    lines.push(current);
    current = unit.text.trimStart();
  }
  if (current) lines.push(current);
  let truncated = false;
  let shown = lines;
  if (lines.length > maxLines) {
    shown = lines.slice(0, maxLines);
    truncated = true;
    let last2 = shown[shown.length - 1];
    while (last2.length > 1 && measure(last2 + ellipsis) > maxWidth) last2 = last2.slice(0, -1);
    shown[shown.length - 1] = last2 + ellipsis;
  }
  return { lines: shown, truncated };
}

// src/clock.mjs
function sceneTime(scene3, naturalDuration, t2) {
  const raw = Math.max(0, t2 - scene3.start) * (Number(scene3.speed) || 1);
  const natural = Number(naturalDuration);
  if (!(natural > 0) || !(scene3.length > 0)) return raw;
  return raw * (natural / scene3.length);
}

// src/paint.mjs
var TAU = Math.PI * 2;
function smoothPath(pts, closed = true, tension = 0.5) {
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
      p2[1]
    );
  }
  if (closed) p.closePath();
  return p;
}
function capsule(g, a, b, wa, wb = wa) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const ang = Math.atan2(dy, dx);
  const steps = 14;
  g.beginPath();
  for (let i = 0; i <= steps; i++) {
    const th = ang + Math.PI / 2 + i / steps * Math.PI;
    const x = a[0] + Math.cos(th) * (wa / 2);
    const y = a[1] + Math.sin(th) * (wa / 2);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  for (let i = 0; i <= steps; i++) {
    const th = ang - Math.PI / 2 + i / steps * Math.PI;
    const x = b[0] + Math.cos(th) * (wb / 2);
    const y = b[1] + Math.sin(th) * (wb / 2);
    g.lineTo(x, y);
  }
  g.closePath();
}
function wash(g, path, color, { layers = 5, spread = 6, alpha = 0.16, seed = 1 } = {}) {
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
function strokeOutline(g, pts, { width = 3, color = "rgba(20,16,12,0.6)", wobble = 2.2, seed = 2, closed = true } = {}) {
  const h = (n) => {
    const v = Math.sin(n * 41.9 + seed * 17.3) * 43758.5453;
    return v - Math.floor(v);
  };
  const moved = pts.map((p, i) => [p[0] + (h(i) - 0.5) * wobble, p[1] + (h(i + 37) - 0.5) * wobble]);
  g.save();
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineJoin = "round";
  g.lineCap = "round";
  g.stroke(smoothPath(moved, closed));
  g.restore();
}
function space({ w = 1920, h = 1080, eye = [0, 1.6, 0], look = [0, 1.6, -1], up = [0, 1, 0], fov = 50 } = {}) {
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
  const focal = h / 2 / Math.tan(fov * Math.PI / 180 / 2);
  const at = (x, y, z) => {
    const d = sub([x, y, z], eye);
    const depth2 = dot(d, forward);
    if (depth2 < 0.02) return [w / 2, h / 2, 0];
    const k = focal / depth2;
    return [w / 2 + dot(d, right) * k, h / 2 - dot(d, tilted) * k, k];
  };
  const depth = (z) => {
    const d = sub([0, 0, z], eye);
    const along = dot(d, forward);
    return along < 0.02 ? 0 : focal / along;
  };
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
function strokes(base, options = {}) {
  const {
    cell = 12,
    len = 22,
    width = 7,
    angle = null,
    seed = 1,
    t: t2 = 0,
    boil = 8,
    outline = 0.35,
    outlineColor = "#14193c",
    outlineMix = 0.55,
    jitter = 18,
    mask = null,
    alphaMask = false,
    palette = null,
    cap = "round"
  } = options;
  const W = base.width;
  const H = base.height;
  const bctx = base.getContext("2d", { willReadFrequently: true });
  const data = bctx.getImageData(0, 0, W, H).data;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d");
  g.lineCap = cap;
  const step = boil > 0 ? Math.floor(t2 * boil) : 0;
  let a = seed * 1e3 + step >>> 0 || 1;
  const rand = () => {
    a = a + 1831565813 >>> 0;
    let x = a;
    x = Math.imul(x ^ x >>> 15, x | 1);
    x ^= x + Math.imul(x ^ x >>> 7, x | 61);
    return ((x ^ x >>> 14) >>> 0) / 4294967296;
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
      const ang = angle ? angle(px, py, t2) : 0;
      const l = len * (0.7 + rand() * 0.6);
      const dx = Math.cos(ang) * l / 2;
      const dy = Math.sin(ang) * l / 2;
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
function swatch(hexes, mixBase = 0.35) {
  const pool = hexes.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
  return (col, rand) => {
    const k = pool[rand() * pool.length | 0];
    return [k[0] + (col[0] - k[0]) * mixBase, k[1] + (col[1] - k[1]) * mixBase, k[2] + (col[2] - k[2]) * mixBase];
  };
}
function sprite(g, rows, palette, { x = 0, y = 0, scale = 1, flip = false, alpha = 1, outline = null } = {}) {
  const s = Math.max(1, Math.round(scale));
  const w = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const ox = Math.round(x);
  const oy = Math.round(y);
  const at = (r, c) => r >= 0 && r < rows.length && c >= 0 && c < w ? rows[r][c] : ".";
  const filled = (r, c) => Boolean(palette[at(r, c)]);
  g.save();
  g.imageSmoothingEnabled = false;
  g.globalAlpha *= alpha;
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
function grain(g, w, h, { angle = 0, density = 16e-4, alpha = 0.05, seed = 3, color = "#000" } = {}) {
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
var paint = { smoothPath, capsule, wash, strokeOutline, grain, space, sprite, strokes, swatch, TAU };

// src/media.mjs
function fitRect({ srcW, srcH, boxX, boxY, boxW, boxH, fit = "cover", focus = [0.5, 0.5] }) {
  if (!(srcW > 0 && srcH > 0 && boxW > 0 && boxH > 0)) {
    throw new Error(`fitRect needs positive sizes (src ${srcW}x${srcH}, box ${boxW}x${boxH})`);
  }
  const [fx, fy] = focus;
  if (fit === "fill" || fit === "stretch") {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: boxX, dy: boxY, dw: boxW, dh: boxH };
  }
  if (fit === "contain") {
    const scale = Math.min(boxW / srcW, boxH / srcH);
    const dw = srcW * scale;
    const dh = srcH * scale;
    return {
      sx: 0,
      sy: 0,
      sw: srcW,
      sh: srcH,
      dx: boxX + (boxW - dw) / 2,
      dy: boxY + (boxH - dh) / 2,
      dw,
      dh
    };
  }
  if (fit === "cover") {
    const scale = Math.max(boxW / srcW, boxH / srcH);
    const sw = Math.min(srcW, boxW / scale);
    const sh = Math.min(srcH, boxH / scale);
    return {
      sx: (srcW - sw) * clamp01(fx),
      sy: (srcH - sh) * clamp01(fy),
      sw,
      sh,
      dx: boxX,
      dy: boxY,
      dw: boxW,
      dh: boxH
    };
  }
  if (fit === "none") {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: boxX, dy: boxY, dw: srcW, dh: srcH };
  }
  throw new Error(`unknown fit "${fit}" (cover | contain | fill | none)`);
}
function frameRect(index, { cols, rows, frameW, frameH, count }) {
  if (!Number.isInteger(index) || index < 0 || index >= count) {
    throw new Error(`frame ${index} out of range 0..${count - 1}`);
  }
  const col = index % cols;
  const row = Math.floor(index / cols);
  if (row >= rows) throw new Error(`frame ${index} falls outside a ${cols}x${rows} sheet`);
  return { sx: col * frameW, sy: row * frameH, sw: frameW, sh: frameH };
}
function frameAt(t2, { fps, count }) {
  if (!(fps > 0) || !(count > 0)) throw new Error("frameAt needs fps and count");
  const index = Math.floor(Math.max(0, t2) * fps);
  return Math.min(count - 1, index);
}
var clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0.5));

// src/fonts.mjs
var FONTS = {
  sans: {
    stack: 'Inter, "Helvetica Neue", Arial, sans-serif',
    note: "\u6B63\u6587\u3001\u754C\u9762\u3001\u7EDD\u5927\u591A\u6570\u6807\u9898\u7684\u9ED8\u8BA4"
  },
  display: {
    stack: '"Helvetica Neue", "Arial Black", Arial, sans-serif',
    note: "\u5927\u5B57\u6807\u9898\uFF1B\u5B57\u8DDD\u6536\u7D27\u5230 -0.03em \u5DE6\u53F3"
  },
  serif: {
    stack: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    note: "\u6863\u6848\u3001\u56FE\u9274\u3001\u5F15\u6587"
  },
  mono: {
    stack: 'ui-monospace, "SF Mono", Menlo, monospace',
    note: "\u6807\u7B7E\u3001\u6570\u5B57\u3001\u4EE3\u7801\u3001\u65F6\u95F4\u7801"
  }
};
var FONT_KEYS = Object.keys(FONTS);
function fontStack(key = "sans") {
  const font = FONTS[key];
  return font ? font.stack : FONTS.sans.stack;
}
function resolveFont(timeline2, role = "sans") {
  const override = timeline2?.fonts?.[role];
  if (override && typeof override === "object" && override.family) {
    return `${override.family}, ${fontStack(role)}`;
  }
  return fontStack(role);
}
function filmFontOverrides(timeline2) {
  return Object.entries(timeline2?.fonts ?? {}).map(([role, spec]) => {
    if (!spec || typeof spec !== "object") throw new Error(`fonts.${role} must be an object of { family, src? }`);
    return [role, spec];
  });
}
async function loadFilmFonts(timeline2, base = "./") {
  if (typeof document === "undefined" || !document.fonts) return [];
  const loaded = [];
  for (const [role, spec] of filmFontOverrides(timeline2)) {
    if (!spec.src) continue;
    const family = spec.family || role;
    const url = new URL(spec.src, new URL(base, location.href)).href;
    const face = new FontFace(family, `url(${url})`, { weight: String(spec.weight ?? "400 700"), style: "normal" });
    await face.load();
    document.fonts.add(face);
    loaded.push({ role, family, src: spec.src });
  }
  return loaded;
}

// src/rng.mjs
function hash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed, key = "") {
  let a = (seed ^ hash(key)) >>> 0;
  return function next() {
    a = a + 1831565813 >>> 0;
    let t2 = a;
    t2 = Math.imul(t2 ^ t2 >>> 15, t2 | 1);
    t2 ^= t2 + Math.imul(t2 ^ t2 >>> 7, t2 | 61);
    return ((t2 ^ t2 >>> 14) >>> 0) / 4294967296;
  };
}

// src/kernel.mjs
function createKernel({ timeline: timeline2, modules }) {
  const color = makeResolver(timeline2);
  const byId = new Map(modules.map((m) => [m.id, m]));
  const mounted2 = /* @__PURE__ */ new Map();
  const counter = makeCounter();
  const warnings = [];
  let canvas2 = null;
  let surface = null;
  let auditBoxes = null;
  let auditSuppress = 0;
  let active = null;
  let frameText = [];
  let frameNodes = [];
  let width = timeline2.width ?? 1920;
  let height = timeline2.height ?? 1080;
  let dpr2 = 1;
  let scale = 1;
  let lastTime = 0;
  function sceneAt(t2) {
    const total2 = timeline2.duration ?? timeline2.scenes.reduce((a, s) => Math.max(a, s.start + s.length), 0);
    const clamped = Math.max(0, Math.min(t2, total2 - 1e-6));
    for (const s of timeline2.scenes) {
      if (clamped >= s.start && clamped < s.start + s.length) return s;
    }
    return timeline2.scenes[timeline2.scenes.length - 1];
  }
  function makeCtx(scene3, entry) {
    const mod = byId.get(scene3.id);
    if (!mod) throw new Error(`scene module "${scene3.id}" is not registered`);
    const media = { images: /* @__PURE__ */ new Map(), clips: /* @__PURE__ */ new Map() };
    const verbs = paint;
    const paintText = (value, opts = {}) => {
      const g = active;
      const size = opts.size ?? Math.round(height * 0.03);
      const weight = opts.weight ?? 400;
      const lineHeight = opts.lineHeight ?? 1.35;
      const family = resolveFont(timeline2, opts.family ?? "sans");
      const align = opts.align ?? "left";
      const x = opts.x ?? 0;
      const y = opts.y ?? 0;
      const w = opts.w ?? width - x;
      const maxLines = opts.maxLines ?? 3;
      g.save();
      g.font = `${weight} ${size}px ${family}`;
      if ("letterSpacing" in g && opts.letterSpacing) g.letterSpacing = `${opts.letterSpacing}px`;
      g.textBaseline = "top";
      g.textAlign = "left";
      g.fillStyle = opts.color ?? color(scene3, "fg");
      g.globalAlpha = opts.alpha ?? 1;
      const measure = (text) => g.measureText(text).width;
      const { lines, truncated } = layoutText({ text: String(value), measure, maxWidth: w, maxLines, ellipsis: opts.ellipsis ?? "\u2026" });
      const lineH = size * lineHeight;
      const boxes = [];
      auditSuppress++;
      try {
        lines.forEach((line, i) => {
          const lw = measure(line);
          const lx = align === "center" ? x + (w - lw) / 2 : align === "right" ? x + w - lw : x;
          const ly = y + i * lineH;
          g.fillText(line, lx, ly);
          boxes.push({ text: line, x: lx, y: ly, w: lw, h: size });
        });
      } finally {
        auditSuppress--;
      }
      g.restore();
      const first = boxes[0];
      const minX = Math.min(...boxes.map((b) => b.x));
      const maxX = Math.max(...boxes.map((b) => b.x + b.w));
      return {
        box: {
          x: first ? minX : x,
          y,
          w: first ? Math.max(1, maxX - minX) : 0,
          h: Math.max(size, lines.length * lineH)
        },
        lines: boxes,
        truncated
      };
    };
    const loadBitmap = async (src) => {
      const res = await fetch(new URL(src, document.baseURI));
      if (!res.ok) throw new Error(`media "${src}": HTTP ${res.status}`);
      return createImageBitmap(await res.blob());
    };
    return {
      /** Drawing verbs: space, smoothPath, capsule, wash, strokeOutline, grain, sprite. */
      paint: verbs,
      /** Material passes: repaint an image as strokes, charcoal, ink, halftone or glass. */
      medium,
      /**
       * Draw once, into a canvas of the render's own size and coordinate space.
       *
       * This is the idiom that makes material affordable: draw the world once in
       * mount(), pass it through a medium once, then blit it every frame and draw
       * only what moves on top. A scene that redraws its geometry every frame can
       * never afford a material pass, and ends up looking like flat graphics.
       */
      still(draw, { scale: atlas = 1 } = {}) {
        const c = document.createElement("canvas");
        c.width = Math.round(canvas2.width * atlas);
        c.height = Math.round(canvas2.height * atlas);
        const g = c.getContext("2d");
        g.setTransform(dpr2 * scale * atlas, 0, 0, dpr2 * scale * atlas, 0, 0);
        draw(g, width * atlas, height * atlas);
        return c;
      },
      /** Load every asset the scene declared. Called by the kernel before mount(). */
      async preload(names = []) {
        for (const name of names) {
          const spec = timeline2.assets?.[name];
          if (!spec) {
            throw new Error(`scene "${scene3.id}" declares asset "${name}" but timeline.assets has no such entry`);
          }
          if (spec.kind === "image") {
            media.images.set(name, await loadBitmap(spec.src));
            continue;
          }
          if (spec.kind === "clip") {
            const res = await fetch(new URL(`out/media/${name}.json`, document.baseURI));
            if (!res.ok) throw new Error(`clip "${name}" is not prepared \u2014 run: npm run assets`);
            const clip = await res.json();
            media.clips.set(name, { ...clip, sheet: await loadBitmap(clip.src) });
            continue;
          }
          throw new Error(`asset "${name}": unknown kind "${spec.kind}" (image | clip)`);
        }
      },
      canvas: entry.canvas,
      get kind() {
        return entry.kind;
      },
      get width() {
        return width;
      },
      get height() {
        return height;
      },
      get dpr() {
        return dpr2;
      },
      seed: timeline2.seed ?? 746337560,
      sceneStart: scene3.start,
      beats: timeline2.beats?.beats ?? [],
      bpm: timeline2.beats?.bpm ?? null,
      capture: Boolean(globalThis.__CAPTURE__),
      text(slot) {
        counter.hit(slot);
        return resolveText(timeline2, scene3, mod.slots, slot);
      },
      param(key) {
        return resolveParam(timeline2, scene3, mod.params, key);
      },
      color(token, elementId) {
        return color(scene3, token, elementId);
      },
      colorNumber(token, elementId) {
        const hex = color(scene3, token, elementId);
        return parseInt(hex.replace("#", ""), 16);
      },
      font(role) {
        return resolveFont(timeline2, role);
      },
      image(name, opts = {}) {
        if (!active) throw new Error(`image("${name}") called outside a render pass`);
        const bitmap = media.images.get(name);
        if (!bitmap) throw new Error(`image "${name}" is not preloaded (declare it in the scene's assets)`);
        const g = active;
        const boxX = opts.x ?? 0;
        const boxY = opts.y ?? 0;
        const boxW = opts.w ?? bitmap.width;
        const boxH = opts.h ?? bitmap.height;
        const r = fitRect({ srcW: bitmap.width, srcH: bitmap.height, boxX, boxY, boxW, boxH, fit: opts.fit ?? "cover", focus: opts.focus });
        g.save();
        if (opts.alpha !== void 0) g.globalAlpha = opts.alpha;
        g.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
        g.restore();
        frameNodes.push({ kind: "image", name, box: { x: boxX, y: boxY, w: boxW, h: boxH } });
        return { x: boxX, y: boxY, w: boxW, h: boxH };
      },
      frame(name, at, opts = {}) {
        if (!active) throw new Error(`frame("${name}") called outside a render pass`);
        const clip = media.clips.get(name);
        if (!clip) throw new Error(`clip "${name}" is not preloaded (declare it in the scene's assets)`);
        const g = active;
        const boxX = opts.x ?? 0;
        const boxY = opts.y ?? 0;
        const boxW = opts.w ?? clip.frameW;
        const boxH = opts.h ?? clip.frameH;
        const cell = frameRect(frameAt(at, clip), clip);
        const r = fitRect({ srcW: clip.frameW, srcH: clip.frameH, boxX, boxY, boxW, boxH, fit: opts.fit ?? "cover", focus: opts.focus });
        g.save();
        if (opts.alpha !== void 0) g.globalAlpha = opts.alpha;
        g.drawImage(clip.sheet, cell.sx + r.sx, cell.sy + r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
        g.restore();
        frameNodes.push({ kind: "clip", name, box: { x: boxX, y: boxY, w: boxW, h: boxH } });
        return { x: boxX, y: boxY, w: boxW, h: boxH };
      },
      drawText(slot, opts = {}) {
        if (!active) throw new Error(`drawText("${slot}") called outside a render pass`);
        const value = resolveText(timeline2, scene3, mod.slots, slot);
        counter.hit(slot);
        const out = paintText(value, opts);
        frameText.push({ slot, sceneId: scene3.id, kind: "text", box: out.box, lines: out.lines, truncated: out.truncated, text: value });
        return out;
      },
      /** Raw value, for charts and layout maths. */
      value(key) {
        return resolveValue(timeline2, scene3, mod.values, key);
      },
      /** Formatted value drawn as text, registered like a slot so it is editable. */
      drawValue(key, opts = {}) {
        if (!active) throw new Error(`drawValue("${key}") called outside a render pass`);
        const spec = mod.values?.[key];
        const raw = resolveValue(timeline2, scene3, mod.values, key);
        const text = formatValue(raw, spec);
        const out = paintText(text, opts);
        frameText.push({
          slot: `value:${key}`,
          key,
          value: raw,
          sceneId: scene3.id,
          kind: "value",
          box: out.box,
          lines: out.lines,
          truncated: out.truncated,
          text
        });
        return out;
      },
      rng(key) {
        return rng(timeline2.seed ?? 746337560, `${scene3.id}:${key}`);
      },
      asset(name) {
        return new URL(`../assets/${name}`, import.meta.url).href;
      }
    };
  }
  async function mountAll(targetCanvas, size) {
    canvas2 = targetCanvas;
    width = size?.width ?? width;
    height = size?.height ?? height;
    dpr2 = size?.dpr ?? dpr2;
    scale = size?.scale ?? scale;
    canvas2.width = Math.round(width * dpr2 * scale);
    canvas2.height = Math.round(height * dpr2 * scale);
    surface = canvas2.getContext("2d", { colorSpace: "srgb" });
    const instrument = (g) => {
      if (!g || g.__dshMotionAudited) return g;
      const original = g.fillText.bind(g);
      g.fillText = (text, x, y, ...rest) => {
        if (auditBoxes && !auditSuppress) {
          const size2 = Number((g.font.match(/(\d+(?:\.\d+)?)px/) ?? [])[1] ?? 16);
          auditBoxes.push({
            text: String(text).slice(0, 48),
            x: Number(x),
            y: Number(y) - size2 * 0.8,
            w: g.measureText(String(text)).width,
            h: size2,
            font: g.font,
            alpha: g.globalAlpha
          });
        }
        return original(text, x, y, ...rest);
      };
      g.__dshMotionAudited = true;
      return g;
    };
    instrument(surface);
    for (const scene3 of timeline2.scenes) {
      const mod = byId.get(scene3.id);
      const sc = document.createElement("canvas");
      sc.width = canvas2.width;
      sc.height = canvas2.height;
      const kind6 = mod.kind === "auto" || !mod.kind ? "canvas2d" : mod.kind;
      const g = kind6 === "canvas2d" ? instrument(sc.getContext("2d", { colorSpace: "srgb" })) : null;
      const entry = { module: mod, kind: kind6, canvas: sc, g, ctx: null };
      entry.ctx = makeCtx(scene3, entry);
      await entry.ctx.preload(mod.assets ?? []);
      await mod.mount?.(entry.ctx);
      mounted2.set(scene3.id, entry);
    }
  }
  function renderAt(t2) {
    const scene3 = sceneAt(t2);
    const entry = mounted2.get(scene3.id);
    if (!entry) throw new Error(`scene "${scene3.id}" is not mounted`);
    counter.reset();
    frameText = [];
    frameNodes = [];
    if (entry.kind === "canvas2d") {
      entry.g.setTransform(dpr2 * scale, 0, 0, dpr2 * scale, 0, 0);
      entry.g.clearRect(0, 0, width, height);
    }
    active = entry.kind === "canvas2d" ? entry.g : null;
    entry.module.render(sceneTime(scene3, entry.module.duration, t2), entry.ctx);
    lastTime = t2;
    surface.setTransform(1, 0, 0, 1, 0, 0);
    surface.clearRect(0, 0, canvas2.width, canvas2.height);
    surface.drawImage(entry.canvas, 0, 0, canvas2.width, canvas2.height);
    if (entry.module.overlay) {
      surface.setTransform(dpr2 * scale, 0, 0, dpr2 * scale, 0, 0);
      active = surface;
      entry.module.overlay(surface, entry.ctx, sceneTime(scene3, entry.module.duration, t2));
    }
    active = null;
    const issues = counter.verify(entry.module);
    if (issues.length) warnings.push({ scene: scene3.id, t: t2, issues });
  }
  function describe() {
    return {
      width,
      height,
      duration: timeline2.duration,
      scenes: timeline2.scenes.map((s) => {
        const mod = byId.get(s.id);
        return {
          id: s.id,
          name: s.name,
          start: s.start,
          length: s.length,
          kind: mod?.kind ?? "canvas2d",
          slots: mod?.slots ?? {},
          textUsage: mod?.textUsage ?? {},
          params: describeParams(timeline2, s, mod?.params),
          currentText: Object.fromEntries(
            Object.keys(mod?.slots ?? {}).map((k) => [k, resolveText(timeline2, s, mod.slots, k)])
          )
        };
      })
    };
  }
  return {
    timeline: timeline2,
    mountAll,
    get surface() {
      return surface;
    },
    renderAt,
    describe,
    get time() {
      return lastTime;
    },
    get warnings() {
      return warnings;
    },
    setText(sceneId, slot, value) {
      const scene3 = timeline2.scenes.find((s) => s.id === sceneId);
      if (!scene3) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      setText(timeline2, scene3, mod.slots, slot, value);
      return resolveText(timeline2, scene3, mod.slots, slot);
    },
    /** What the last rendered frame actually put on screen, with slot identity. */
    texts() {
      const tight = (record) => {
        const lines = record.lines ?? [];
        if (!lines.length) return record.box;
        const x = Math.min(...lines.map((l) => l.x));
        const y = Math.min(...lines.map((l) => l.y));
        const right = Math.max(...lines.map((l) => l.x + l.w));
        const bottom = Math.max(...lines.map((l) => l.y + l.h));
        return { x, y, w: right - x, h: bottom - y };
      };
      return frameText.map((record) => {
        const box2 = tight(record);
        return {
          scene: record.sceneId,
          slot: record.slot,
          kind: record.kind ?? "text",
          key: record.key,
          value: record.value,
          text: record.text,
          truncated: record.truncated,
          box: { x: Math.round(box2.x), y: Math.round(box2.y), w: Math.round(box2.w), h: Math.round(box2.h) }
        };
      });
    },
    setValue(sceneId, key, value) {
      const scene3 = timeline2.scenes.find((s) => s.id === sceneId);
      if (!scene3) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      checkValue(mod?.values, key, value);
      timeline2.values ??= {};
      timeline2.values[sceneId] ??= {};
      timeline2.values[sceneId][key] = value;
      return resolveValue(timeline2, scene3, mod.values, key);
    },
    /** Assets drawn on the last rendered frame, with their declared source. */
    assets() {
      const seen = /* @__PURE__ */ new Set();
      return frameNodes.filter((node) => {
        const id6 = `${node.kind}:${node.name}`;
        if (seen.has(id6)) return false;
        seen.add(id6);
        return true;
      }).map((node) => {
        const spec = timeline2.assets?.[node.name] ?? {};
        return {
          name: node.name,
          kind: node.kind,
          scene: sceneAt(lastTime).id,
          src: spec.src ?? "",
          editable: node.kind === "image",
          rebakeable: node.kind === "clip",
          box: {
            x: Math.round(node.box.x),
            y: Math.round(node.box.y),
            w: Math.round(node.box.w),
            h: Math.round(node.box.h)
          }
        };
      });
    },
    /** Re-decode every asset after timeline.assets changed. */
    async reloadAssets() {
      for (const [sceneId, entry] of mounted2) {
        const mod = byId.get(sceneId);
        await entry.ctx.preload(mod.assets ?? []);
      }
    },
    describeValues(sceneId) {
      const scene3 = timeline2.scenes.find((s) => s.id === sceneId);
      if (!scene3) throw new Error(`unknown scene "${sceneId}"`);
      return describeValues(timeline2, scene3, byId.get(sceneId)?.values);
    },
    setParam(sceneId, key, value) {
      const scene3 = timeline2.scenes.find((s) => s.id === sceneId);
      if (!scene3) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      checkParam(mod?.params, key, value);
      timeline2.params ??= {};
      timeline2.params[sceneId] ??= {};
      timeline2.params[sceneId][key] = value;
      return resolveParam(timeline2, scene3, mod.params, key);
    },
    /** Replace the timeline in place (after a restore) without re-mounting.
     *  The beat grid came from out/beats.json, not from timeline.json, so keep it. */
    reload(next) {
      const beats = timeline2.beats;
      for (const key of Object.keys(timeline2)) if (!(key in next)) delete timeline2[key];
      Object.assign(timeline2, next);
      if (beats) timeline2.beats = beats;
    },
    /** The live timeline object every resolver closes over. */
    get timeline() {
      return timeline2;
    },
    /** Resolve a palette token for the frame currently drawn (debug + UI). */
    colorAt(token, elementId) {
      return color(sceneAt(lastTime), token, elementId);
    },
    /** Re-run every scene's mount(): scenes cache palette-derived sprites there,
     *  so a style change has to rebuild them. */
    remount() {
      for (const entry of mounted2.values()) {
        try {
          entry.module.mount?.(entry.ctx);
        } catch (error) {
          console.error(`remount ${entry.id ?? ""}`, error);
        }
      }
    },
    setPalette(patch) {
      patchPalettes(timeline2, patch);
    },
    setOverride(sceneId, elementId, patch) {
      timeline2.overrides ??= {};
      const key = elementId ? `${sceneId}/${elementId}` : sceneId;
      timeline2.overrides[key] = { ...timeline2.overrides[key] ?? {}, ...patch };
    },
    /** Render one frame and return the text boxes it drew (layout audit). */
    audit(atT) {
      auditBoxes = [];
      try {
        this.renderAt(atT);
        const drawn = frameText.flatMap(
          (record) => record.lines.map((line) => ({ ...line, slot: record.slot, scene: record.sceneId }))
        );
        return [...auditBoxes, ...drawn];
      } finally {
        auditBoxes = null;
      }
    },
    pick(x, y, atT) {
      const scene3 = sceneAt(atT);
      const entry = mounted2.get(scene3.id);
      const hit = entry?.module.hitTest?.(x, y, Math.max(0, atT - scene3.start));
      if (hit) return hit;
      if (Math.abs(atT - lastTime) > 1e-6) return null;
      for (let i = frameNodes.length - 1; i >= 0; i--) {
        const node = frameNodes[i];
        const { x: nx, y: ny, w, h } = node.box;
        if (x >= nx && x <= nx + w && y >= ny && y <= ny + h) {
          return {
            id: `${node.kind}-${node.name}`,
            kind: node.kind,
            x: Math.round(nx),
            y: Math.round(ny),
            w: Math.round(w),
            h: Math.round(h),
            label: node.name,
            at: Number(atT.toFixed(2))
          };
        }
      }
      for (let i = frameText.length - 1; i >= 0; i--) {
        const record = frameText[i];
        if (record.sceneId !== scene3.id) continue;
        const { x: bx, y: by, w, h } = record.box;
        if (x < bx || x > bx + w || y < by || y > by + h) continue;
        return {
          id: `text-${record.slot}`,
          kind: "text",
          slot: record.slot,
          x: Math.round(bx),
          y: Math.round(by),
          w: Math.round(w),
          h: Math.round(h),
          label: (record.lines[0]?.text ?? record.text).slice(0, 40),
          at: Number(atT.toFixed(2))
        };
      }
      return null;
    },
    textUsage(sceneId, atT) {
      const scene3 = sceneAt(atT);
      if (scene3.id !== sceneId) throw new Error(`t=${atT} is in scene "${scene3.id}", not "${sceneId}"`);
      const entry = mounted2.get(sceneId);
      counter.reset();
      active = entry.kind === "canvas2d" ? entry.g : null;
      entry.module.render(Math.max(0, atT - scene3.start), entry.ctx);
      active = null;
      return counter.snapshot();
    }
  };
}

// src/validate.mjs
var HEX = /^#[0-9a-f]{6}$/i;
var REQUIRED_TOKENS = ["bg", "fg", "accent", "muted", "grid", "panel"];
var FITS = ["trim", "loop"];
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
function validateTimeline(timeline2, modules = null) {
  const errors = [];
  const warnings = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);
  const warn = (path, msg) => warnings.push(`${path}: ${msg}`);
  if (!timeline2 || typeof timeline2 !== "object") {
    return { ok: false, errors: ["timeline: not an object"], warnings };
  }
  for (const key of ["width", "height", "duration"]) {
    if (!isNum(timeline2[key]) || timeline2[key] <= 0) err(key, `must be a positive number (got ${timeline2[key]})`);
  }
  if (timeline2.fps !== void 0 && (!isNum(timeline2.fps) || timeline2.fps < 1 || timeline2.fps > 120)) {
    err("fps", `must be 1..120 (got ${timeline2.fps})`);
  }
  if (timeline2.poster !== void 0) {
    if (!isNum(timeline2.poster) || timeline2.poster < 0 || timeline2.poster > timeline2.duration) {
      err("poster", `must be a number within 0..duration (got ${timeline2.poster})`);
    }
  }
  if (timeline2.fonts !== void 0) {
    if (!timeline2.fonts || typeof timeline2.fonts !== "object" || Array.isArray(timeline2.fonts)) {
      err("fonts", "must be an object of role \u2192 { family, src }");
    } else {
      for (const [role, spec] of Object.entries(timeline2.fonts)) {
        if (!spec || typeof spec !== "object") err(`fonts.${role}`, "must be an object");
        else if (spec.src && !spec.family) err(`fonts.${role}`, "needs a family name for the loaded file");
        else if (spec.src && !String(spec.src).startsWith("fonts/")) {
          err(`fonts.${role}`, "src must live under the film's fonts/ directory");
        }
      }
    }
  }
  if (!timeline2.palettes || typeof timeline2.palettes !== "object") {
    err("palettes", "missing");
  } else {
    if (!timeline2.palettes.main) err("palettes.main", "missing");
    for (const [name, tokens] of Object.entries(timeline2.palettes)) {
      if (!tokens || typeof tokens !== "object") {
        err(`palettes.${name}`, "must be an object of tokens");
        continue;
      }
      for (const [token, value] of Object.entries(tokens)) {
        if (!HEX.test(value)) err(`palettes.${name}.${token}`, `not a hex color (${value})`);
      }
    }
    for (const token of REQUIRED_TOKENS) {
      if (timeline2.palettes.main && !(token in timeline2.palettes.main)) {
        err(`palettes.main.${token}`, "required token missing");
      }
    }
  }
  if (!Array.isArray(timeline2.scenes) || timeline2.scenes.length === 0) {
    err("scenes", "must be a non-empty array");
  } else {
    const ids = /* @__PURE__ */ new Set();
    const moduleById = new Map((modules ?? []).map((m) => [m.id, m]));
    for (const [i, scene3] of timeline2.scenes.entries()) {
      const p = `scenes[${i}]`;
      if (typeof scene3.id !== "string" || !scene3.id) err(`${p}.id`, "must be a non-empty string");
      else if (ids.has(scene3.id)) err(`${p}.id`, `duplicate id "${scene3.id}"`);
      else ids.add(scene3.id);
      if (typeof scene3.name !== "string" || !scene3.name) err(`${p}.name`, "must be a non-empty string");
      if (!isNum(scene3.start) || scene3.start < 0) err(`${p}.start`, "must be >= 0");
      if (!isNum(scene3.length) || scene3.length <= 0) err(`${p}.length`, "must be > 0");
      if (isNum(scene3.start) && isNum(scene3.length) && isNum(timeline2.duration) && scene3.start + scene3.length > timeline2.duration + 1e-6) {
        err(`${p}`, "extends past timeline.duration");
      }
      if (typeof scene3.palette !== "string") err(`${p}.palette`, "must be a palette name");
      else if (timeline2.palettes && !(scene3.palette in timeline2.palettes)) {
        err(`${p}.palette`, `unknown palette "${scene3.palette}"`);
      }
      if (scene3.speed !== void 0 && ![0.5, 1, 2].includes(scene3.speed)) {
        err(`${p}.speed`, `must be 0.5 | 1 | 2 (got ${scene3.speed})`);
      }
      if (modules) {
        const mod = moduleById.get(scene3.id);
        if (!mod) {
          err(`${p}.id`, `no scene module registered for "${scene3.id}"`);
        } else {
          const slots6 = mod.slots ?? {};
          const usage = mod.textUsage ?? {};
          for (const [slot, n] of Object.entries(usage)) {
            if (!(slot in slots6)) err(`scenes[${i}]`, `textUsage references undeclared slot "${slot}"`);
            if (!Number.isInteger(n) || n < 1) err(`scenes[${i}]`, `textUsage.${slot} must be a positive integer`);
          }
          for (const [key, spec] of Object.entries(mod.values ?? {})) {
            const at = `scenes[${i}].values.${key}`;
            if (!isNum(spec?.default)) err(at, "default must be a number");
            if (!isNum(spec?.min) || !isNum(spec?.max)) err(at, "min/max must be numbers");
            else if (spec.min >= spec.max) err(at, `min (${spec.min}) must be < max (${spec.max})`);
            else if (isNum(spec.default) && (spec.default < spec.min || spec.default > spec.max)) {
              err(at, `default (${spec.default}) outside ${spec.min}..${spec.max}`);
            }
            if (spec?.format && !["int", "decimal", "percent", "compact"].includes(spec.format)) {
              err(at, `unknown format "${spec.format}" (int | decimal | percent | compact)`);
            }
          }
          for (const [key, spec] of Object.entries(mod.params ?? {})) {
            const at = `scenes[${i}].params.${key}`;
            if (!isNum(spec?.default)) err(at, "default must be a number");
            if (!isNum(spec?.min) || !isNum(spec?.max)) err(at, "min/max must be numbers");
            else if (spec.min >= spec.max) err(at, `min (${spec.min}) must be < max (${spec.max})`);
            else if (isNum(spec.default) && (spec.default < spec.min || spec.default > spec.max)) {
              err(at, `default (${spec.default}) outside ${spec.min}..${spec.max}`);
            }
          }
        }
      }
    }
    const ordered = [...timeline2.scenes].filter((s) => isNum(s.start) && isNum(s.length)).sort((a, b) => a.start - b.start);
    if (ordered.length) {
      if (Math.abs(ordered[0].start) > 1e-6) err("scenes", `first scene must start at 0 (got ${ordered[0].start})`);
      for (let i = 1; i < ordered.length; i++) {
        const prevEnd = ordered[i - 1].start + ordered[i - 1].length;
        if (Math.abs(ordered[i].start - prevEnd) > 1e-6) {
          err("scenes", `gap or overlap between "${ordered[i - 1].id}" (ends ${prevEnd}) and "${ordered[i].id}" (starts ${ordered[i].start})`);
        }
      }
      const lastEnd = ordered[ordered.length - 1].start + ordered[ordered.length - 1].length;
      if (isNum(timeline2.duration) && Math.abs(lastEnd - timeline2.duration) > 1e-6) {
        err("scenes", `last scene ends at ${lastEnd}, timeline.duration is ${timeline2.duration}`);
      }
    }
  }
  if (timeline2.texts !== void 0) {
    if (!timeline2.texts || typeof timeline2.texts !== "object") {
      err("texts", "must be an object keyed by scene id");
    } else {
      for (const [sceneId, slots6] of Object.entries(timeline2.texts)) {
        const scene3 = timeline2.scenes?.find((s) => s.id === sceneId);
        if (!scene3) {
          err(`texts.${sceneId}`, "unknown scene id");
          continue;
        }
        const mod = modules?.find((m) => m.id === sceneId);
        for (const [slot, value] of Object.entries(slots6 ?? {})) {
          if (typeof value !== "string") err(`texts.${sceneId}.${slot}`, "must be a string");
          if (mod) {
            const spec = mod.slots?.[slot];
            if (!spec) {
              err(`texts.${sceneId}.${slot}`, `unknown slot (declared: ${Object.keys(mod.slots ?? {}).join(", ") || "none"})`);
            } else if (spec.maxChars && typeof value === "string" && value.length > spec.maxChars) {
              err(`texts.${sceneId}.${slot}`, `exceeds maxChars ${spec.maxChars} (got ${value.length})`);
            }
          }
        }
      }
    }
  }
  if (timeline2.overrides !== void 0) {
    for (const [key, patch] of Object.entries(timeline2.overrides ?? {})) {
      const [sceneId, elementId] = key.split("/");
      const scene3 = timeline2.scenes?.find((s) => s.id === sceneId);
      if (!scene3) err(`overrides.${key}`, `unknown scene "${sceneId}"`);
      if (!patch || typeof patch !== "object") err(`overrides.${key}`, "must be an object");
      else for (const [token, value] of Object.entries(patch)) {
        if (!HEX.test(value)) err(`overrides.${key}.${token}`, `not a hex color (${value})`);
        void elementId;
      }
    }
  }
  if (timeline2.params !== void 0) {
    if (!timeline2.params || typeof timeline2.params !== "object") {
      err("params", "must be an object keyed by scene id");
    } else {
      for (const [sceneId, knobs] of Object.entries(timeline2.params)) {
        const scene3 = timeline2.scenes?.find((s) => s.id === sceneId);
        if (!scene3) {
          err(`params.${sceneId}`, "unknown scene id");
          continue;
        }
        if (!knobs || typeof knobs !== "object") {
          err(`params.${sceneId}`, "must be an object of params");
          continue;
        }
        const mod = modules?.find((m) => m.id === sceneId);
        for (const [key, value] of Object.entries(knobs)) {
          const at = `params.${sceneId}.${key}`;
          if (!isNum(value)) {
            err(at, `must be a finite number (got ${JSON.stringify(value)})`);
            continue;
          }
          if (!mod) continue;
          const spec = mod.params?.[key];
          if (!spec) {
            err(at, `unknown param (declared: ${Object.keys(mod.params ?? {}).join(", ") || "none"})`);
          } else if (value < spec.min || value > spec.max) {
            err(at, `must be ${spec.min}..${spec.max} (got ${value})`);
          }
        }
      }
    }
  }
  if (timeline2.values !== void 0) {
    if (!timeline2.values || typeof timeline2.values !== "object") {
      err("values", "must be an object keyed by scene id");
    } else {
      for (const [sceneId, entries] of Object.entries(timeline2.values)) {
        const scene3 = timeline2.scenes?.find((s) => s.id === sceneId);
        if (!scene3) {
          err(`values.${sceneId}`, "unknown scene id");
          continue;
        }
        if (!entries || typeof entries !== "object") {
          err(`values.${sceneId}`, "must be an object of values");
          continue;
        }
        const mod = modules?.find((m) => m.id === sceneId);
        for (const [key, value] of Object.entries(entries)) {
          const at = `values.${sceneId}.${key}`;
          if (!isNum(value)) {
            err(at, `must be a finite number (got ${JSON.stringify(value)})`);
            continue;
          }
          if (!mod) continue;
          const spec = mod.values?.[key];
          if (!spec) {
            err(at, `unknown value (declared: ${Object.keys(mod.values ?? {}).join(", ") || "none"})`);
          } else if (value < spec.min || value > spec.max) {
            err(at, `must be ${spec.min}..${spec.max} (got ${value})`);
          }
        }
      }
    }
  }
  if (timeline2.audio !== void 0) {
    const a = timeline2.audio;
    if (!a || typeof a !== "object") err("audio", "must be an object");
    else {
      if (typeof a.src !== "string" || !a.src) err("audio.src", "must be a non-empty path");
      if (a.start !== void 0 && (!isNum(a.start) || a.start < 0)) err("audio.start", "must be >= 0");
      if (a.targetLufs !== void 0 && (!isNum(a.targetLufs) || a.targetLufs < -30 || a.targetLufs > -5)) {
        err("audio.targetLufs", `must be -30..-5 (got ${a.targetLufs})`);
      }
      if (a.fit !== void 0 && !FITS.includes(a.fit)) err("audio.fit", `must be one of ${FITS.join(" | ")}`);
    }
  }
  if (timeline2.beats !== void 0 && timeline2.beats !== null) {
    const b = timeline2.beats;
    if (!isNum(b.bpm) || b.bpm <= 0) err("beats.bpm", "must be a positive number");
    if (!Array.isArray(b.beats)) err("beats.beats", "must be an array");
  }
  return { ok: errors.length === 0, errors, warnings };
}
function assertTimeline(timeline2, modules = null) {
  const { ok, errors } = validateTimeline(timeline2, modules);
  if (!ok) {
    const detail = errors.map((e) => `  - ${e}`).join("\n");
    throw new Error(`invalid timeline:
${detail}`);
  }
}

// src/scenes/first-peoples.mjs
var first_peoples_exports = {};
__export(first_peoples_exports, {
  hitTest: () => hitTest,
  id: () => id,
  kind: () => kind,
  mount: () => mount,
  params: () => params,
  render: () => render,
  slots: () => slots,
  textUsage: () => textUsage
});

// src/scenes/history.mjs
var easeOut = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
var easeOutBack = (x) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const v = Math.min(1, Math.max(0, x));
  return 1 + c3 * Math.pow(v - 1, 3) + c1 * Math.pow(v - 1, 2);
};
var clamp012 = (x) => Math.min(1, Math.max(0, x));
var PARAMS = {
  axisY: { default: 0.68, min: 0.45, max: 0.82, step: 5e-3, label: "\u8F74\u7EBF\u4F4D\u7F6E" },
  lift: { default: 0.14, min: 0.06, max: 0.26, step: 5e-3, label: "\u5361\u7247\u79BB\u8F74" },
  laneGap: { default: 0.135, min: 0.08, max: 0.2, step: 5e-3, label: "\u53CC\u884C\u95F4\u8DDD" },
  cardW: { default: 0.3, min: 0.18, max: 0.4, step: 5e-3, label: "\u5361\u7247\u5BBD\u5EA6" },
  cardH: { default: 0.118, min: 0.09, max: 0.16, step: 2e-3, label: "\u5361\u7247\u9AD8\u5EA6" },
  enter: { default: 0.32, min: 0.1, max: 0.9, step: 0.01, label: "\u5165\u573A\u65F6\u957F" }
};
function makeHistoryScene(config) {
  const { id: id6, slots: slots6, textUsage: textUsage6, ticks, pins, palette: _palette } = config;
  let ctx4 = null;
  function mount6(context) {
    ctx4 = context;
  }
  const param = (key) => ctx4.param(key);
  const cardTop = (axisY, H, lane) => axisY - H * (param("lift") + lane * param("laneGap"));
  function render6(t2) {
    const g = ctx4.canvas.getContext("2d");
    const W = ctx4.width;
    const H = ctx4.height;
    const bg = ctx4.color("bg");
    const fg = ctx4.color("fg");
    const accent = ctx4.color("accent");
    const muted = ctx4.color("muted");
    const grid = ctx4.color("grid");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = grid;
    g.globalAlpha = 0.35;
    g.lineWidth = 1;
    const step = W / 24;
    const drift = t2 * 6 % step;
    for (let x = -step + drift; x < W + step; x += step) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    g.globalAlpha = 1;
    ctx4.drawText("era", {
      x: W * 0.08,
      y: H * 0.142,
      w: W * 0.5,
      size: Math.round(H * 0.018),
      weight: 600,
      lineHeight: 1.2,
      maxLines: 1,
      color: muted
    });
    ctx4.drawText("title", {
      x: W * 0.08,
      y: H * 0.202,
      w: W * 0.84,
      size: Math.round(H * 0.072),
      weight: 500,
      lineHeight: 1.12,
      maxLines: 1,
      family: "serif",
      color: fg
    });
    const subA = easeOut((t2 - 0.25) / 0.45);
    ctx4.drawText("subtitle", {
      x: W * 0.08,
      y: H * 0.304,
      w: W * 0.84,
      size: Math.round(H * 0.026),
      weight: 400,
      lineHeight: 1.3,
      maxLines: 1,
      color: muted,
      alpha: subA
    });
    const { axisY, x0, x1, cardW, cardH, placed } = layoutPins(W, H);
    const axisA = easeOut((t2 - 0.9) / 0.9);
    g.save();
    g.globalAlpha = axisA;
    g.strokeStyle = grid;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x0, axisY);
    g.lineTo(x1, axisY);
    g.stroke();
    g.fillStyle = muted;
    g.font = `${Math.round(H * 0.016)}px ${ctx4.font("mono")}`;
    for (const tick2 of ticks) {
      const x = x0 + (x1 - x0) * tick2.at;
      g.strokeStyle = grid;
      g.beginPath();
      g.moveTo(x, axisY - 6);
      g.lineTo(x, axisY + 6);
      g.stroke();
      g.textAlign = "center";
      g.fillText(tick2.label, x, axisY + H * 0.032);
    }
    g.textAlign = "left";
    g.restore();
    const pinA = easeOut((t2 - 1.2) / 0.8);
    g.globalAlpha = pinA;
    const stemFor = (pin) => cardTop(axisY, H, pin.lane) + cardH;
    for (const pin of placed) {
      const appear = easeOutBack((t2 - pin.tIn) / param("enter"));
      if (appear <= 0) continue;
      const pinColor = ctx4.color("accent", pin.elementId);
      g.save();
      g.globalAlpha = appear * axisA;
      g.strokeStyle = pinColor;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(pin.px, axisY);
      g.lineTo(pin.px, stemFor(pin));
      g.stroke();
      g.fillStyle = pinColor;
      g.beginPath();
      g.arc(pin.px, axisY, 7, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    for (const pin of placed) {
      const appear = easeOutBack((t2 - pin.tIn) / param("enter"));
      if (appear <= 0) continue;
      const pinColor = ctx4.color("accent", pin.elementId);
      const cardY = cardTop(axisY, H, pin.lane);
      g.save();
      g.globalAlpha = appear * axisA;
      g.translate(0, (1 - appear) * H * 0.07);
      g.fillStyle = ctx4.color("panel");
      g.strokeStyle = pinColor;
      g.lineWidth = 1.5;
      roundRect(g, pin.cx, cardY, cardW, cardH, 10);
      g.fill();
      g.stroke();
      ctx4.drawText(pin.eraSlot, {
        x: pin.cx + 18,
        y: cardY + H * 0.0184,
        w: cardW - 36,
        size: Math.round(H * 0.017),
        weight: 600,
        lineHeight: 1.2,
        maxLines: 1,
        family: "mono",
        color: pinColor,
        alpha: appear * axisA
      });
      ctx4.drawText(pin.noteSlot, {
        x: pin.cx + 18,
        y: cardY + H * 0.0536,
        w: cardW - 36,
        size: Math.round(H * 0.0205),
        weight: 600,
        lineHeight: 1.317,
        maxLines: 2,
        color: fg,
        alpha: appear * axisA
      });
      g.restore();
    }
    g.globalAlpha = 1;
    const beatGrid = ctx4.beats ?? [];
    let pulse = 0;
    if (beatGrid.length) {
      const globalT = t2 + (ctx4.sceneStart ?? 0);
      let nearest = Infinity;
      for (const bt of beatGrid) nearest = Math.min(nearest, Math.abs(bt - globalT));
      pulse = Math.exp(-Math.pow(nearest / 0.1, 2));
    }
    g.fillStyle = accent;
    g.globalAlpha = 0.9;
    g.fillRect(0, H - (6 + pulse * 6), W * clamp012(t2 / 15), 6 + pulse * 6);
    g.globalAlpha = 1;
    void _palette;
  }
  function layoutPins(W, H) {
    const axisY = H * param("axisY");
    const x0 = W * 0.08;
    const x1 = W * 0.92;
    const cardW = W * param("cardW");
    const cardH = H * param("cardH");
    const gap = 12;
    const lanes = [[], []];
    const placed = [];
    for (const pin of [...pins].sort((a, b) => a.at - b.at)) {
      const px = x0 + (x1 - x0) * pin.at;
      const cx = Math.min(Math.max(px - cardW / 2, x0), x1 - cardW);
      let lane = 0;
      for (let l = 0; l < lanes.length; l++) {
        const clash = lanes[l].some(([a, b]) => cx < b + gap && cx + cardW > a - gap);
        if (!clash) {
          lane = l;
          break;
        }
      }
      lanes[lane].push([cx, cx + cardW]);
      placed.push({ ...pin, px, cx, lane, eraSlot: `pin${placed.length + 1}Era`, noteSlot: `pin${placed.length + 1}Note` });
    }
    return { axisY, x0, x1, cardW, cardH, placed };
  }
  function hitTest3(x, y, t2) {
    const { axisY, cardW, cardH, placed } = layoutPins(ctx4.width, ctx4.height);
    for (const pin of placed) {
      if (t2 < pin.tIn) continue;
      const cardY = cardTop(axisY, ctx4.height, pin.lane);
      if (x >= pin.cx && x <= pin.cx + cardW && y >= cardY && y <= cardY + cardH) {
        return {
          id: pin.elementId ? `pin-${pin.elementId}` : `pin-${pin.eraSlot}`,
          kind: "pin",
          x: Math.round(pin.cx),
          y: Math.round(cardY),
          w: Math.round(cardW),
          h: Math.round(cardH),
          label: ctx4.text(pin.eraSlot),
          at: Number(t2.toFixed(2))
        };
      }
    }
    return null;
  }
  return { id: id6, kind: "canvas2d", slots: slots6, textUsage: textUsage6, params: PARAMS, mount: mount6, render: render6, hitTest: hitTest3 };
}
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// src/scenes/first-peoples.mjs
var scene = makeHistoryScene({
  id: "first-peoples",
  slots: {
    era: { default: "About 15,000 years ago", role: "caption", maxChars: 40 },
    title: { default: "The first peoples", role: "title", maxChars: 48 },
    subtitle: { default: "First people arrive from Siberia", role: "subtitle", maxChars: 80 },
    pin1Era: { default: "c. 13,000 BCE", role: "data" },
    pin1Note: { default: "First people arrive from Siberia", role: "label", maxChars: 60 },
    pin2Era: { default: "c. 11,000 BCE", role: "data" },
    pin2Note: { default: "Clovis culture spreads across the Americas", role: "label", maxChars: 60 }
  },
  textUsage: {
    era: 1,
    title: 1,
    subtitle: 1,
    pin1Era: 1,
    pin1Note: 1,
    pin2Era: 1,
    pin2Note: 1
  },
  ticks: [
    { at: 0, label: "16,000 BCE" },
    { at: 0.2, label: "14,000 BCE" },
    { at: 0.4, label: "12,000 BCE" },
    { at: 0.6, label: "10,000 BCE" },
    { at: 0.8, label: "8,000 BCE" },
    { at: 1, label: "6,000 BCE" }
  ],
  pins: [
    { at: 0.3, tIn: 1.8 },
    { at: 0.52, tIn: 3.4 }
  ]
});
var { id, kind, slots, textUsage, params, mount, render, hitTest } = scene;

// src/scenes/cold-war.mjs
var cold_war_exports = {};
__export(cold_war_exports, {
  hitTest: () => hitTest2,
  id: () => id2,
  kind: () => kind2,
  mount: () => mount2,
  params: () => params2,
  render: () => render2,
  slots: () => slots2,
  textUsage: () => textUsage2
});
var scene2 = makeHistoryScene({
  id: "cold-war",
  slots: {
    era: { default: "1945 to 1991", role: "caption", maxChars: 40 },
    title: { default: "The Cold War", role: "title", maxChars: 48 },
    subtitle: { default: "Two superpowers face off", role: "subtitle", maxChars: 80 },
    pin1Era: { default: "1945", role: "data" },
    pin1Note: { default: "Two superpowers", role: "label", maxChars: 60 },
    pin2Era: { default: "1969", role: "data" },
    pin2Note: { default: "People walk on the Moon", role: "label", maxChars: 60 },
    pin3Era: { default: "1975", role: "data" },
    pin3Note: { default: "Out of Vietnam", role: "label", maxChars: 60 }
  },
  textUsage: {
    era: 1,
    title: 1,
    subtitle: 1,
    pin1Era: 1,
    pin1Note: 1,
    pin2Era: 1,
    pin2Note: 1,
    pin3Era: 1,
    pin3Note: 1
  },
  ticks: [
    { at: 0, label: "1945" },
    { at: 0.25, label: "1955" },
    { at: 0.5, label: "1965" },
    { at: 0.75, label: "1975" },
    { at: 1, label: "1985" }
  ],
  pins: [
    { at: 0.18, tIn: 0.6, eraText: "1945", noteText: "Two superpowers", elementId: "superpowers" },
    { at: 0.62, tIn: 1.5 },
    { at: 0.8, tIn: 2.4 }
  ]
});
var { id: id2, kind: kind2, slots: slots2, textUsage: textUsage2, params: params2, mount: mount2, render: render2, hitTest: hitTest2 } = scene2;

// src/scenes/text-lab.mjs
var text_lab_exports = {};
__export(text_lab_exports, {
  id: () => id3,
  kind: () => kind3,
  mount: () => mount3,
  render: () => render3,
  slots: () => slots3,
  textUsage: () => textUsage3
});
var id3 = "text-lab";
var kind3 = "canvas2d";
var slots3 = {
  title: { default: "\u628A\u65B9\u6CD5\u516C\u5F00\uFF0C\u56E0\u4E3A\u6211\u4EEC\u9700\u8981\u8BA9\u66F4\u591A\u4EBA\u770B\u61C2\u8FD9\u5957\u6D41\u7A0B", role: "title", maxChars: 60 },
  body: {
    default: "Every primitive must draw, hit-test, expose what is editable, and survive export. \u8FD9\u6761\u89C4\u5219\u540C\u6837\u9002\u7528\u4E8E\u6587\u5B57\u3002",
    role: "body",
    maxChars: 200
  }
};
var textUsage3 = { title: 1, body: 1 };
var ctx;
function mount3(context) {
  ctx = context;
}
function render3(t2) {
  const g = ctx.canvas.getContext("2d");
  g.fillStyle = ctx.color("bg");
  g.fillRect(0, 0, ctx.width, ctx.height);
  ctx.drawText("title", {
    x: ctx.width * 0.08,
    y: ctx.height * 0.16,
    w: ctx.width * 0.6,
    size: Math.round(ctx.height * 0.075),
    weight: 700,
    lineHeight: 1.25
  });
  ctx.drawText("body", {
    x: ctx.width * 0.08,
    y: ctx.height * 0.56,
    w: ctx.width * 0.5,
    size: Math.round(ctx.height * 0.026),
    lineHeight: 1.5,
    maxLines: 3
  });
  void t2;
}

// src/scenes/media-lab.mjs
var media_lab_exports = {};
__export(media_lab_exports, {
  assets: () => assets,
  id: () => id4,
  kind: () => kind4,
  mount: () => mount4,
  render: () => render4,
  slots: () => slots4,
  textUsage: () => textUsage4
});
var id4 = "media-lab";
var kind4 = "canvas2d";
var assets = ["clipA", "plate"];
var slots4 = {
  caption: { default: "\u5B9E\u62CD\u7247\u6BB5\u4E0E\u9759\u6001\u56FE\uFF0C\u540C\u4E00\u6761\u65F6\u95F4\u8F74\u4E0A", role: "caption", maxChars: 60 }
};
var textUsage4 = { caption: 1 };
var ctx2;
function mount4(context) {
  ctx2 = context;
}
function render4(t2) {
  const g = ctx2.canvas.getContext("2d");
  g.fillStyle = ctx2.color("bg");
  g.fillRect(0, 0, ctx2.width, ctx2.height);
  ctx2.frame("clipA", t2, { x: 120, y: 140, w: 900, h: 506, fit: "cover" });
  ctx2.image("plate", { x: 1140, y: 140, w: 560, h: 420, fit: "contain" });
  ctx2.drawText("caption", { x: 120, y: 760, w: 1500, size: 44, weight: 600 });
}

// src/scenes/data-lab.mjs
var data_lab_exports = {};
__export(data_lab_exports, {
  id: () => id5,
  kind: () => kind5,
  mount: () => mount5,
  render: () => render5,
  slots: () => slots5,
  textUsage: () => textUsage5,
  values: () => values
});
var id5 = "data-lab";
var kind5 = "canvas2d";
var slots5 = {
  heading: { default: "\u6570\u636E\u69FD\uFF1A\u6570\u5B57\u4E5F\u662F\u5185\u5BB9", role: "title", maxChars: 40 }
};
var textUsage5 = { heading: 1 };
var values = {
  speed: { default: 21, min: 0, max: 200, step: 1, label: "\u901F\u5EA6", format: "int", suffix: " km/h" },
  growth: { default: 0.42, min: 0, max: 1, step: 0.01, label: "\u589E\u957F", format: "percent" }
};
var ctx3;
function mount5(context) {
  ctx3 = context;
}
function render5(t2) {
  const g = ctx3.canvas.getContext("2d");
  g.fillStyle = ctx3.color("bg");
  g.fillRect(0, 0, ctx3.width, ctx3.height);
  ctx3.drawText("heading", { x: 160, y: 120, w: 1600, size: 56, weight: 700 });
  ctx3.drawValue("speed", { x: 160, y: 260, w: 900, size: 120, weight: 700, color: ctx3.color("accent") });
  ctx3.drawValue("growth", { x: 160, y: 430, w: 700, size: 72, weight: 600, color: ctx3.color("muted") });
  ctx3.drawValue("speed", { x: 160, y: 620, w: 900, size: 40, weight: 400 });
  const bar = (y, ratio, color) => {
    g.fillStyle = color;
    g.globalAlpha = 0.25;
    g.fillRect(160, y, 1400, 44);
    g.globalAlpha = 1;
    g.fillRect(160, y, Math.max(2, 1400 * Math.min(1, Math.max(0, ratio))), 44);
  };
  bar(720, ctx3.value("speed") / 200, ctx3.color("accent"));
  bar(800, ctx3.value("growth"), ctx3.color("fg"));
  void t2;
}

// src/scenes/index.mjs
var STATIC = [first_peoples_exports, cold_war_exports, text_lab_exports, media_lab_exports, data_lab_exports];
var LAZY = {
  orbit: () => import("./chunks/orbit-6BCKS5W3.js"),
  cards3d: () => import("./chunks/cards3d-JQGCH343.js"),
  desk: () => import("./chunks/desk-YSS4MZBE.js"),
  guide: () => import("./chunks/guide-EQCWGZBM.js"),
  board: () => import("./chunks/board-PXVDZPB5.js"),
  tree: () => import("./chunks/tree-XS4IWTRP.js"),
  prism: () => import("./chunks/prism-PI65Z6BT.js")
};
async function loadModules(sceneIds, base = "./scenes") {
  const wanted = [...new Set(sceneIds)];
  const modules = [];
  for (const id6 of wanted) {
    const builtin = STATIC.find((m) => m.id === id6);
    if (builtin) {
      modules.push(builtin);
      continue;
    }
    if (LAZY[id6]) {
      modules.push(await LAZY[id6]());
      continue;
    }
    let mod;
    try {
      mod = await import(`${base}/${encodeURIComponent(id6)}.mjs`);
    } catch (cause) {
      throw new Error(`scene "${id6}" is neither built in nor found at scenes/${id6}.mjs`, { cause });
    }
    if (mod.id !== id6) throw new Error(`scene module scenes/${id6}.mjs declares id "${mod.id}"`);
    modules.push(mod);
  }
  return modules;
}

// src/mount.mjs
async function mountMotion({ canvas: canvas2, width, height, dpr: dpr2 = window.devicePixelRatio || 1, scale = 1 }) {
  const requested2 = new URLSearchParams(location.search).get("timeline");
  const src = requested2 && /^(\.\/|\/plugins\/dsh-motion\/)/.test(requested2) ? requested2 : "./timeline.json";
  const res = await fetch(src, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) throw Object.assign(new Error("no film in this workspace"), { code: "NO_FILM" });
    throw new Error(`timeline: HTTP ${res.status}`);
  }
  const timeline2 = await res.json();
  try {
    const res2 = await fetch("./out/beats.json");
    if (res2.ok) timeline2.beats = await res2.json();
  } catch {
  }
  const scenesBase = new URL("scenes/", location.href).href;
  const modules = await loadModules(timeline2.scenes.map((s) => s.id), scenesBase);
  assertTimeline(timeline2, modules);
  await loadFilmFonts(timeline2, "./");
  const kernel2 = createKernel({ timeline: timeline2, modules });
  await kernel2.mountAll(canvas2, {
    scale,
    width: width ?? timeline2.width,
    height: height ?? timeline2.height,
    dpr: dpr2
  });
  return { timeline: timeline2, kernel: kernel2, modules };
}

// src/ui/comments.mjs
var escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function createComments({
  canvas: canvas2,
  box: box2,
  selection: selection2,
  popover: popover2,
  popT: popT2,
  popText: popText2,
  popSubmit: popSubmit2,
  popClose: popClose2,
  timeline: timeline2,
  kernel: kernel2,
  fmt: fmt2,
  getTime,
  onSeek,
  onHighlight,
  onClearSelection,
  onError,
  onThreadsChanged,
  session = ""
}) {
  const embedded = window.parent !== window && Boolean(session);
  const pendingAcks = /* @__PURE__ */ new Map();
  window.addEventListener("message", (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.type !== "dshm:comment-ack") return;
    const settle = pendingAcks.get(data.id);
    if (settle) settle(data);
  });
  const anchorLabel = (anchor) => {
    const element = anchor?.elementId;
    const rect = anchor?.rect;
    if (element) return `${fmt2(anchor.t)} \xB7 ${element}`;
    if (rect) {
      return `${fmt2(anchor.t)} \xB7 \u533A\u57DF ${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.w)}\xD7${Math.round(rect.h)}`;
    }
    return fmt2(anchor?.t ?? 0);
  };
  const messageFor = ({ anchor, text }) => `[\u6279\u6CE8] ${anchorLabel(anchor)}
${text}`;
  const deliver = ({ id: id6, anchor, text }) => new Promise((resolve) => {
    if (!embedded) {
      resolve({ ok: false, reason: "\u6CA1\u6709\u4F1A\u8BDD" });
      return;
    }
    const timer = setTimeout(() => {
      pendingAcks.delete(id6);
      resolve({ ok: false, reason: "\u4F1A\u8BDD\u6CA1\u6709\u56DE\u5E94" });
    }, 1e4);
    pendingAcks.set(id6, (data) => {
      clearTimeout(timer);
      pendingAcks.delete(id6);
      resolve(data.ok ? { ok: true } : { ok: false, reason: data.error ?? "\u5931\u8D25" });
    });
    window.parent.postMessage(
      { type: "dshm:comment", id: id6, session, text: messageFor({ anchor, text }) },
      location.origin
    );
  });
  let drag = null;
  let pending = null;
  let suppressClick = false;
  const point = (e) => {
    const rect = canvas2.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width * timeline2.width,
      y: (e.clientY - rect.top) / rect.height * timeline2.height
    };
  };
  const rectFrom = (d) => {
    const x = Math.max(0, Math.min(d.x0, d.x1));
    const y = Math.max(0, Math.min(d.y0, d.y1));
    return {
      x,
      y,
      w: Math.min(timeline2.width, Math.max(d.x0, d.x1)) - x,
      h: Math.min(timeline2.height, Math.max(d.y0, d.y1)) - y
    };
  };
  const showDraft = (rect) => {
    selection2.hidden = false;
    selection2.classList.add("draft");
    selection2.style.left = `${rect.x / timeline2.width * 100}%`;
    selection2.style.top = `${rect.y / timeline2.height * 100}%`;
    selection2.style.width = `${rect.w / timeline2.width * 100}%`;
    selection2.style.height = `${rect.h / timeline2.height * 100}%`;
  };
  const openPopover = (rect) => {
    pending = { rect, t: getTime() };
    showDraft(rect);
    const boxRect = box2.getBoundingClientRect();
    popover2.hidden = false;
    popover2.style.left = `${Math.min(boxRect.width - 288, Math.max(8, (rect.x + rect.w) / timeline2.width * boxRect.width + 10))}px`;
    popover2.style.top = `${Math.min(boxRect.height - 190, Math.max(8, rect.y / timeline2.height * boxRect.height))}px`;
    popT2.textContent = `${fmt2(pending.t)} \xB7 ${Math.round(rect.w)}\xD7${Math.round(rect.h)}`;
    popText2.value = "";
    popText2.focus();
  };
  canvas2.addEventListener("mousedown", (e) => {
    if (!embedded) return;
    if (!document.body.classList.contains("annotating")) return;
    if (e.button !== 0) return;
    const p = point(e);
    drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, moved: false };
    popover2.hidden = true;
    onClearSelection();
    selection2.hidden = true;
    selection2.classList.remove("draft");
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!drag) return;
    const p = point(e);
    drag.x1 = p.x;
    drag.y1 = p.y;
    if (Math.abs(drag.x1 - drag.x0) > 4 || Math.abs(drag.y1 - drag.y0) > 4) drag.moved = true;
    if (drag.moved) showDraft(rectFrom(drag));
  });
  window.addEventListener("mouseup", () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    const rect = rectFrom(d);
    if (rect.w < 8 || rect.h < 8) {
      selection2.hidden = true;
      return;
    }
    selection2.classList.remove("draft");
    openPopover(rect);
    suppressClick = true;
  });
  function cancelDraft() {
    popover2.hidden = true;
    pending = null;
    selection2.hidden = true;
    selection2.classList.remove("draft");
  }
  popClose2.addEventListener("click", cancelDraft);
  async function addComment({ t: t2, rect, text }) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) throw new Error("\u6279\u6CE8\u4E0D\u80FD\u4E3A\u7A7A");
    if (!embedded) throw new Error("\u6CA1\u6709\u4F1A\u8BDD\uFF0C\u6279\u6CE8\u65E0\u5904\u53EF\u53D1");
    const center = rect ? { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } : null;
    const hit = center ? kernel2.pick(center.x, center.y, t2) : null;
    const anchor = { t: t2, rect, elementId: hit?.id ?? null };
    const id6 = `th_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const sent = await deliver({ id: id6, anchor, text: trimmed });
    if (!sent.ok) throw new Error(`\u6CA1\u6709\u9001\u5230\u5BF9\u8BDD\uFF1A${sent.reason}`);
    const res = await fetch("./api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: id6, anchor, text: trimmed, sentAt: (/* @__PURE__ */ new Date()).toISOString() })
    });
    if (!res.ok) throw new Error(`\u6279\u6CE8\u5DF2\u5728\u5BF9\u8BDD\u91CC\uFF0C\u4F46\u9489\u5B50\u6CA1\u5B58\u4E0B\uFF1A${(await res.json()).error ?? res.status}`);
    const { thread } = await res.json();
    await refreshThreads();
    return { thread, sent };
  }
  popSubmit2.addEventListener("click", async () => {
    if (!pending) return;
    const text = popText2.value.trim();
    if (!text) {
      popText2.focus();
      return;
    }
    try {
      const { sent } = await addComment({ t: pending.t, rect: pending.rect, text });
      if (!sent.ok && sent.reason !== "standalone") {
        onError(`\u6279\u6CE8\u5DF2\u4FDD\u5B58\uFF0C\u4F46\u6CA1\u6709\u9001\u5230\u5BF9\u8BDD\uFF1A${escapeHtml(sent.reason)}`);
      }
    } catch (error) {
      onError(String(error?.message ?? error));
      return;
    }
    popover2.hidden = true;
    pending = null;
    selection2.hidden = true;
  });
  popText2.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") popSubmit2.click();
  });
  const threadsCache = [];
  const sceneAt = (t2) => {
    const total2 = timeline2.duration ?? 0;
    const clamped = Math.max(0, Math.min(t2, total2 - 1e-6));
    return timeline2.scenes.find((sc) => clamped >= sc.start && clamped < sc.start + sc.length) ?? timeline2.scenes[timeline2.scenes.length - 1];
  };
  function paintAnchors() {
    for (const old of box2.querySelectorAll(".anchor")) old.remove();
    if (!document.body.classList.contains("annotating")) return;
    const here = sceneAt(getTime())?.id;
    const visible = threadsCache.filter(
      (th) => th.anchor?.rect && th.anchor.rect.w > 0 && th.anchor.rect.h > 0 && sceneAt(th.anchor.t)?.id === here
    );
    for (const [i, th] of visible.entries()) {
      const rect = th.anchor.rect;
      const el = document.createElement("div");
      el.className = "anchor";
      el.dataset.id = th.id;
      el.style.left = `${rect.x / timeline2.width * 100}%`;
      el.style.top = `${rect.y / timeline2.height * 100}%`;
      el.style.width = `${rect.w / timeline2.width * 100}%`;
      el.style.height = `${rect.h / timeline2.height * 100}%`;
      const text = escapeHtml(th.messages?.[0]?.text ?? "");
      el.innerHTML = `
        <span class="anchor-pin">${i + 1}</span>
        <span class="anchor-tag"><b>${fmt2(th.anchor.t)}</b>${text}</span>`;
      el.addEventListener("click", () => {
        onSeek(Number(th.anchor.t));
        onHighlight?.(rect);
      });
      box2.append(el);
    }
  }
  async function refreshThreads() {
    try {
      const { threads = [] } = await (await fetch("./api/comments")).json();
      threadsCache.length = 0;
      threadsCache.push(...threads);
      paintAnchors();
      onThreadsChanged?.();
    } catch {
    }
  }
  return {
    refreshThreads,
    /** Drop a draft box and its note card (leaving annotate mode does this). */
    cancelDraft,
    /** Re-evaluate which outlines belong on this frame. */
    refreshAnchors: () => paintAnchors(),
    /** Open the note box for a clicked object (annotate mode). */
    annotateAt: (rect) => openPopover(rect),
    /** True when a note has a conversation to reach. */
    available: () => embedded,
    addComment,
    consumeSuppress() {
      const value = suppressClick;
      suppressClick = false;
      return value;
    }
  };
}

// src/preview.mjs
var $ = (id6) => document.getElementById(id6);
var canvas = $("stage");
var box = $("canvasBox");
var selection = $("selection");
var slotHl = $("slotHl");
var tc = $("tc");
var durEl = $("dur");
var playBtn = $("play");
var loopBtn = $("loop");
var scenesEl = $("scenes");
var playhead = $("playhead");
var sceneName = $("sceneName");
var modeEl = $("mode");
var popover = $("popover");
var popT = $("popT");
var popText = $("popText");
var popSubmit = $("popSubmit");
var popClose = $("popClose");
var assetsEl = $("assets");
var assetList = $("assetList");
var assetScope = $("assetScope");
var assetNote = $("assetNote");
var staleEl = $("stale");
var beatPeek = document.getElementById("beatPeek");
var beatStills = [];
var exportOpen = $("exportOpen");
var exportModal = $("exportModal");
var exportClose = $("exportClose");
var exportCancel = $("exportCancel");
var expSs = $("expSs");
var expEstimate = $("expEstimate");
var expRun = $("expRun");
var expResult = $("expResult");
var sceneCardName = $("sceneCardName");
var sceneLen = $("sceneLen");
var sceneSpeed = $("sceneSpeed");
var sceneNote = $("sceneNote");
var textsEl = $("texts");
var textList = $("textList");
var textScope = $("textScope");
var textNote = $("textNote");
var knobsEl = $("knobs");
var knobList = $("knobList");
var knobScene = $("knobScene");
var knobNote = $("knobNote");
var params3 = new URLSearchParams(location.search);
var requested = params3.get("timeline");
var sessionId = params3.get("session") ?? (() => {
  const hit = /\/p\/([^/]+)\//.exec(location.pathname);
  return hit ? decodeURIComponent(hit[1]) : "";
})();
var target = requested && /^(\.\/|\/plugins\/dsh-motion\/)/.test(requested) ? requested : null;
var body = (payload) => JSON.stringify(target ? { ...payload, timeline: target } : payload);
var dpr = Math.min(2, window.devicePixelRatio || 1);
var stageStack = document.querySelector(".stage-stack");
if (stageStack && "ResizeObserver" in window) {
  const fit = () => stageStack.style.setProperty("--stage-h", `${Math.max(120, stageStack.clientHeight - 34)}px`);
  new ResizeObserver(fit).observe(stageStack);
  fit();
}
function showEmptyFilm() {
  document.querySelector(".app")?.remove();
  document.querySelector(".timeline")?.remove();
  const empty = document.createElement("div");
  empty.className = "explore";
  const featured = SAMPLES.find((s) => s.featured) ?? SAMPLES[0];
  const rest = SAMPLES.filter((s) => s !== featured);
  const tile = (sample, extra = "") => `
    <button class="tile${extra}" data-id="${sample.id}" data-tag="${sample.tag}"
            aria-label="${sample.title}" style="--tile-bg:${sample.backdrop ?? sample.look.bg};--tile-ink:${sample.look.ink}">
      <span class="tile-shot" style="aspect-ratio:${sample.ratio.toFixed(4)}">
        <canvas aria-hidden="true"></canvas>
        <span class="tile-dur">0:0${LOOP_SECONDS}</span>
      </span>
      ${extra ? "" : `<span class="tile-title">${sample.title}</span>`}
    </button>`;
  empty.innerHTML = `
    <header class="explore-head">
      <h1>\u63A2\u7D22\u52A8\u6548</h1>
      <span class="explore-count">${SAMPLES.length} \u6BB5</span>
    </header>
    ${tile(featured, " tile-feature")}
    <nav class="explore-tabs" aria-label="\u52A8\u6548\u5206\u7C7B">
      ${CATEGORIES.map(
    (tag, i) => `<button class="tab" data-tag="${tag}" aria-pressed="${i === 0}">${tag}</button>`
  ).join("")}
    </nav>
    <div class="masonry">
      ${rest.map((s) => tile(s)).join("")}
    </div>
    <div class="sheet" hidden>
      <div class="sheet-dismiss" data-close></div>
      <div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <button class="sheet-x" data-close aria-label="\u5173\u95ED">\u2715</button>
        <div class="sheet-stage">
          <canvas aria-hidden="true"></canvas>
          <span class="tile-dur sheet-dur">0:0${LOOP_SECONDS}</span>
        </div>
        <div class="sheet-body">
          <h2 id="sheetTitle"></h2>
          <div class="sheet-meta">
            <span class="sheet-tag" id="sheetTag"></span>
            <span class="sheet-len">${LOOP_SECONDS}s \xB7 \u5FAA\u73AF</span>
          </div>
          <p class="sheet-prompt" id="sheetPrompt"></p>
          <div class="sheet-actions">
            <button class="btn ghost" id="sheetCopy">\u590D\u5236\u63D0\u793A\u8BCD</button>
            <button class="btn" id="sheetSend">\u8BA9 Agent \u590D\u523B</button>
            <button class="btn" id="sheetUse" hidden>\u7528\u8FD9\u4E2A\u6837\u677F\u5F00\u59CB</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.append(empty);
  document.body.dataset.empty = "film";
  const tiles = [...empty.querySelectorAll(".tile")];
  const players = playTiles(empty, tiles);
  for (const tab of empty.querySelectorAll(".tab")) {
    tab.addEventListener("click", () => {
      for (const other of empty.querySelectorAll(".tab")) {
        other.setAttribute("aria-pressed", String(other === tab));
      }
      const tag = tab.dataset.tag;
      for (const tile2 of tiles) tile2.hidden = tag !== "\u5168\u90E8" && tile2.dataset.tag !== tag;
      players.refresh();
    });
  }
  const sheet = empty.querySelector(".sheet");
  let sheetCanvas = sheet.querySelector("canvas");
  const sheetTitle = sheet.querySelector("#sheetTitle");
  const sheetTag = sheet.querySelector("#sheetTag");
  const sheetPrompt = sheet.querySelector("#sheetPrompt");
  const sheetCopy = sheet.querySelector("#sheetCopy");
  const sheetSend = sheet.querySelector("#sheetSend");
  const sheetUse = sheet.querySelector("#sheetUse");
  let open = null;
  let player = null;
  const stage = sheet.querySelector(".sheet-stage");
  const sizeStage = (sample) => {
    const cardW = sheet.querySelector(".sheet-card").clientWidth;
    const maxH = Math.min(window.innerHeight * 0.52, 520);
    const w = Math.max(120, Math.min(cardW, maxH * sample.ratio));
    const h = w / sample.ratio;
    stage.style.height = `${h}px`;
    sheetCanvas.style.width = `${w}px`;
    sheetCanvas.style.height = `${h}px`;
  };
  const close = () => {
    sheet.hidden = true;
    document.body.classList.remove("sheet-open");
    open = null;
    player?.stop();
    player = null;
  };
  for (const tile2 of tiles) {
    tile2.addEventListener("click", () => {
      const sample = SAMPLES.find((s) => s.id === tile2.dataset.id);
      if (!sample) return;
      open = sample;
      sheetTitle.textContent = sample.title;
      sheetTag.textContent = sample.tag;
      sheetPrompt.textContent = sample.prompt;
      sheetSend.disabled = !sessionId;
      sheetSend.textContent = sessionId ? "\u8BA9 Agent \u590D\u523B" : "\u5728\u5BF9\u8BDD\u91CC\u6253\u5F00\u624D\u80FD\u53D1\u9001";
      sheetUse.hidden = !sample.template;
      sheetUse.disabled = false;
      sheetUse.textContent = "\u7528\u8FD9\u4E2A\u6837\u677F\u5F00\u59CB";
      sheet.hidden = false;
      document.body.classList.add("sheet-open");
      player?.stop();
      const fresh = document.createElement("canvas");
      sheetCanvas.replaceWith(fresh);
      sheetCanvas = fresh;
      sizeStage(sample);
      player = playOne(sheetCanvas, sample);
      sheet.querySelector(".sheet-card").focus?.();
    });
  }
  for (const closer of sheet.querySelectorAll("[data-close]")) closer.addEventListener("click", close);
  window.addEventListener("resize", () => {
    if (!open) return;
    sizeStage(open);
    player?.resize();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !sheet.hidden) close();
  });
  sheetCopy.addEventListener("click", async () => {
    if (!open) return;
    try {
      await navigator.clipboard.writeText(open.prompt);
      sheetCopy.textContent = "\u5DF2\u590D\u5236";
    } catch {
      sheetPrompt.focus();
      sheetCopy.textContent = "\u9009\u4E2D\u540E\u81EA\u884C\u590D\u5236";
    }
    setTimeout(() => sheetCopy.textContent = "\u590D\u5236\u63D0\u793A\u8BCD", 1600);
  });
  sheetUse.addEventListener("click", async () => {
    if (!open?.template) return;
    sheetUse.disabled = true;
    sheetUse.textContent = "\u6B63\u5728\u5EFA\u7247\u2026";
    try {
      const res = await fetch("./api/template", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: open.template })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "template failed");
      sheetUse.textContent = "\u5DF2\u521B\u5EFA\uFF0C\u6B63\u5728\u6253\u5F00\u2026";
      const next = new URL(location.href);
      next.searchParams.set("from", "template");
      location.replace(next);
    } catch (error) {
      sheetUse.disabled = false;
      sheetUse.textContent = "\u6CA1\u5EFA\u6210\uFF0C\u518D\u8BD5\u4E00\u6B21";
      console.error(error);
    }
  });
  sheetSend.addEventListener("click", () => {
    if (!open || !sessionId) return;
    window.parent.postMessage(
      { type: "dshm:comment", id: `replicate-${Date.now()}`, session: sessionId, text: open.prompt },
      location.origin
    );
    sheetSend.textContent = "\u5DF2\u53D1\u9001";
    sheetSend.disabled = true;
    setTimeout(() => {
      sheetSend.textContent = "\u8BA9 Agent \u590D\u523B";
      sheetSend.disabled = false;
    }, 2e3);
  });
  const timer = setInterval(async () => {
    try {
      const res = await fetch("./timeline.json", { cache: "no-store" });
      if (res.ok) {
        clearInterval(timer);
        location.reload();
      }
    } catch {
    }
  }, 2e3);
}
function fitCanvas(canvas2) {
  const rect = canvas2.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const dpr2 = Math.min(2, window.devicePixelRatio || 1);
  canvas2.width = Math.round(rect.width * dpr2);
  canvas2.height = Math.round(rect.height * dpr2);
  const g = canvas2.getContext("2d");
  g.setTransform(dpr2, 0, 0, dpr2, 0, 0);
  return { g, w: rect.width, h: rect.height };
}
var threeModule;
var loadThree = () => threeModule ??= import("./chunks/three.module-7O6Z4EVB.js");
async function makeGL(canvas2, sample) {
  const THREE = await loadThree();
  const renderer = new THREE.WebGLRenderer({ canvas: canvas2, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const measure = () => {
    const r = canvas2.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  };
  let { w, h } = measure();
  const player = sample.build({ THREE, renderer, width: w, height: h });
  player.resize(w, h);
  return {
    render(t2) {
      const now = measure();
      if (now.w > 1 && now.h > 1 && (Math.abs(now.w - w) > 0.5 || Math.abs(now.h - h) > 0.5)) {
        w = now.w;
        h = now.h;
        player.resize(w, h);
      }
      player.render(t2);
    }
  };
}
function playOne(canvas2, sample) {
  if (sample.engine === "webgl") {
    let raf3 = 0;
    let start2 = performance.now();
    let gl = null;
    makeGL(canvas2, sample).then((player) => {
      gl = player;
      const tick3 = (now) => {
        gl.render((now - start2) / 1e3 % LOOP_SECONDS);
        raf3 = requestAnimationFrame(tick3);
      };
      raf3 = requestAnimationFrame(tick3);
    });
    return {
      stop() {
        cancelAnimationFrame(raf3);
      },
      seek() {
      },
      resize() {
      }
    };
  }
  let raf2 = 0;
  let start = performance.now();
  let paused = false;
  let shown = 0;
  let size = fitCanvas(canvas2);
  const draw = (t2) => {
    if (!size) size = fitCanvas(canvas2);
    if (!size) return;
    size.g.clearRect(0, 0, size.w, size.h);
    sample.draw(size.g, size.w, size.h, t2);
    finish(size.g, size.w, size.h, t2, sample.look);
  };
  const tick2 = (now) => {
    const rect = canvas2.getBoundingClientRect();
    if (Math.abs(rect.width - (size?.w ?? 0)) > 1 || Math.abs(rect.height - (size?.h ?? 0)) > 1) {
      size = fitCanvas(canvas2);
    }
    shown = (now - start) / 1e3 % LOOP_SECONDS;
    draw(shown);
    raf2 = requestAnimationFrame(tick2);
  };
  draw(0);
  if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) raf2 = requestAnimationFrame(tick2);
  return {
    stop() {
      cancelAnimationFrame(raf2);
      raf2 = 0;
    },
    seek(t2) {
      shown = t2;
      draw(t2);
    },
    resize() {
      size = fitCanvas(canvas2);
      draw(shown);
    },
    get paused() {
      return paused;
    }
  };
}
function playTiles(root, tiles) {
  const items = tiles.map((tile) => ({
    tile,
    sample: SAMPLES.find((s) => s.id === tile.dataset.id),
    canvas: tile.querySelector("canvas"),
    g: null,
    gl: null,
    w: 0,
    h: 0,
    on: true
  }));
  const wake = (item) => {
    if (item.sample.engine !== "webgl" || item.gl || item.waking) return;
    item.waking = true;
    makeGL(item.canvas, item.sample).then((player) => {
      item.gl = player;
    });
  };
  const measure = () => {
    for (const item of items) {
      if (item.sample.engine === "webgl") continue;
      const rect = item.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const dpr2 = Math.min(2, window.devicePixelRatio || 1);
      item.canvas.width = Math.round(rect.width * dpr2);
      item.canvas.height = Math.round(rect.height * dpr2);
      item.g = item.canvas.getContext("2d");
      item.g.setTransform(dpr2, 0, 0, dpr2, 0, 0);
      item.w = rect.width;
      item.h = rect.height;
    }
  };
  const frame = (t2) => {
    for (const item of items) {
      if (!item.on || item.tile.hidden) continue;
      if (item.gl) {
        item.gl.render(t2);
        continue;
      }
      if (!item.w) continue;
      item.g.clearRect(0, 0, item.w, item.h);
      item.sample.draw(item.g, item.w, item.h, t2);
      finish(item.g, item.w, item.h, t2, item.sample.look);
    }
  };
  measure();
  if (!("IntersectionObserver" in window)) for (const item of items) wake(item);
  const start = performance.now();
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver(() => {
      measure();
      frame(0);
    });
    for (const item of items) ro.observe(item.canvas);
  }
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    frame(2.4);
    return { refresh: () => frame(2.4) };
  }
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const item = items.find((c) => c.canvas === entry.target);
          if (item) {
            item.on = entry.isIntersecting;
            if (entry.isIntersecting) wake(item);
          }
        }
      },
      { root, threshold: 0.05 }
    );
    for (const item of items) io.observe(item.canvas);
  }
  let raf2 = 0;
  let drewAt = 0;
  const tick2 = (now) => {
    if (now - drewAt > 30) {
      drewAt = now;
      frame((now - start) / 1e3 % LOOP_SECONDS);
    }
    raf2 = requestAnimationFrame(tick2);
  };
  raf2 = requestAnimationFrame(tick2);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf2);
    if (!document.hidden) raf2 = requestAnimationFrame(tick2);
  });
  return {
    refresh() {
      measure();
      frame((performance.now() - start) / 1e3 % LOOP_SECONDS);
    }
  };
}
async function previewScale() {
  const rect = canvas.getBoundingClientRect();
  const shown = rect.width || canvas.clientWidth || window.innerWidth || 0;
  if (!shown) return 1;
  try {
    const res = await fetch(target ?? "./timeline.json", { cache: "no-store" });
    if (!res.ok) return 1;
    const film = await res.json();
    return Math.max(0.4, Math.min(1, shown / (film.width || 1920)));
  } catch {
    return 1;
  }
}
var mounted;
try {
  mounted = await mountMotion({ canvas, dpr, scale: await previewScale() });
} catch (error) {
  if (error?.code !== "NO_FILM") throw error;
  showEmptyFilm();
  await new Promise(() => {
  });
}
var { kernel } = mounted;
var timeline = mounted.timeline;
var total = timeline.duration;
var t = 0;
var playing = false;
var looping = true;
var selected = null;
var raf = 0;
var last = 0;
var fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
};
var chips = [];
var beatStillsLoading = false;
function applyStills() {
  chips.forEach(({ el }, i) => {
    const beat = beatStills[i];
    el.dataset.still = beat?.still ?? "";
    el.dataset.beat = beat?.name ?? "";
  });
}
function loadBeatStills() {
  if (beatStillsLoading || beatStills.length) return;
  beatStillsLoading = true;
  fetch("./out/ref/storyboard.json", { cache: "no-store" }).then((res) => res.ok ? res.json() : null).then((story) => {
    const beats = Array.isArray(story?.beats) ? story.beats : [];
    beatStills = beats.filter((beat) => typeof beat.still === "string" && beat.still.startsWith("out/ref/"));
    applyStills();
  }).catch(() => {
  }).finally(() => {
    beatStillsLoading = false;
  });
}
function showBeatPeek(el) {
  const still = el.dataset.still;
  if (!still || !beatPeek) return;
  const img = beatPeek.querySelector("img");
  const label = beatPeek.querySelector(".beat-peek-label");
  img.src = `./${still}`;
  label.textContent = `${el.dataset.beat ?? ""} ${el.querySelector(".len")?.textContent ?? ""}`.trim();
  const rect = el.getBoundingClientRect();
  beatPeek.hidden = false;
  const width = beatPeek.offsetWidth || 148;
  beatPeek.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, rect.left + rect.width / 2 - width / 2))}px`;
  beatPeek.style.top = `${Math.max(8, rect.top - beatPeek.offsetHeight - 8)}px`;
}
function buildChips(scenes) {
  const sameOrder = chips.length === scenes.length && chips.every((c, i) => c.scene.id === scenes[i].id);
  if (sameOrder) {
    chips.forEach(({ el }, i) => {
      const scene3 = scenes[i];
      el.style.flexGrow = String(scene3.length);
      el.querySelector(".chip-label").innerHTML = `${scene3.name} <span class="len">\xB7 ${scene3.length.toFixed(1)}s</span>`;
      el.dataset.scene = scene3.id;
      chips[i].scene = scene3;
    });
    applyStills();
    loadBeatStills();
    return;
  }
  for (const { el } of chips) el.remove();
  chips = scenes.map((scene3) => {
    const el = document.createElement("div");
    el.className = "chip";
    el.dataset.scene = scene3.id;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.style.flexGrow = String(scene3.length);
    el.style.flexBasis = "0";
    el.innerHTML = `<span class="chip-label">${scene3.name} <span class="len">\xB7 ${scene3.length.toFixed(1)}s</span></span>
      <button class="chip-more" aria-label="\u8FD9\u4E00\u6BB5\u7684\u64CD\u4F5C" title="\u8FD9\u4E00\u6BB5\u7684\u64CD\u4F5C">\u22EF</button>`;
    el.addEventListener("click", (e) => {
      if (e.target.closest(".chip-more")) return;
      if (suppressChip) {
        suppressChip = false;
        return;
      }
      const now = timeline.scenes.find((s) => s.id === el.dataset.scene);
      if (!now) return;
      seekTo(now.start + 1e-3);
    });
    el.addEventListener("pointerenter", () => showBeatPeek(el));
    el.addEventListener("pointerleave", () => {
      if (beatPeek) beatPeek.hidden = true;
    });
    el.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      const now = timeline.scenes.find((s) => s.id === el.dataset.scene);
      if (!now) return;
      seekTo(now.start + 1e-3);
    });
    el.querySelector(".chip-more").addEventListener("click", (e) => {
      e.stopPropagation();
      const now = timeline.scenes.find((s) => s.id === el.dataset.scene) ?? scene3;
      openChipMenu(now, el);
    });
    scenesEl.insertBefore(el, playhead);
    return { el, scene: scene3 };
  });
  applyStills();
  loadBeatStills();
}
buildChips(timeline.scenes);
var reelEl = $("reel");
var reel = [];
function buildReel(scenes) {
  reel = [];
  reelEl.innerHTML = "";
  const count = document.createElement("span");
  count.className = "reel-count";
  count.textContent = `1 / ${scenes.length} \u6BB5`;
  const track = document.createElement("div");
  track.className = "reel-track";
  reelEl.append(count, track);
  scenes.forEach((scene3, i) => {
    const seg = document.createElement("button");
    seg.type = "button";
    seg.className = "reel-seg";
    seg.dataset.seg = scene3.id;
    seg.title = scene3.name;
    seg.setAttribute("aria-label", scene3.name);
    seg.addEventListener("click", () => {
      seekTo(scene3.start + 1e-3);
    });
    track.append(seg);
    reel.push({ seg, scene: scene3 });
    void i;
  });
  reelEl.dataset.count = String(scenes.length);
  reelEl.dataset.index = "0";
}
buildReel(timeline.scenes);
function adoptTimeline(next) {
  timeline = next;
  total = next.duration;
  durEl.textContent = fmt(total);
  if (t > total - 1e-3) t = Math.max(0, total - 1e-3);
  timeline = kernel.timeline ?? next;
  buildChips(timeline.scenes);
  buildReel(timeline.scenes);
  buildStyles();
  applyStyle(currentStyle);
  setTime(t);
}
var chipMenu = document.createElement("div");
chipMenu.className = "chip-menu";
chipMenu.hidden = true;
scenesEl.append(chipMenu);
function closeChipMenu() {
  chipMenu.hidden = true;
}
function openChipMenu(scene3, chipEl) {
  hoverFrame.hidden = true;
  hoverAt = -1;
  chipMenu.innerHTML = `
    <p class="chip-menu-name">${scene3.name}</p>
    <button id="chipPoster" type="button">\u7528\u5F53\u524D\u5E27\u4F5C\u5C01\u9762 \xB7 ${fmt(t)}</button>
    <button id="chipDelete" type="button">\u5220\u9664\u8FD9\u4E00\u6BB5</button>`;
  chipMenu.hidden = false;
  const left = Math.min(
    Math.max(chipEl.offsetLeft + chipEl.offsetWidth - chipMenu.offsetWidth, 0),
    scenesEl.clientWidth - chipMenu.offsetWidth
  );
  chipMenu.style.left = `${left}px`;
  chipMenu.querySelector("#chipPoster").addEventListener("click", async (e) => {
    e.stopPropagation();
    const button = e.currentTarget;
    try {
      const res = await fetch("./api/poster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body({ time: t })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      timeline.poster = data.poster;
      button.textContent = `\u5C01\u9762\uFF1A${fmt(data.poster)}`;
      setTimeout(closeChipMenu, 700);
    } catch (err) {
      button.textContent = `\u5931\u8D25\uFF1A${err.message}`;
    }
  });
  chipMenu.querySelector("#chipDelete").addEventListener("click", async (e) => {
    e.stopPropagation();
    closeChipMenu();
    try {
      const res = await fetch("./api/scene", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: body({ scene: scene3.id, delete: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      kernel.reload(data.timeline);
      adoptTimeline(data.timeline);
    } catch (err) {
      sceneNote.textContent = `\u5220\u9664\u5931\u8D25\uFF1A${err.message}`;
    }
  });
}
window.addEventListener("pointerdown", (e) => {
  if (!chipMenu.hidden && !e.target.closest(".chip-menu") && !e.target.closest(".chip-more")) closeChipMenu();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeChipMenu();
});
var stripDrag = null;
var suppressChip = false;
function timeFromStrip(clientX, rect) {
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return ratio * (total - 1e-3);
}
function currentScene(at) {
  return timeline.scenes.find((s) => at >= s.start && at < s.start + s.length) ?? timeline.scenes.at(-1);
}
scenesEl.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  if (e.target.closest(".chip-more") || e.target.closest(".chip-menu")) return;
  e.preventDefault();
  suppressChip = false;
  stripDrag = { x: e.clientX, moved: false, rect: scenesEl.getBoundingClientRect() };
});
scenesEl.addEventListener("pointermove", (e) => {
  if (!stripDrag) return;
  if (!stripDrag.moved && Math.abs(e.clientX - stripDrag.x) < 3) return;
  stripDrag.moved = true;
  seekTo(timeFromStrip(e.clientX, stripDrag.rect));
});
window.addEventListener("pointerup", (e) => {
  const drag = stripDrag;
  stripDrag = null;
  if (!drag) return;
  if (drag.moved) {
    suppressChip = true;
    return;
  }
  if (e.button !== 0) return;
  seekTo(timeFromStrip(e.clientX, drag.rect));
  suppressChip = true;
});
function setTime(next) {
  t = Math.max(0, Math.min(total - 1e-3, next));
  tc.textContent = fmt(t);
  playhead.style.left = `${t / total * 100}%`;
  const scene3 = currentScene(t);
  sceneName.textContent = scene3.name;
  const reelIndex = timeline.scenes.findIndex((s) => s.id === scene3.id);
  if (reelEl.dataset.index !== String(reelIndex)) {
    reelEl.dataset.index = String(reelIndex);
    reelEl.firstChild.textContent = `${reelIndex + 1} / ${timeline.scenes.length} \u6BB5`;
    for (const { seg, scene: s } of reel) seg.classList.toggle("done", s.start <= t);
  }
  for (const { el, scene: s } of chips) {
    el.setAttribute("aria-current", String(s.id === scene3.id));
    if (s.id === scene3.id) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  refreshSelection();
  comments.refreshAnchors();
  buildKnobs(scene3);
  buildScene(scene3);
  syncExportEstimate();
  refreshTexts();
  refreshAssets();
}
var hlTimer = 0;
function highlightRect(rect, ms = 0) {
  clearTimeout(hlTimer);
  if (!rect || rect.w <= 0 || rect.h <= 0) {
    slotHl.hidden = true;
    return;
  }
  slotHl.hidden = false;
  slotHl.style.left = `${rect.x / timeline.width * 100}%`;
  slotHl.style.top = `${rect.y / timeline.height * 100}%`;
  slotHl.style.width = `${rect.w / timeline.width * 100}%`;
  slotHl.style.height = `${rect.h / timeline.height * 100}%`;
  if (ms) hlTimer = setTimeout(() => slotHl.hidden = true, ms);
}
function showSelection(hit) {
  selection.hidden = false;
  selection.style.left = `${hit.x / timeline.width * 100}%`;
  selection.style.top = `${hit.y / timeline.height * 100}%`;
  selection.style.width = `${hit.w / timeline.width * 100}%`;
  selection.style.height = `${hit.h / timeline.height * 100}%`;
}
function refreshSelection() {
  if (!selected) return;
  const hit = kernel.pick(selected.x + selected.w / 2, selected.y + selected.h / 2, t);
  if (!hit || hit.id !== selected.id) {
    selected = null;
    selection.hidden = true;
    return;
  }
  selected = hit;
  showSelection(hit);
}
function renderFrame() {
  kernel.renderAt(t);
  setTime(t);
}
var queuedSeek = null;
var seekFrame = 0;
function seekTo(next) {
  queuedSeek = next;
  if (seekFrame) return;
  seekFrame = requestAnimationFrame(() => {
    seekFrame = 0;
    const at = queuedSeek;
    queuedSeek = null;
    if (at == null) return;
    setTime(at);
    kernel.renderAt(t);
    if (playing) soundSeek(t);
  });
}
function tick(now) {
  if (!playing) return;
  if (!last) last = now;
  const dt = Math.min(0.1, (now - last) / 1e3);
  last = now;
  let next = sound && !sound.paused ? sound.currentTime - audioOffset : t + dt;
  if (next < 0) next = 0;
  if (next >= total) {
    if (looping) {
      next = 0;
      soundSeek(0);
    } else {
      next = total - 1e-3;
      playing = false;
      soundPause();
      updatePlayButton();
    }
  }
  t = next;
  kernel.renderAt(t);
  setTime(t);
  if (playing) raf = requestAnimationFrame(tick);
}
var audioOffset = Number(timeline.audio?.start ?? 0);
var sound = timeline.audio?.src ? new Audio(new URL(timeline.audio.src, location.href).href) : null;
if (sound) sound.preload = "auto";
var muteBtn = $("mute");
var volume = $("volume");
function setMuted(muted) {
  if (!sound) return;
  sound.muted = muted;
  $("muteWaves").style.display = muted ? "none" : "inline";
  $("muteSlash").style.display = muted ? "inline" : "none";
  muteBtn?.setAttribute("aria-pressed", String(muted));
  muteBtn?.setAttribute("aria-label", muted ? "\u53D6\u6D88\u9759\u97F3" : "\u9759\u97F3");
}
if (sound) {
  sound.volume = Number(volume?.value ?? 0.8);
  setMuted(false);
  muteBtn?.addEventListener("click", () => setMuted(!sound.muted));
  volume?.addEventListener("input", () => {
    sound.volume = Number(volume.value);
    if (sound.volume > 0 && sound.muted) setMuted(false);
  });
} else {
  if (muteBtn) muteBtn.hidden = true;
  if (volume) volume.hidden = true;
}
function soundSeek(at) {
  if (!sound) return;
  const next = Math.max(0, at + audioOffset);
  if (Math.abs(sound.currentTime - next) > 0.05) sound.currentTime = next;
}
function soundPlay() {
  if (!sound) return;
  soundSeek(t);
  sound.play().catch(() => {
  });
}
function soundPause() {
  sound?.pause();
}
function updatePlayButton() {
  const icon = playBtn.querySelector(".i-play");
  const pause = playBtn.querySelector(".i-pause");
  if (icon && pause) {
    icon.style.display = playing ? "none" : "inline";
    pause.style.display = playing ? "inline" : "none";
  }
  playBtn.setAttribute("aria-label", playing ? "pause" : "play");
  modeEl.textContent = playing ? "playing" : "paused";
}
playBtn.addEventListener("click", () => {
  playing = !playing;
  last = 0;
  updatePlayButton();
  if (playing) {
    raf = requestAnimationFrame(tick);
    soundPlay();
  } else {
    cancelAnimationFrame(raf);
    soundPause();
  }
});
loopBtn.addEventListener("click", () => {
  looping = !looping;
  loopBtn.setAttribute("aria-pressed", String(looping));
});
var timelineSrc = target ?? "./timeline.json";
var revision = null;
var pendingTree = null;
var pendingSince = 0;
var dataOnly = (value) => JSON.stringify({ ...value, beats: void 0 });
async function pollRevision() {
  try {
    const query = target ? `?timeline=${encodeURIComponent(target)}` : "";
    const res = await fetch(`./api/revision${query}`, { cache: "no-store" });
    if (!res.ok) return;
    const next = await res.json();
    if (!revision) {
      revision = next;
      const latest2 = await (await fetch(timelineSrc, { cache: "no-store" })).json();
      if (dataOnly(latest2) !== dataOnly(kernel.timeline)) {
        kernel.reload(latest2);
        kernel.renderAt(t);
        adoptTimeline(latest2);
      }
      return;
    }
    if (next.tree !== revision.tree) {
      staleEl.hidden = false;
      const now = Date.now();
      if (pendingTree !== next.tree) {
        pendingTree = next.tree;
        pendingSince = now;
      } else if (now - pendingSince > 1500) {
        location.reload();
        return;
      }
    } else {
      pendingTree = null;
    }
    if (next.timeline === revision.timeline) return;
    const active = document.activeElement;
    if (active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) return;
    revision = next;
    const latest = await (await fetch(timelineSrc, { cache: "no-store" })).json();
    if (dataOnly(latest) === dataOnly(kernel.timeline)) return;
    kernel.reload(latest);
    kernel.renderAt(t);
    adoptTimeline(latest);
  } catch {
  }
}
pollRevision();
setInterval(pollRevision, 2e3);
$("staleReload").addEventListener("click", () => location.reload());
var segValue = (field) => document.querySelector(`.seg[data-field="${field}"] button[aria-pressed="true"]`)?.dataset.value;
for (const field of ["format", "height", "fps", "quality"]) {
  for (const button of document.querySelectorAll(`.seg[data-field="${field}"] button`)) {
    button.addEventListener("click", () => {
      for (const other of button.parentElement.children) other.setAttribute("aria-pressed", String(other === button));
      syncExportEstimate();
    });
  }
}
function syncExportEstimate() {
  const fps = Number(segValue("fps") ?? 60);
  const height = Number(segValue("height") ?? 1080);
  const quality = segValue("quality") ?? "high";
  const gif = (segValue("format") ?? "mp4") === "gif";
  const ss = expSs.checked ? 2 : 1;
  const rate = 0.15 * (height / 1080) ** 1.4 * (fps / 60) * ({ high: 1, medium: 0.62, low: 0.38 }[quality] ?? 1) * (gif ? 1.6 : ss === 2 ? 1.35 : 1);
  const mb = Math.max(0.1, total * rate);
  const secs = Math.round(total * (fps / 60) * (height / 1080) ** 1.2 * (ss === 2 ? 2.2 : 1) * 0.6);
  expEstimate.textContent = `\u7EA6 ${mb.toFixed(1)} MB \xB7 \u7EA6 ${secs} \u79D2`;
}
expSs.addEventListener("change", syncExportEstimate);
var setExportOpen = (open) => {
  exportModal.hidden = !open;
  if (open) {
    syncExportEstimate();
    expResult.textContent = "";
  }
};
exportOpen.addEventListener("click", () => setExportOpen(true));
exportClose.addEventListener("click", () => setExportOpen(false));
exportCancel.addEventListener("click", () => setExportOpen(false));
exportModal.addEventListener("click", (e) => {
  if (e.target === exportModal) setExportOpen(false);
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !exportModal.hidden) setExportOpen(false);
});
expRun.addEventListener("click", async () => {
  expRun.disabled = true;
  const started = Date.now();
  const tick2 = setInterval(() => {
    expResult.textContent = `\u6E32\u67D3\u4E2D\u2026 ${Math.round((Date.now() - started) / 1e3)}s`;
  }, 500);
  try {
    const res = await fetch("./api/export", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({
        format: segValue("format") ?? "mp4",
        fps: Number(segValue("fps") ?? 60),
        height: Number(segValue("height") ?? 1080),
        quality: segValue("quality") ?? "high",
        supersample: expSs.checked ? 2 : 1
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    expResult.textContent = `\u5B8C\u6210 \xB7 ${data.path} \xB7 ${(data.bytes / 1e6).toFixed(1)} MB \xB7 ${(data.ms / 1e3).toFixed(0)}s`;
  } catch (err) {
    expResult.textContent = `\u5BFC\u51FA\u5931\u8D25\uFF1A${err.message}`;
  } finally {
    clearInterval(tick2);
    expRun.disabled = false;
  }
});
var versionMenu = $("versionMenu");
var versionList = $("versionList");
var versionLabel = $("versionLabel");
var versionDot = $("versionDot");
function renderVersions(data) {
  const rows = data.versions ?? [];
  const current = rows.find((row) => row.id === data.current) ?? null;
  versionLabel.textContent = current ? `${current.id} \xB7 ${current.title}` : "\u8FD8\u6CA1\u6709\u7248\u672C";
  versionDot.hidden = !data.dirty;
  versionDot.title = data.dirty ? "\u6709\u672A\u4FDD\u5B58\u4E3A\u7248\u672C\u7684\u4FEE\u6539" : "";
  const empty = rows.length === 0;
  versionMenu.classList.toggle("is-empty", empty);
  versionMenu.open = empty ? false : versionMenu.open;
  versionMenu.querySelector("summary").setAttribute("aria-disabled", String(empty));
  versionList.innerHTML = rows.length ? rows.map(
    (row, i) => `
        <button class="version-row" data-id="${row.id}" aria-current="${row.id === current?.id}">
          <span class="id">${row.id}</span>
          <span class="title">${row.title}</span>
        </button>`
  ).join("") : "";
  for (const button of versionList.querySelectorAll(".version-row")) {
    button.addEventListener("click", async () => {
      const id6 = button.dataset.id;
      if (id6 === current?.id) {
        versionMenu.open = false;
        return;
      }
      button.disabled = true;
      try {
        const res = await fetch("./api/versions/use", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body({ id: id6 })
        });
        if (!res.ok) {
          const data2 = await res.json().catch(() => ({}));
          throw new Error(data2.error ?? res.statusText);
        }
        location.reload();
      } catch (error) {
        button.disabled = false;
        versionList.insertAdjacentHTML("afterbegin", `<p class="hint">\u5207\u6362\u5931\u8D25\uFF1A${error.message}</p>`);
      }
    });
  }
}
window.addEventListener("pointerdown", (e) => {
  if (versionMenu?.open && !e.target.closest("#versionMenu")) versionMenu.open = false;
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && versionMenu?.open) versionMenu.open = false;
});
async function loadVersions() {
  try {
    renderVersions(await (await fetch("./api/versions")).json());
  } catch {
    versionLabel.textContent = "\u7248\u672C";
  }
}
var styleList = $("styleList");
var paletteEditor = $("paletteEditor");
var paletteTokens = $("paletteTokens");
var paletteName = $("paletteName");
var paletteNote = $("paletteNote");
var palettePickHint = $("palettePickHint");
var TOKEN_ORDER = ["bg", "panel", "grid", "accent", "fg", "muted"];
var railTabs = [...document.querySelectorAll(".rail-tab")];
var railPanels = [...document.querySelectorAll(".rail-panel")];
var authoredPalette = new Map(timeline.scenes.map((s) => [s.id, s.palette]));
var currentStyle = "";
try {
  currentStyle = localStorage.getItem("dshm:style") ?? "";
} catch {
}
var allComments = $("allComments");
var escapeHtml2 = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
async function loadAllComments() {
  try {
    const { threads = [] } = await (await fetch("./api/comments")).json();
    if (!threads.length) {
      allComments.innerHTML = '<p class="hint">\u8FD8\u6CA1\u6709\u6279\u6CE8\u3002\u5F00\u542F\u6279\u6CE8\u6A21\u5F0F\uFF0C\u5728\u753B\u9762\u4E0A\u70B9\u9009\u6216\u6846\u9009\u3002</p>';
      return;
    }
    const groups = /* @__PURE__ */ new Map();
    for (const thread of threads) {
      const t2 = Number(thread.anchor?.t ?? 0);
      const scene3 = timeline.scenes.find((sc) => t2 >= sc.start && t2 < sc.start + sc.length) ?? timeline.scenes.at(-1);
      if (!scene3) continue;
      if (!groups.has(scene3.id)) groups.set(scene3.id, { scene: scene3, rows: [] });
      groups.get(scene3.id).rows.push(thread);
    }
    allComments.innerHTML = [...groups.values()].sort((a, b) => a.scene.start - b.scene.start).map(
      ({ scene: scene3, rows }) => `
        <section class="comment-group">
          <h3>${escapeHtml2(scene3.name)}<span>${rows.length}</span></h3>
          ${rows.sort((a, b) => Number(a.anchor.t) - Number(b.anchor.t)).map(
        (thread) => `
            <button class="comment-row" data-t="${Number(thread.anchor.t)}">
              <span class="t">${fmt(Number(thread.anchor.t))}</span>
              <span class="txt">${escapeHtml2(thread.messages?.[0]?.text ?? "")}</span>
            </button>`
      ).join("")}
        </section>`
    ).join("");
    const rectOf = new Map(threads.map((thread) => [Number(thread.anchor?.t), thread.anchor?.rect ?? null]));
    for (const row of allComments.querySelectorAll(".comment-row")) {
      row.addEventListener("click", () => {
        const at = Number(row.dataset.t);
        seekTo(at);
        const rect = rectOf.get(at);
        if (rect) highlightRect(rect, 1600);
      });
    }
  } catch {
    allComments.innerHTML = '<p class="hint">\u8BFB\u4E0D\u5230\u6279\u6CE8\u3002</p>';
  }
}
function setRailTab(name) {
  for (const tab of railTabs) tab.setAttribute("aria-selected", String(tab.dataset.tab === name));
  for (const panel of railPanels) panel.hidden = panel.dataset.panel !== name;
  if (name === "comments") loadAllComments();
  try {
    localStorage.setItem("dshm:rail", name);
  } catch {
  }
}
for (const tab of railTabs) tab.addEventListener("click", () => setRailTab(tab.dataset.tab));
try {
  setRailTab(localStorage.getItem("dshm:rail") ?? "tweaks");
} catch {
  setRailTab("tweaks");
}
function applyStyle(name) {
  currentStyle = name;
  for (const scene3 of timeline.scenes) {
    scene3.palette = name || authoredPalette.get(scene3.id) || "main";
  }
  try {
    localStorage.setItem("dshm:style", name);
  } catch {
  }
  for (const button of styleList.querySelectorAll(".palette")) {
    button.setAttribute("aria-pressed", String(button.dataset.style === name));
  }
  renderPaletteEditor(name);
  kernel.remount?.();
  kernel.renderAt(t);
  refreshSelection();
}
function paletteTokensOf(name) {
  const base = timeline.palettes?.main ?? {};
  const own = timeline.palettes?.[name] ?? {};
  const merged = { ...base, ...own };
  const extra = Object.keys(merged).filter((token) => !TOKEN_ORDER.includes(token)).sort();
  return [...TOKEN_ORDER.filter((token) => token in merged), ...extra].map((token) => ({
    token,
    value: merged[token],
    own: token in own
  }));
}
function renderPaletteEditor(name) {
  const has = Boolean(name && timeline.palettes?.[name]);
  paletteEditor.hidden = !has;
  palettePickHint.hidden = has;
  if (!has) return;
  paletteName.textContent = name;
  paletteTokens.innerHTML = paletteTokensOf(name).map(
    ({ token, value }) => `
      <div class="token-row" data-token="${token}">
        <span class="token-name">${token}</span>
        <input class="token-hex" data-token="${token}" value="${value}" maxlength="7" spellcheck="false" />
        <input class="token-color" data-token="${token}" type="color" value="${value}" />
      </div>`
  ).join("");
  for (const row of paletteTokens.querySelectorAll(".token-row")) {
    const token = row.dataset.token;
    const hex = row.querySelector(".token-hex");
    const chip = row.querySelector(".token-color");
    const commit = (value) => {
      const normal = String(value).trim().startsWith("#") ? String(value).trim() : `#${String(value).trim()}`;
      if (!/^#[0-9a-f]{6}$/i.test(normal)) {
        paletteNote.hidden = false;
        paletteNote.textContent = "\u989C\u8272\u8981\u5199\u6210 #rrggbb";
        return;
      }
      paletteNote.hidden = true;
      applyToken(name, token, normal.toLowerCase());
      hex.value = normal.toLowerCase();
      chip.value = normal.toLowerCase();
    };
    hex.addEventListener("change", () => commit(hex.value));
    chip.addEventListener("input", () => {
      hex.value = chip.value;
      kernel.setPalette({ [name]: { [token]: chip.value } });
      kernel.renderAt(t);
    });
    chip.addEventListener("change", () => commit(chip.value));
  }
}
async function applyToken(name, token, hex) {
  kernel.setPalette({ [name]: { [token]: hex } });
  kernel.remount?.();
  kernel.renderAt(t);
  buildStyles();
  for (const button of styleList.querySelectorAll(".palette")) {
    button.setAttribute("aria-pressed", String(button.dataset.style === currentStyle));
  }
  try {
    const res = await fetch("./api/palette", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ name, tokens: { [token]: hex } })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      paletteNote.hidden = false;
      paletteNote.textContent = `\u6CA1\u5199\u8FDB\u7247\u5B50\uFF1A${data.error ?? res.status}\uFF08\u91CD\u542F\u5BBF\u4E3B\u540E\u751F\u6548\uFF09`;
    }
  } catch (error) {
    paletteNote.hidden = false;
    paletteNote.textContent = `\u6CA1\u5199\u8FDB\u7247\u5B50\uFF1A${error.message}`;
  }
}
function buildStyles() {
  const palettes = timeline.palettes ?? {};
  const base = palettes.main ?? {};
  const names = Object.keys(palettes);
  styleList.innerHTML = names.map((name) => {
    const merged = { ...base, ...palettes[name] };
    const dots = ["bg", "panel", "accent", "fg", "muted"].map((token) => `<i style="background:${merged[token] ?? "#000"}"></i>`).join("");
    return `<button class="palette" data-style="${name}" aria-pressed="${currentStyle === name}" aria-label="${name}" title="${name}">${dots}</button>`;
  }).join("");
  for (const button of styleList.querySelectorAll(".palette")) {
    button.addEventListener("click", () => applyStyle(button.dataset.style));
  }
  renderPaletteEditor(currentStyle);
}
var paletteAdd = $("paletteAdd");
paletteAdd?.addEventListener("click", async () => {
  const base = timeline.palettes?.[currentStyle] ?? timeline.palettes?.main ?? {};
  const merged = { ...timeline.palettes?.main ?? {}, ...base };
  const names = new Set(Object.keys(timeline.palettes ?? {}));
  let name = "custom-1";
  for (let i = 2; names.has(name); i += 1) name = `custom-${i}`;
  try {
    const res = await fetch("./api/palette", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ name, tokens: merged, create: true })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    timeline.palettes[name] = data.palette;
    buildStyles();
    applyStyle(name);
  } catch (error) {
    paletteNote.hidden = false;
    paletteNote.textContent = `\u65B0\u5EFA\u914D\u8272\u5931\u8D25\uFF1A${error.message}`;
  }
});
buildStyles();
applyStyle(currentStyle);
loadVersions();
var sceneKey = "";
async function persistScene(patch) {
  const scene3 = currentScene(t);
  try {
    const res = await fetch("./api/scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ scene: scene3.id, ...patch })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    const latest = await (await fetch(timelineSrc, { cache: "no-store" })).json();
    kernel.reload(latest);
    adoptTimeline(kernel.timeline ?? latest);
    sceneNote.textContent = `\u5DF2\u4FDD\u5B58 \xB7 \u603B\u65F6\u957F ${data.duration}s`;
  } catch (err) {
    sceneNote.textContent = `\u4FDD\u5B58\u5931\u8D25\uFF1A${err.message}`;
    syncSceneFields(scene3);
  }
}
function syncSceneFields(scene3) {
  const sceneIndex = timeline.scenes.findIndex((s) => s.id === scene3.id) + 1;
  sceneCardName.textContent = `${sceneIndex} / ${timeline.scenes.length}`;
  if (document.activeElement !== sceneNameInput) sceneNameInput.value = scene3.name;
  sceneLen.value = String(scene3.length);
  sceneSpeed.value = String(scene3.speed ?? 1);
}
function buildScene(scene3) {
  if (sceneKey === scene3.id) return;
  sceneKey = scene3.id;
  syncSceneFields(scene3);
}
var prevSceneBtn = $("prevScene");
var nextSceneBtn = $("nextScene");
var sceneNameInput = $("sceneNameInput");
var sceneIndexAt = (at) => timeline.scenes.findIndex((s) => s.id === currentScene(at).id);
prevSceneBtn?.addEventListener("click", () => {
  const i = sceneIndexAt(t);
  if (i > 0) {
    seekTo(timeline.scenes[i - 1].start + 1e-3);
  }
});
nextSceneBtn?.addEventListener("click", () => {
  const i = sceneIndexAt(t);
  if (i >= 0 && i < timeline.scenes.length - 1) {
    seekTo(timeline.scenes[i + 1].start + 1e-3);
  }
});
sceneNameInput?.addEventListener("change", async () => {
  const scene3 = currentScene(t);
  const name = sceneNameInput.value.trim();
  if (!name || name === scene3.name) {
    sceneNameInput.value = scene3.name;
    return;
  }
  try {
    const res = await fetch("./api/scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ scene: scene3.id, name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    const latest = await (await fetch(timelineSrc, { cache: "no-store" })).json();
    kernel.reload(latest);
    adoptTimeline(kernel.timeline ?? latest);
  } catch (err) {
    sceneNote.textContent = `\u6539\u540D\u5931\u8D25\uFF1A${err.message}`;
    sceneNameInput.value = currentScene(t).name;
  }
});
sceneLen.addEventListener("change", () => persistScene({ length: Number(sceneLen.value) }));
sceneSpeed.addEventListener("change", () => persistScene({ speed: Number(sceneSpeed.value) }));
var assetKey = "";
async function persistAsset(name, src) {
  try {
    const res = await fetch("./api/assets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ name, src })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    kernel.timeline.assets[name].src = data.src;
    await kernel.reloadAssets();
    kernel.renderAt(t);
    assetNote.textContent = `\u5DF2\u4FDD\u5B58 \xB7 \u5FEB\u7167 ${data.snapshot.id.slice(25)}`;
    refreshAssets();
  } catch (err) {
    assetNote.textContent = `\u4FDD\u5B58\u5931\u8D25\uFF1A${err.message}`;
  }
}
async function persistRebake(name, src) {
  try {
    assetNote.textContent = "\u91CD\u70D8\u4E2D\u2026";
    const res = await fetch("./api/assets/rebake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ name, src })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    kernel.timeline.assets[name].src = data.src;
    await kernel.reloadAssets();
    kernel.renderAt(t);
    assetNote.textContent = `\u5DF2\u91CD\u70D8 \xB7 ${data.manifest.count} \u5E27 ${data.manifest.cols}\xD7${data.manifest.rows}`;
    refreshAssets();
  } catch (err) {
    assetNote.textContent = `\u91CD\u70D8\u5931\u8D25\uFF1A${err.message}`;
  }
}
function refreshAssets() {
  const items = kernel.assets();
  assetsEl.hidden = items.length === 0;
  assetScope.textContent = items.length ? `${items.length} \u4E2A` : "";
  const key = items.map((item) => `${item.kind}:${item.name}`).join("|");
  if (key !== assetKey) {
    assetList.replaceChildren();
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "asset-row";
      const name = document.createElement("span");
      name.className = "slot";
      name.textContent = `${item.name} \xB7 ${item.kind}`;
      const line = document.createElement("div");
      line.className = "asset-line";
      const input = document.createElement("input");
      input.value = item.src;
      input.disabled = !item.editable && !item.rebakeable;
      input.dataset.assetName = item.name;
      input.addEventListener("focus", () => highlightRect(item.box));
      input.addEventListener("blur", () => highlightRect(null));
      if (item.editable) input.addEventListener("change", () => persistAsset(item.name, input.value));
      line.append(input);
      if (item.rebakeable) {
        const bake = document.createElement("button");
        bake.className = "btn ghost";
        bake.textContent = "\u91CD\u70D8";
        bake.dataset.bake = item.name;
        bake.addEventListener("click", () => persistRebake(item.name, input.value));
        line.append(bake);
      }
      row.append(name, line);
      assetList.append(row);
    }
    assetKey = key;
    return;
  }
  for (const input of assetList.querySelectorAll("input")) {
    if (document.activeElement === input) continue;
    const item = items.find((i) => i.name === input.dataset.assetName);
    if (item && input.value !== item.src) input.value = item.src;
  }
}
var textKey = "";
async function persistValue(sceneId, key, value) {
  try {
    const res = await fetch("./api/values", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ scene: sceneId, key, value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    textNote.textContent = `\u5DF2\u4FDD\u5B58 \xB7 \u5FEB\u7167 ${data.snapshot.id.slice(25)}`;
  } catch (err) {
    textNote.textContent = `\u4FDD\u5B58\u5931\u8D25\uFF1A${err.message}`;
  }
}
async function persistText(sceneId, slot, value) {
  try {
    const res = await fetch("./api/texts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ scene: sceneId, slot, value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    textNote.textContent = `\u5DF2\u4FDD\u5B58 \xB7 \u5FEB\u7167 ${data.snapshot.id.slice(25)}`;
  } catch (err) {
    textNote.textContent = `\u4FDD\u5B58\u5931\u8D25\uFF1A${err.message}`;
  }
}
function refreshTexts() {
  const items = kernel.texts();
  textsEl.hidden = items.length === 0;
  textScope.textContent = "";
  const key = items.map((item) => `${item.scene}/${item.slot}`).join("|");
  if (key !== textKey) {
    textList.replaceChildren();
    for (const item of items) {
      const isValue = item.kind === "value";
      const spec = isValue ? kernel.describeValues(item.scene).find((v) => v.key === item.key) : null;
      const row = document.createElement("label");
      row.className = "text-row";
      const name = document.createElement("span");
      name.className = "slot";
      name.textContent = isValue ? `${spec?.label ?? item.key} \xB7 \u6570\u503C` : item.truncated ? `${item.slot} \xB7 \u5DF2\u622A\u65AD` : item.slot;
      const input = document.createElement("input");
      input.dataset.textScene = item.scene;
      input.dataset.textSlot = item.slot;
      if (isValue) {
        input.type = "number";
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(item.value);
        input.addEventListener("focus", () => highlightRect(item.box));
        input.addEventListener("blur", () => highlightRect(null));
        input.addEventListener("input", () => {
          kernel.setValue(item.scene, item.key, Number(input.value));
          kernel.renderAt(t);
          textNote.textContent = "\u672A\u4FDD\u5B58";
        });
        input.addEventListener("change", () => persistValue(item.scene, item.key, Number(input.value)));
      } else {
        input.value = item.text;
        input.addEventListener("focus", () => highlightRect(item.box));
        input.addEventListener("blur", () => highlightRect(null));
        input.addEventListener("input", () => {
          kernel.setText(item.scene, item.slot, input.value);
          kernel.renderAt(t);
          textNote.textContent = "\u672A\u4FDD\u5B58";
        });
        input.addEventListener("change", () => persistText(item.scene, item.slot, input.value));
      }
      row.append(name, input);
      textList.append(row);
    }
    textKey = key;
    return;
  }
  for (const input of textList.querySelectorAll("input")) {
    if (document.activeElement === input) continue;
    const item = items.find((i) => i.scene === input.dataset.textScene && i.slot === input.dataset.textSlot);
    if (!item) continue;
    const next = item.kind === "value" ? String(item.value) : item.text;
    if (input.value !== next) input.value = next;
  }
}
var knobOwner = null;
function fmtKnob(value, step) {
  const decimals = Math.min(3, String(step).split(".")[1]?.length ?? 2);
  return value.toFixed(decimals);
}
async function persistParam(sceneId, key, value) {
  try {
    const res = await fetch("./api/params", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ scene: sceneId, key, value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    knobNote.textContent = `\u5DF2\u4FDD\u5B58 \xB7 \u5FEB\u7167 ${data.snapshot.id.slice(25)}`;
  } catch (err) {
    knobNote.textContent = `\u4FDD\u5B58\u5931\u8D25\uFF1A${err.message}`;
  }
}
function buildKnobs(scene3, { force = false } = {}) {
  if (!force && knobOwner === scene3.id) return;
  knobOwner = scene3.id;
  const rows = kernel.describe().scenes.find((s) => s.id === scene3.id)?.params ?? [];
  knobList.replaceChildren();
  knobsEl.hidden = rows.length === 0;
  knobScene.textContent = scene3.name;
  for (const row of rows) {
    const label = document.createElement("label");
    label.className = "knob";
    const head = document.createElement("span");
    head.className = "knob-head";
    const name = document.createElement("span");
    name.textContent = row.label;
    const out = document.createElement("output");
    out.textContent = fmtKnob(row.value, row.step);
    head.append(name, out);
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(row.min);
    input.max = String(row.max);
    input.step = String(row.step);
    input.value = String(row.value);
    input.dataset.key = row.key;
    input.addEventListener("input", () => {
      const value = Number(input.value);
      out.textContent = fmtKnob(value, row.step);
      kernel.setParam(scene3.id, row.key, value);
      kernel.renderAt(t);
      knobNote.textContent = "\u672A\u4FDD\u5B58";
    });
    input.addEventListener("change", () => persistParam(scene3.id, row.key, Number(input.value)));
    label.append(head, input);
    knobList.append(label);
  }
  knobNote.textContent = rows.length ? "\u62D6\u52A8\u5373\u65F6\u751F\u6548\uFF0C\u677E\u624B\u5199\u5165 timeline.json\u3002" : "\u8FD9\u4E00\u5E55\u6CA1\u6709\u53EF\u8C03\u53C2\u6570\u3002";
}
var comments = createComments({
  canvas,
  box,
  selection,
  popover,
  popT,
  popText,
  popSubmit,
  popClose,
  timeline,
  kernel,
  fmt,
  getTime: () => t,
  onHighlight: (rect) => highlightRect(rect, 1600),
  onSeek: (next) => {
    seekTo(next);
  },
  onClearSelection: () => {
    selected = null;
  },
  onThreadsChanged: () => loadAllComments(),
  onError: (message) => {
    console.error("[comments]", message);
  },
  session: sessionId
});
var annotateBtn = $("annotateMode");
function setAnnotating(on) {
  document.body.classList.toggle("annotating", on);
  annotateBtn?.setAttribute("aria-pressed", String(on));
  if (!on) {
    comments.cancelDraft();
    selected = null;
    selection.hidden = true;
  }
  comments.refreshAnchors();
}
annotateBtn?.addEventListener("click", () => setAnnotating(!document.body.classList.contains("annotating")));
var tweaksBtn = $("tweaksToggle");
function setTweaks(on) {
  document.body.classList.toggle("tweaks", on);
  tweaksBtn?.setAttribute("aria-pressed", String(on));
  try {
    localStorage.setItem("dshm:tweaks", on ? "1" : "0");
  } catch {
  }
}
var storedTweaks = "1";
try {
  storedTweaks = localStorage.getItem("dshm:tweaks") ?? "0";
} catch {
}
setTweaks(storedTweaks === "1");
tweaksBtn?.addEventListener("click", () => setTweaks(!document.body.classList.contains("tweaks")));
canvas.addEventListener("pointermove", (e) => {
  if (playing) return;
  if (document.body.classList.contains("annotating")) {
    canvas.style.cursor = "crosshair";
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * timeline.width;
  const y = (e.clientY - rect.top) / rect.height * timeline.height;
  const hit = kernel.pick(x, y, t);
  canvas.style.cursor = hit ? hit.slot ? "text" : "pointer" : "default";
});
canvas.addEventListener("click", (e) => {
  if (comments.consumeSuppress()) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * timeline.width;
  const y = (e.clientY - rect.top) / rect.height * timeline.height;
  const hit = kernel.pick(x, y, t);
  const target2 = hit ? { x: hit.x, y: hit.y, w: hit.w, h: hit.h } : { x: x - 60, y: y - 30, w: 120, h: 60 };
  if (hit) {
    selected = hit;
    refreshSelection();
  } else {
    selected = null;
    selection.hidden = true;
  }
  if (document.body.classList.contains("annotating")) {
    if (comments.available()) comments.annotateAt(target2);
    return;
  }
  if (hit?.slot) {
    if (!document.body.classList.contains("tweaks")) setTweaks(true);
    setRailTab("tweaks");
    const input = textList.querySelector(`input[data-text-scene="${currentScene(t).id}"][data-text-slot="${hit.slot}"]`);
    if (input) {
      void input.offsetHeight;
      input.focus();
      input.select();
    }
    return;
  }
});
var fullscreenBtn = $("fullscreen");
var canvasBox = $("canvasBox");
fullscreenBtn?.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await canvasBox.requestFullscreen();
  } catch {
  }
});
document.addEventListener("fullscreenchange", () => {
  fullscreenBtn?.setAttribute("aria-pressed", String(!!document.fullscreenElement));
});
var hoverFrame = $("hoverFrame");
var hoverCanvas = $("hoverCanvas");
var hoverTime = $("hoverTime");
var hoverCtx = hoverCanvas.getContext("2d");
var hoverRaf = 0;
var hoverAt = -1;
function paintHover(at, clientX) {
  if (Math.abs(at - hoverAt) > 0.05) {
    kernel.renderAt(at);
    hoverCtx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
    hoverCtx.drawImage(canvas, 0, 0, hoverCanvas.width, hoverCanvas.height);
    kernel.renderAt(t);
    hoverAt = at;
  }
  hoverTime.textContent = fmt(at);
  const rect = scenesEl.getBoundingClientRect();
  const card = hoverFrame.getBoundingClientRect();
  const left = Math.min(Math.max(clientX - rect.left - card.width / 2, 0), rect.width - card.width);
  hoverFrame.style.left = `${left}px`;
  hoverFrame.hidden = false;
}
scenesEl.addEventListener("pointermove", (e) => {
  if (stripDrag || playing || !chipMenu.hidden) {
    hoverFrame.hidden = true;
    return;
  }
  const rect = scenesEl.getBoundingClientRect();
  const at = Math.min(total - 1e-3, Math.max(0, (e.clientX - rect.left) / rect.width * total));
  const x = e.clientX;
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    paintHover(at, x);
  });
});
scenesEl.addEventListener("pointerleave", () => {
  hoverFrame.hidden = true;
  hoverAt = -1;
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    playBtn.click();
  } else if (e.code === "ArrowRight") {
    seekTo(t + 1 / (timeline.fps ?? 30));
  } else if (e.code === "ArrowLeft") {
    seekTo(t - 1 / (timeline.fps ?? 30));
  }
});
durEl.textContent = fmt(total);
updatePlayButton();
renderFrame();
comments.refreshThreads();
loadAllComments();
window.__PREVIEW__ = {
  ready: true,
  time: () => t,
  setTime: (v) => {
    setTime(v);
    renderFrame();
  },
  selected: () => selected,
  audit: (t2) => kernel.audit(t2),
  texts: () => kernel.texts(),
  revision: () => revision,
  stale: () => !staleEl.hidden,
  assets: () => kernel.assets(),
  setAssetSrc: async (name, src) => {
    kernel.timeline.assets[name].src = src;
    await kernel.reloadAssets();
    kernel.renderAt(t);
    refreshAssets();
  },
  pick: (x, y, at = t) => kernel.pick(x, y, at),
  // Same path the popover uses: store the pin, then say it in the conversation.
  comment: (payload) => comments.addComment(payload),
  session: () => sessionId,
  sound: () => sound ? { src: sound.src, at: sound.currentTime, paused: sound.paused, muted: sound.muted, volume: sound.volume } : null,
  play: () => playBtn.click(),
  scenes: timeline.scenes.map((s) => ({ id: s.id, start: s.start, length: s.length })),
  get duration() {
    return total;
  },
  scenes: () => timeline.scenes.map((s) => ({ id: s.id, start: s.start, length: s.length })),
  style: () => ({ current: currentStyle, palettes: timeline.scenes.map((s) => s.palette) }),
  remount: () => kernel.remount?.(),
  color: (token) => kernel.colorAt?.(token),
  boxRect: () => box.getBoundingClientRect(),
  comments: async () => (await (await fetch("./api/comments")).json()).threads,
  params: () => ({
    scene: knobOwner,
    knobs: [...knobList.querySelectorAll("input[data-key]")].map((input) => ({
      key: input.dataset.key,
      value: Number(input.value)
    })),
    status: knobNote.textContent
  }),
  setPoster: async (time) => {
    const res = await fetch("./api/poster", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ time })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    timeline.poster = data.poster;
    return data.poster;
  },
  setParam: async (scene3, key, value, persist = true) => {
    kernel.setParam(scene3, key, value);
    kernel.renderAt(t);
    buildKnobs(currentScene(t), { force: true });
    if (persist) await persistParam(scene3, key, value);
    return value;
  },
  history: async () => (await (await fetch("./api/history")).json()).snapshots,
  undo: async () => {
    const { snapshots } = await (await fetch("./api/history")).json();
    const id6 = snapshots[0]?.id;
    if (!id6) return;
    const res = await fetch("./api/history/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ id: id6 })
    });
    if (!res.ok) return;
    const data = await res.json();
    kernel.reload(data.timeline);
    kernel.renderAt(t);
  },
  pixel: (x, y) => {
    const g = kernel.surface;
    const scale = g.canvas.width / timeline.width;
    const d = g.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }
};
if (new URLSearchParams(location.search).get("from") === "template") {
  const poster = Math.min(Number(timeline.poster) || 0, Math.max(0, total - 0.05));
  if (poster > 0) seekTo(poster);
}
