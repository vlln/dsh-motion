// src/palette.mjs
function makeResolver(timeline2) {
  const palettes = timeline2.palettes ?? {};
  const overrides = timeline2.overrides ?? {};
  return function color(scene, token, elementId) {
    const chain = [];
    if (elementId) chain.push(overrides[`${scene.id}/${elementId}`]);
    chain.push(overrides[scene.id]);
    chain.push(palettes[scene.palette]);
    chain.push(palettes.main);
    for (const p of chain) {
      if (p && typeof p[token] === "string") return p[token];
    }
    throw new Error(
      `palette token "${token}" is missing (scene=${scene.id}${elementId ? ` element=${elementId}` : ""})`
    );
  };
}
function patchPalettes(timeline2, patch) {
  for (const [name, tokens] of Object.entries(patch)) {
    timeline2.palettes[name] = { ...timeline2.palettes[name] ?? {}, ...tokens };
  }
}

// src/texts.mjs
function resolveText(timeline2, scene, slots, slot) {
  const stored = timeline2.texts?.[scene.id]?.[slot];
  if (typeof stored === "string") return stored;
  const spec = slots?.[slot];
  if (spec && typeof spec.default === "string") return spec.default;
  console.warn(`[motion] slot "${slot}" missing in scene "${scene.id}"`);
  return "";
}
function setText(timeline2, scene, slots, slot, value) {
  if (!slots || !(slot in slots)) {
    throw new Error(
      `unknown slot "${slot}" for scene "${scene.id}"; available: ${Object.keys(slots ?? {}).join(", ") || "(none)"}`
    );
  }
  timeline2.texts ??= {};
  timeline2.texts[scene.id] ??= {};
  timeline2.texts[scene.id][slot] = String(value);
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
    verify(scene) {
      const declared = scene.textUsage ?? {};
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
function resolveParam(timeline2, scene, params2, key) {
  const stored = timeline2.params?.[scene.id]?.[key];
  if (typeof stored === "number" && Number.isFinite(stored)) return stored;
  const spec = params2?.[key];
  if (spec && typeof spec.default === "number") return spec.default;
  throw new Error(`param "${key}" is not declared by scene "${scene.id}"`);
}
function checkParam(params2, key, value) {
  const declared = Object.keys(params2 ?? {});
  const spec = params2?.[key];
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
function describeParams(timeline2, scene, params2) {
  return Object.entries(params2 ?? {}).map(([key, spec]) => ({
    key,
    label: spec.label ?? key,
    min: spec.min,
    max: spec.max,
    step: spec.step ?? 0.01,
    default: spec.default,
    value: resolveParam(timeline2, scene, params2, key),
    unit: spec.unit ?? null
  }));
}

// src/values.mjs
function resolveValue(timeline2, scene, specs, key) {
  const stored = timeline2.values?.[scene.id]?.[key];
  if (typeof stored === "number" && Number.isFinite(stored)) return stored;
  const spec = specs?.[key];
  if (spec && typeof spec.default === "number") return spec.default;
  throw new Error(`value "${key}" is not declared by scene "${scene.id}"`);
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
function describeValues(timeline2, scene, specs) {
  return Object.entries(specs ?? {}).map(([key, spec]) => ({
    key,
    label: spec.label ?? key,
    min: spec.min,
    max: spec.max,
    step: spec.step ?? 1,
    format: spec.format ?? "int",
    suffix: spec.suffix ?? "",
    default: spec.default,
    value: resolveValue(timeline2, scene, specs, key),
    display: formatValue(resolveValue(timeline2, scene, specs, key), spec)
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
  let space = false;
  const flushWord = () => {
    if (!word) return;
    units.push({ text: (space ? " " : "") + word, kind: "word" });
    word = "";
    space = false;
  };
  for (const ch of String(text ?? "")) {
    if (isSpace(ch)) {
      flushWord();
      space = true;
      continue;
    }
    if (CJK.test(ch)) {
      flushWord();
      units.push({ text: (space ? " " : "") + ch, kind: "cjk" });
      space = false;
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
function sceneTime(scene, naturalDuration, t2) {
  const raw = Math.max(0, t2 - scene.start) * (Number(scene.speed) || 1);
  const natural = Number(naturalDuration);
  if (!(natural > 0) || !(scene.length > 0)) return raw;
  return raw * (natural / scene.length);
}

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
  function makeCtx(scene, entry) {
    const mod = byId.get(scene.id);
    if (!mod) throw new Error(`scene module "${scene.id}" is not registered`);
    const media = { images: /* @__PURE__ */ new Map(), clips: /* @__PURE__ */ new Map() };
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
      g.fillStyle = opts.color ?? color(scene, "fg");
      g.globalAlpha = opts.alpha ?? 1;
      const measure = (text) => g.measureText(text).width;
      const { lines, truncated } = layoutText({ text: String(value), measure, maxWidth: w, maxLines, ellipsis: opts.ellipsis ?? "\u2026" });
      const lineH = size * lineHeight;
      const boxes = [];
      auditSuppress++;
      try {
        lines.forEach((line2, i) => {
          const lw = measure(line2);
          const lx = align === "center" ? x + (w - lw) / 2 : align === "right" ? x + w - lw : x;
          const ly = y + i * lineH;
          g.fillText(line2, lx, ly);
          boxes.push({ text: line2, x: lx, y: ly, w: lw, h: size });
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
            throw new Error(`scene "${scene.id}" declares asset "${name}" but timeline.assets has no such entry`);
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
      sceneStart: scene.start,
      beats: timeline2.beats?.beats ?? [],
      bpm: timeline2.beats?.bpm ?? null,
      capture: Boolean(globalThis.__CAPTURE__),
      text(slot) {
        counter.hit(slot);
        return resolveText(timeline2, scene, mod.slots, slot);
      },
      param(key) {
        return resolveParam(timeline2, scene, mod.params, key);
      },
      color(token, elementId) {
        return color(scene, token, elementId);
      },
      colorNumber(token, elementId) {
        const hex = color(scene, token, elementId);
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
        const value = resolveText(timeline2, scene, mod.slots, slot);
        counter.hit(slot);
        const out = paintText(value, opts);
        frameText.push({ slot, sceneId: scene.id, kind: "text", box: out.box, lines: out.lines, truncated: out.truncated, text: value });
        return out;
      },
      /** Raw value, for charts and layout maths. */
      value(key) {
        return resolveValue(timeline2, scene, mod.values, key);
      },
      /** Formatted value drawn as text, registered like a slot so it is editable. */
      drawValue(key, opts = {}) {
        if (!active) throw new Error(`drawValue("${key}") called outside a render pass`);
        const spec = mod.values?.[key];
        const raw = resolveValue(timeline2, scene, mod.values, key);
        const text = formatValue(raw, spec);
        const out = paintText(text, opts);
        frameText.push({
          slot: `value:${key}`,
          key,
          value: raw,
          sceneId: scene.id,
          kind: "value",
          box: out.box,
          lines: out.lines,
          truncated: out.truncated,
          text
        });
        return out;
      },
      rng(key) {
        return rng(timeline2.seed ?? 746337560, `${scene.id}:${key}`);
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
    for (const scene of timeline2.scenes) {
      const mod = byId.get(scene.id);
      const sc = document.createElement("canvas");
      sc.width = canvas2.width;
      sc.height = canvas2.height;
      const kind = mod.kind === "auto" || !mod.kind ? "canvas2d" : mod.kind;
      const g = kind === "canvas2d" ? instrument(sc.getContext("2d", { colorSpace: "srgb" })) : null;
      const entry = { module: mod, kind, canvas: sc, g, ctx: null };
      entry.ctx = makeCtx(scene, entry);
      await entry.ctx.preload(mod.assets ?? []);
      await mod.mount?.(entry.ctx);
      mounted2.set(scene.id, entry);
    }
  }
  function renderAt(t2) {
    const scene = sceneAt(t2);
    const entry = mounted2.get(scene.id);
    if (!entry) throw new Error(`scene "${scene.id}" is not mounted`);
    counter.reset();
    frameText = [];
    frameNodes = [];
    if (entry.kind === "canvas2d") {
      entry.g.setTransform(dpr2 * scale, 0, 0, dpr2 * scale, 0, 0);
      entry.g.clearRect(0, 0, width, height);
    }
    active = entry.kind === "canvas2d" ? entry.g : null;
    entry.module.render(sceneTime(scene, entry.module.duration, t2), entry.ctx);
    lastTime = t2;
    surface.setTransform(1, 0, 0, 1, 0, 0);
    surface.clearRect(0, 0, canvas2.width, canvas2.height);
    surface.drawImage(entry.canvas, 0, 0, canvas2.width, canvas2.height);
    if (entry.module.overlay) {
      surface.setTransform(dpr2 * scale, 0, 0, dpr2 * scale, 0, 0);
      active = surface;
      entry.module.overlay(surface, entry.ctx, sceneTime(scene, entry.module.duration, t2));
    }
    active = null;
    const issues = counter.verify(entry.module);
    if (issues.length) warnings.push({ scene: scene.id, t: t2, issues });
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
      const scene = timeline2.scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      setText(timeline2, scene, mod.slots, slot, value);
      return resolveText(timeline2, scene, mod.slots, slot);
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
      const scene = timeline2.scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      checkValue(mod?.values, key, value);
      timeline2.values ??= {};
      timeline2.values[sceneId] ??= {};
      timeline2.values[sceneId][key] = value;
      return resolveValue(timeline2, scene, mod.values, key);
    },
    /** Assets drawn on the last rendered frame, with their declared source. */
    assets() {
      const seen = /* @__PURE__ */ new Set();
      return frameNodes.filter((node) => {
        const id = `${node.kind}:${node.name}`;
        if (seen.has(id)) return false;
        seen.add(id);
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
      const scene = timeline2.scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`unknown scene "${sceneId}"`);
      return describeValues(timeline2, scene, byId.get(sceneId)?.values);
    },
    setParam(sceneId, key, value) {
      const scene = timeline2.scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      checkParam(mod?.params, key, value);
      timeline2.params ??= {};
      timeline2.params[sceneId] ??= {};
      timeline2.params[sceneId][key] = value;
      return resolveParam(timeline2, scene, mod.params, key);
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
          (record) => record.lines.map((line2) => ({ ...line2, slot: record.slot, scene: record.sceneId }))
        );
        return [...auditBoxes, ...drawn];
      } finally {
        auditBoxes = null;
      }
    },
    pick(x, y, atT) {
      const scene = sceneAt(atT);
      const entry = mounted2.get(scene.id);
      const hit = entry?.module.hitTest?.(x, y, Math.max(0, atT - scene.start));
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
        if (record.sceneId !== scene.id) continue;
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
      const scene = sceneAt(atT);
      if (scene.id !== sceneId) throw new Error(`t=${atT} is in scene "${scene.id}", not "${sceneId}"`);
      const entry = mounted2.get(sceneId);
      counter.reset();
      active = entry.kind === "canvas2d" ? entry.g : null;
      entry.module.render(Math.max(0, atT - scene.start), entry.ctx);
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
  for (const key of ["width", "height"]) {
    if (!isNum(timeline2[key]) || timeline2[key] <= 0) err(key, `must be a positive number (got ${timeline2[key]})`);
  }
  if (!isNum(timeline2.duration) || timeline2.duration < 0) err("duration", `must be a number (got ${timeline2.duration})`);
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
    err(
      "scenes",
      "this film has no shots yet \u2014 write \u955C\u5934\u8868.md (the look in three lines, then one row per shot: a thing and what it does), then add scenes/<id>.mjs"
    );
  } else {
    const ids = /* @__PURE__ */ new Set();
    const moduleById = new Map((modules ?? []).map((m) => [m.id, m]));
    for (const [i, scene] of timeline2.scenes.entries()) {
      const p = `scenes[${i}]`;
      if (typeof scene.id !== "string" || !scene.id) err(`${p}.id`, "must be a non-empty string");
      else if (ids.has(scene.id)) err(`${p}.id`, `duplicate id "${scene.id}"`);
      else ids.add(scene.id);
      if (typeof scene.name !== "string" || !scene.name) err(`${p}.name`, "must be a non-empty string");
      if (!isNum(scene.start) || scene.start < 0) err(`${p}.start`, "must be >= 0");
      if (!isNum(scene.length) || scene.length <= 0) err(`${p}.length`, "must be > 0");
      if (isNum(scene.start) && isNum(scene.length) && isNum(timeline2.duration) && scene.start + scene.length > timeline2.duration + 1e-6) {
        err(`${p}`, "extends past timeline.duration");
      }
      if (typeof scene.palette !== "string") err(`${p}.palette`, "must be a palette name");
      else if (timeline2.palettes && !(scene.palette in timeline2.palettes)) {
        err(`${p}.palette`, `unknown palette "${scene.palette}"`);
      }
      if (scene.speed !== void 0 && ![0.5, 1, 2].includes(scene.speed)) {
        err(`${p}.speed`, `must be 0.5 | 1 | 2 (got ${scene.speed})`);
      }
      if (modules) {
        const mod = moduleById.get(scene.id);
        if (!mod) {
          err(`${p}.id`, `no scene module registered for "${scene.id}"`);
        } else {
          const slots = mod.slots ?? {};
          const usage = mod.textUsage ?? {};
          for (const [slot, n] of Object.entries(usage)) {
            if (!(slot in slots)) err(`scenes[${i}]`, `textUsage references undeclared slot "${slot}"`);
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
      for (const [sceneId, slots] of Object.entries(timeline2.texts)) {
        const scene = timeline2.scenes?.find((s) => s.id === sceneId);
        if (!scene) {
          err(`texts.${sceneId}`, "unknown scene id");
          continue;
        }
        const mod = modules?.find((m) => m.id === sceneId);
        for (const [slot, value] of Object.entries(slots ?? {})) {
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
      const scene = timeline2.scenes?.find((s) => s.id === sceneId);
      if (!scene) err(`overrides.${key}`, `unknown scene "${sceneId}"`);
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
        const scene = timeline2.scenes?.find((s) => s.id === sceneId);
        if (!scene) {
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
        const scene = timeline2.scenes?.find((s) => s.id === sceneId);
        if (!scene) {
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

// src/scenes/index.mjs
async function loadModules(sceneIds, base = "./scenes") {
  const wanted = [...new Set(sceneIds)];
  const modules = [];
  for (const id of wanted) {
    let mod;
    try {
      mod = await import(`${base}/${encodeURIComponent(id)}.mjs`);
    } catch (cause) {
      throw new Error(`scene "${id}" has no module at scenes/${id}.mjs`, { cause });
    }
    if (mod.id !== id) throw new Error(`scene module scenes/${id}.mjs declares id "${mod.id}"`);
    modules.push(mod);
  }
  return modules;
}

// src/mount.mjs
async function mountMotion({ canvas: canvas2, width, height, dpr: dpr2 = window.devicePixelRatio || 1, scale = 1, base = null }) {
  const requested2 = new URLSearchParams(location.search).get("timeline");
  const filmBase = base ? new URL(base, location.href) : new URL("./", location.href);
  const src = requested2 && /^(\.\/|\/plugins\/dsh-motion\/)/.test(requested2) ? requested2 : new URL("timeline.json", filmBase).href;
  const res = await fetch(src, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) throw Object.assign(new Error("no film in this workspace"), { code: "NO_FILM" });
    throw new Error(`timeline: HTTP ${res.status}`);
  }
  const timeline2 = await res.json();
  try {
    const res2 = await fetch(new URL("out/beats.json", filmBase), { cache: "no-store" });
    if (res2.ok) timeline2.beats = await res2.json();
  } catch {
  }
  const scenesBase = new URL("scenes/", filmBase).href;
  const modules = await loadModules(timeline2.scenes.map((s) => s.id), scenesBase);
  assertTimeline(timeline2, modules);
  await loadFilmFonts(timeline2, base ?? "./");
  const kernel2 = createKernel({ timeline: timeline2, modules });
  await kernel2.mountAll(canvas2, {
    scale,
    width: width ?? timeline2.width,
    height: height ?? timeline2.height,
    dpr: dpr2
  });
  return { timeline: timeline2, kernel: kernel2, modules };
}

// showcase/medium.mjs
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

// showcase/samples.mjs
var LOOP_SECONDS = 6;
var CATEGORIES = ["\u5168\u90E8", "\u6587\u5B57\u6392\u7248", "\u4FE1\u606F\u56FE\u89E3", "\u754C\u9762\u6F14\u793A", "\u573A\u666F\u53D9\u4E8B", "\u80CC\u666F\u7279\u6548"];
var TAU = Math.PI * 2;
var clamp012 = (v) => Math.min(1, Math.max(0, v));
var ease = (v) => {
  const x = clamp012(v);
  return x * x * (3 - 2 * x);
};
var outCubic = (v) => 1 - (1 - clamp012(v)) ** 3;
var span = (t2, from, to) => ease((t2 - from) / (to - from));
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
function veil(g, w, h, t2, look) {
  const fade = 1 - Math.min(1, t2 / 0.45) * Math.min(1, (LOOP_SECONDS - t2) / 0.5);
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
    draw(g, w, h, t2) {
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
      const cam = 1 + t2 / LOOP_SECONDS * 0.06 + Math.sin(t2 * 0.3) * 4e-3;
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
      const leave = span(t2, 4.5, 5.4);
      cards.forEach((card, i) => {
        const enter = outCubic((t2 - 0.3 - i * 0.15) / 0.55);
        const out = 1 - leave;
        const y = h * card.y + leave * h * 0.22;
        if (out <= 0.01) return;
        g.save();
        g.globalAlpha = out;
        glassCard(g, w * card.x, y, cw, ch, card, Math.min(enter, out));
        g.restore();
      });
      const pill = span(t2, 0.1, 0.6);
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
      veil(g, w, h, t2, look);
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
    draw(g, w, h, t2) {
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
      head(w * 0.08, h * 0.09, w * 0.36, "DESCRIPTION", span(t2, 0.1, 0.55));
      head(w * 0.56, h * 0.09, w * 0.36, "MARKING", span(t2, 0.2, 0.65));
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
        const p = span(t2, 0.45 + i * 0.09, 0.8 + i * 0.09);
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
      const catP = span(t2, 0.35, 1.1);
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
      const numP = span(t2, 1.3, 1.7);
      const num = Math.round(941000024681357 * outCubic((t2 - 1.4) / 1.2));
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
        const p = clamp012((t2 - startAt - i * 0.045) / 0.1);
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
      label(g, "MICROCHIP NUMBER", w * 0.56, h * 0.24, Math.max(4.5, h * 0.019), "rgba(61,139,134,0.95)", span(t2, 1.1, 1.5), "0.12em");
      for (let i = 0; i < 5; i++) {
        g.save();
        g.globalAlpha = span(t2, 1.1 + i * 0.04, 1.4 + i * 0.04) * 0.45;
        g.fillStyle = "rgba(29,26,22,0.3)";
        g.fillRect(w * (0.56 + i * 0.032), h * 0.253, w * 0.022, h * 0.014);
        g.restore();
      }
      label(g, "LOCATION", w * 0.56, h * 0.46, Math.max(4.5, h * 0.019), "rgba(61,139,134,0.95)", span(t2, 1.4, 1.8), "0.12em");
      g.save();
      g.globalAlpha = span(t2, 1.5, 1.9);
      g.fillStyle = "#26221b";
      g.font = `400 ${Math.max(6, h * 0.036)}px ${SERIF}`;
      const typed = "Left side of neck";
      const shown = typed.slice(0, Math.round(typed.length * clamp012((t2 - 1.4) / 1.1)));
      g.fillText(shown, w * 0.56, h * 0.505);
      if (shown.length < typed.length && t2 > 1.4) {
        g.fillStyle = "#b4502f";
        g.fillRect(w * 0.56 + g.measureText(shown).width + 1, h * 0.475, Math.max(1, w * 5e-3), h * 0.034);
      }
      g.restore();
      g.save();
      g.globalAlpha = span(t2, 1.6, 2.1);
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
      label(g, "MICROCHIP", w * 0.72, h * 0.74, Math.max(4.5, h * 0.018), "rgba(29,26,22,0.6)", span(t2, 1.8, 2.2), "0.1em");
      const sweep = outCubic((t2 - 0.9) / 0.8);
      g.save();
      g.globalAlpha = span(t2, 0.85, 1.2);
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
      g.globalAlpha = span(t2, 0.95, 1.15) * (1 - span(t2, 2.2, 2.5));
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
    draw(g, w, h, t2) {
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
      const grow = span(t2, 0.25, 2.5);
      const root = { x: w * 0.5, y: h * 0.92 };
      const tips = [];
      const STEP = 0.15;
      const branch = (x, y, angle, len, depth, at) => {
        if (depth <= 0 || len < 1) return;
        const p = clamp012((grow - at) / STEP);
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
      const leaf = span(t2, 1.9, 3.4);
      for (let i = 0; i < tips.length; i++) {
        const p = clamp012((leaf - i * 6e-3) * 2.6);
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
      veil(g, w, h, t2, this.look);
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
    draw(g, w, h, t2) {
      const look = this.look;
      ground(g, w, h, look);
      const glow = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.72);
      glow.addColorStop(0, "rgba(86, 122, 255, 0.12)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);
      const push = 0.94 + 0.06 * outCubic(t2 / 2.4);
      const climb = 1 - outCubic(t2 / LOOP_SECONDS);
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
      label(g, "MODEL SCORE", w * 0.12, h * 0.17, Math.max(5, h * 0.028), "rgba(236,236,234,0.4)", span(t2, 0.1, 0.6), "0.26em");
      g.save();
      g.globalAlpha = span(t2, 0.3, 0.9);
      g.fillStyle = "#7ee787";
      g.beginPath();
      g.arc(w * 0.84, h * 0.16, Math.max(1.4, h * 6e-3), 0, TAU);
      g.fill();
      g.restore();
      label(g, "LIVE", w * 0.86, h * 0.17, Math.max(4.5, h * 0.024), "rgba(126,231,135,0.75)", span(t2, 0.3, 0.9), "0.2em");
      const rows = [
        { rank: "01", name: "Anthropic", score: "1496" },
        { rank: "02", name: "Alibaba", score: "1486" },
        { rank: "03", name: "Google", score: "1485" },
        { rank: "04", name: "Moonshot", score: "1483" }
      ];
      const x = w * 0.13;
      const rw = w * 0.74;
      const rh = h * 0.165;
      const swap = span(t2, 2.1, 3);
      rows.forEach((row, i) => {
        const p = outCubic((t2 - 0.15 - i * 0.09) / 0.5);
        const base = h * 0.24 + i * rh;
        let y = base;
        if (i === 0) y = base + swap * rh;
        if (i === 1) y = base - swap * rh;
        const lead = i === 0 && swap < 0.5 || i === 1 && swap >= 0.5;
        const rank = i === 0 ? swap >= 0.5 ? "02" : "01" : i === 1 ? swap >= 0.5 ? "01" : "02" : row.rank;
        const nudge = i < 2 ? (1 - Math.abs(swap - 0.5) * 2) * w * 0.04 * (i === 0 ? 1 : -1) : 0;
        boardRow(g, x + nudge, y, rw, rh, { ...row, rank }, p, lead);
      });
      const scan = t2 * 0.22 % 1 * 0.84 + 0.08;
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
      veil(g, w, h, t2, look);
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
    draw(g, w, h, t2) {
      const look = this.look;
      ground(g, w, h, look);
      const pad = w * 0.08;
      label(g, "01 \u2014 KINETIC TYPE", pad, h * 0.16, h * 0.032, look.dim, span(t2, 0.15, 0.7), "0.28em");
      const words = ["MAKE", "IT", "MOVE"];
      const size = h * 0.235;
      words.forEach((word, i) => {
        const p = outCubic((t2 - 0.25 - i * 0.22) / 0.7);
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
      line(g, pad, h * 0.92, (w - pad * 2) * 0.34, look.ink, (t2 - 1.4) / 0.9);
      veil(g, w, h, t2, look);
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
    draw(g, w, h, t2) {
      const look = this.look;
      ground(g, w, h, look);
      const drift = Math.sin(t2 * 0.18) * w * 6e-3;
      const cx = w * 0.63 + drift;
      const cy = h * 0.53;
      const r = Math.min(h * 0.3, w * 0.19);
      const moonT = clamp012(t2 / LOOP_SECONDS);
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
        const tw = 0.55 + 0.45 * Math.sin(t2 * (0.8 + depth) + i);
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
      veil(g, w, h, t2, look);
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
    draw(g, w, h, t2) {
      const look = this.look;
      const ink = [42, 33, 24];
      paper(g, w, h, { base: [238, 227, 203], seed: 11, mottle: 18, grain: 10 });
      const cx = w * 0.6 + Math.sin(t2 * 0.22) * w * 5e-3;
      const cy = h * 0.44;
      const R = Math.min(w * 0.19, h * 0.19);
      const rot = 0.15 + Math.sin(t2 * 0.45) * 0.075;
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
        const wob = Math.sin(t2 * 0.5 + i * 1.3) * R * 0.012;
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
      label(g, "PLATE III \u2014 DISPERSION", w * 0.085, h * 0.935, h * 0.022, "rgba(42,33,24,0.62)", span(t2, 0.3, 1), "0.22em");
      bleed(g, w, h, { color: ink, amount: 0.1 });
      veil(g, w, h, t2, look);
    }
  }
];

// showcase/look.mjs
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
function finish(g, w, h, t2, look = {}) {
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
  const tile = tiles[Math.floor(Math.abs(t2) * 24) % tiles.length];
  const off = Math.abs(t2) * 37 % GRAIN;
  g.save();
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = dark ? 0.16 : 0.09;
  for (let y = -GRAIN - off * 0.6; y < h; y += GRAIN) {
    for (let x = -GRAIN - off; x < w; x += GRAIN) g.drawImage(tile, x, y);
  }
  g.restore();
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
  const deliver = ({ id, anchor, text }) => new Promise((resolve) => {
    if (!embedded) {
      resolve({ ok: false, reason: "\u6CA1\u6709\u4F1A\u8BDD" });
      return;
    }
    const timer = setTimeout(() => {
      pendingAcks.delete(id);
      resolve({ ok: false, reason: "\u4F1A\u8BDD\u6CA1\u6709\u56DE\u5E94" });
    }, 1e4);
    pendingAcks.set(id, (data) => {
      clearTimeout(timer);
      pendingAcks.delete(id);
      resolve(data.ok ? { ok: true } : { ok: false, reason: data.error ?? "\u5931\u8D25" });
    });
    window.parent.postMessage(
      { type: "dshm:comment", id, session, text: messageFor({ anchor, text }) },
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
    const id = `th_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const sent = await deliver({ id, anchor, text: trimmed });
    if (!sent.ok) throw new Error(`\u6CA1\u6709\u9001\u5230\u5BF9\u8BDD\uFF1A${sent.reason}`);
    const res = await fetch("./api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, anchor, text: trimmed, sentAt: (/* @__PURE__ */ new Date()).toISOString() })
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
var escapeHtml2 = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var $ = (id) => document.getElementById(id);
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
var params = new URLSearchParams(location.search);
var requested = params.get("timeline");
var sessionId = params.get("session") ?? (() => {
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
function showEmptyFilm({ building: isBuilding = false } = {}) {
  document.querySelector(".app")?.remove();
  document.querySelector(".timeline")?.remove();
  document.body.dataset.building = String(isBuilding);
  if (isBuilding) {
    const chip = document.createElement("div");
    chip.className = "building-chip";
    chip.textContent = "\u6B63\u5728\u5236\u4F5C";
    document.body.append(chip);
  }
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
    const next = await filmStatus();
    if (!next?.version) return;
    if (next.version.id !== mountedVersion) {
      clearInterval(timer);
      location.reload();
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
function playOne(canvas2, sample) {
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
  const measure = () => {
    for (const item of items) {
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
      if (!item.w) continue;
      item.g.clearRect(0, 0, item.w, item.h);
      item.sample.draw(item.g, item.w, item.h, t2);
      finish(item.g, item.w, item.h, t2, item.sample.look);
    }
  };
  measure();
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
async function filmStatus() {
  try {
    const res = await fetch("./api/film/status", { cache: "no-store" });
    if (res.ok) return await res.json();
  } catch {
  }
  return null;
}
var status = await filmStatus();
var building = status?.state === "building" && !status.stale;
var mountedVersion = status?.version?.id ?? null;
if (status && !status.version && status.state !== "ready") {
  showEmptyFilm({ building: status.state === "building" });
  await new Promise(() => {
  });
}
var mounted;
try {
  mounted = await mountMotion({
    canvas,
    dpr,
    scale: await previewScale(),
    base: mountedVersion ? `./api/version/${mountedVersion}/` : null
  });
} catch (error) {
  if (error?.code !== "NO_FILM") throw error;
  showEmptyFilm({ building });
  await new Promise(() => {
  });
}
var { kernel } = mounted;
if (building) {
  document.body.dataset.building = "true";
  const chip = document.createElement("div");
  chip.className = "building-chip";
  chip.textContent = "\u5236\u4F5C\u4E2D \xB7 \u663E\u793A v" + (mountedVersion ?? "").replace("v", "");
  chip.title = "Agent \u6B63\u5728\u6539\u5DE5\u4F5C\u533A\uFF1B\u8FD9\u91CC\u653E\u7684\u662F\u4E0A\u4E00\u6B21\u53D1\u5E03\u7684\u7248\u672C\uFF0C\u53EA\u8BFB";
  document.body.append(chip);
}
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
  const label2 = beatPeek.querySelector(".beat-peek-label");
  img.src = `./${still}`;
  label2.textContent = `${el.dataset.beat ?? ""} ${el.querySelector(".len")?.textContent ?? ""}`.trim();
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
      const scene = scenes[i];
      el.style.flexGrow = String(scene.length);
      el.querySelector(".chip-label").innerHTML = `${escapeHtml2(scene.name)} <span class="len">\xB7 ${scene.length.toFixed(1)}s</span>`;
      el.dataset.scene = scene.id;
      chips[i].scene = scene;
    });
    applyStills();
    loadBeatStills();
    return;
  }
  for (const { el } of chips) el.remove();
  chips = scenes.map((scene) => {
    const el = document.createElement("div");
    el.className = "chip";
    el.dataset.scene = scene.id;
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.style.flexGrow = String(scene.length);
    el.style.flexBasis = "0";
    el.innerHTML = `<span class="chip-label">${escapeHtml2(scene.name)} <span class="len">\xB7 ${scene.length.toFixed(1)}s</span></span>
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
      const now = timeline.scenes.find((s) => s.id === el.dataset.scene) ?? scene;
      openChipMenu(now, el);
    });
    scenesEl.insertBefore(el, playhead);
    return { el, scene };
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
  scenes.forEach((scene, i) => {
    const seg = document.createElement("button");
    seg.type = "button";
    seg.className = "reel-seg";
    seg.dataset.seg = scene.id;
    seg.title = scene.name;
    seg.setAttribute("aria-label", scene.name);
    seg.addEventListener("click", () => {
      seekTo(scene.start + 1e-3);
    });
    track.append(seg);
    reel.push({ seg, scene });
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
function openChipMenu(scene, chipEl) {
  hoverFrame.hidden = true;
  hoverAt = -1;
  chipMenu.innerHTML = `
    <p class="chip-menu-name">${escapeHtml2(scene.name)}</p>
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
        body: body({ scene: scene.id, delete: true })
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
  const scene = currentScene(t);
  sceneName.textContent = scene.name;
  const reelIndex = timeline.scenes.findIndex((s) => s.id === scene.id);
  if (reelEl.dataset.index !== String(reelIndex)) {
    reelEl.dataset.index = String(reelIndex);
    reelEl.firstChild.textContent = `${reelIndex + 1} / ${timeline.scenes.length} \u6BB5`;
    for (const { seg, scene: s } of reel) seg.classList.toggle("done", s.start <= t);
  }
  for (const { el, scene: s } of chips) {
    el.setAttribute("aria-current", String(s.id === scene.id));
    if (s.id === scene.id) el.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  refreshSelection();
  comments.refreshAnchors();
  buildKnobs(scene);
  buildScene(scene);
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
  let wrapped = false;
  if (next >= total) {
    if (looping) {
      next = 0;
      wrapped = true;
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
  if (wrapped) soundPlay();
  if (playing) raf = requestAnimationFrame(tick);
}
var audioOffset = Number(timeline.audio?.start ?? 0);
var sound = timeline.audio?.src ? new Audio(new URL(timeline.audio.src, location.href).href) : null;
if (sound) {
  sound.preload = "auto";
  sound.id = "score";
  document.body.append(sound);
}
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
      const id = button.dataset.id;
      if (id === current?.id) {
        versionMenu.open = false;
        return;
      }
      button.disabled = true;
      try {
        const res = await fetch("./api/versions/use", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body({ id })
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
      const scene = timeline.scenes.find((sc) => t2 >= sc.start && t2 < sc.start + sc.length) ?? timeline.scenes.at(-1);
      if (!scene) continue;
      if (!groups.has(scene.id)) groups.set(scene.id, { scene, rows: [] });
      groups.get(scene.id).rows.push(thread);
    }
    allComments.innerHTML = [...groups.values()].sort((a, b) => a.scene.start - b.scene.start).map(
      ({ scene, rows }) => `
        <section class="comment-group">
          <h3>${escapeHtml2(scene.name)}<span>${rows.length}</span></h3>
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
  for (const scene of timeline.scenes) {
    scene.palette = name || authoredPalette.get(scene.id) || "main";
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
        <input class="token-hex" data-token="${token}" value="${escapeHtml2(value)}" maxlength="7" spellcheck="false" />
        <input class="token-color" data-token="${token}" type="color" value="${escapeHtml2(value)}" />
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
  const scene = currentScene(t);
  try {
    const res = await fetch("./api/scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ scene: scene.id, ...patch })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    const latest = await (await fetch(timelineSrc, { cache: "no-store" })).json();
    kernel.reload(latest);
    adoptTimeline(kernel.timeline ?? latest);
    sceneNote.textContent = `\u5DF2\u4FDD\u5B58 \xB7 \u603B\u65F6\u957F ${data.duration}s`;
  } catch (err) {
    sceneNote.textContent = `\u4FDD\u5B58\u5931\u8D25\uFF1A${err.message}`;
    syncSceneFields(scene);
  }
}
function syncSceneFields(scene) {
  const sceneIndex = timeline.scenes.findIndex((s) => s.id === scene.id) + 1;
  sceneCardName.textContent = `${sceneIndex} / ${timeline.scenes.length}`;
  if (document.activeElement !== sceneNameInput) sceneNameInput.value = scene.name;
  sceneLen.value = String(scene.length);
  sceneSpeed.value = String(scene.speed ?? 1);
}
function buildScene(scene) {
  if (sceneKey === scene.id) return;
  sceneKey = scene.id;
  syncSceneFields(scene);
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
  const scene = currentScene(t);
  const name = sceneNameInput.value.trim();
  if (!name || name === scene.name) {
    sceneNameInput.value = scene.name;
    return;
  }
  try {
    const res = await fetch("./api/scene", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ scene: scene.id, name })
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
      const line2 = document.createElement("div");
      line2.className = "asset-line";
      const input = document.createElement("input");
      input.value = item.src;
      input.disabled = !item.editable && !item.rebakeable;
      input.dataset.assetName = item.name;
      input.addEventListener("focus", () => highlightRect(item.box));
      input.addEventListener("blur", () => highlightRect(null));
      if (item.editable) input.addEventListener("change", () => persistAsset(item.name, input.value));
      line2.append(input);
      if (item.rebakeable) {
        const bake = document.createElement("button");
        bake.className = "btn ghost";
        bake.textContent = "\u91CD\u70D8";
        bake.dataset.bake = item.name;
        bake.addEventListener("click", () => persistRebake(item.name, input.value));
        line2.append(bake);
      }
      row.append(name, line2);
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
function buildKnobs(scene, { force = false } = {}) {
  if (!force && knobOwner === scene.id) return;
  knobOwner = scene.id;
  const rows = kernel.describe().scenes.find((s) => s.id === scene.id)?.params ?? [];
  knobList.replaceChildren();
  knobsEl.hidden = rows.length === 0;
  knobScene.textContent = scene.name;
  for (const row of rows) {
    const label2 = document.createElement("label");
    label2.className = "knob";
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
      kernel.setParam(scene.id, row.key, value);
      kernel.renderAt(t);
      knobNote.textContent = "\u672A\u4FDD\u5B58";
    });
    input.addEventListener("change", () => persistParam(scene.id, row.key, Number(input.value)));
    label2.append(head, input);
    knobList.append(label2);
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
  setParam: async (scene, key, value, persist = true) => {
    kernel.setParam(scene, key, value);
    kernel.renderAt(t);
    buildKnobs(currentScene(t), { force: true });
    if (persist) await persistParam(scene, key, value);
    return value;
  },
  history: async () => (await (await fetch("./api/history")).json()).snapshots,
  undo: async () => {
    const { snapshots } = await (await fetch("./api/history")).json();
    const id = snapshots[0]?.id;
    if (!id) return;
    const res = await fetch("./api/history/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body({ id })
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
{
  const poster = Math.min(Number(timeline.poster) || 0, Math.max(0, total - 0.05));
  if (poster > 0) seekTo(poster);
}
