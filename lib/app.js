import {
  __export
} from "./chunks/chunk.js";

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
function resolveText(timeline2, scene3, slots3, slot) {
  const stored = timeline2.texts?.[scene3.id]?.[slot];
  if (typeof stored === "string") return stored;
  const spec = slots3?.[slot];
  if (spec && typeof spec.default === "string") return spec.default;
  console.warn(`[motion] slot "${slot}" missing in scene "${scene3.id}"`);
  return "";
}
function setText(timeline2, scene3, slots3, slot, value) {
  if (!slots3 || !(slot in slots3)) {
    throw new Error(
      `unknown slot "${slot}" for scene "${scene3.id}"; available: ${Object.keys(slots3 ?? {}).join(", ") || "(none)"}`
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
  const mounted = /* @__PURE__ */ new Map();
  const counter = makeCounter();
  const warnings = [];
  let canvas2 = null;
  let surface = null;
  let auditBoxes = null;
  let width = timeline2.width ?? 1920;
  let height = timeline2.height ?? 1080;
  let dpr2 = 1;
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
    return {
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
      color(token, elementId) {
        return color(scene3, token, elementId);
      },
      colorNumber(token, elementId) {
        const hex = color(scene3, token, elementId);
        return parseInt(hex.replace("#", ""), 16);
      },
      font(family) {
        const stacks = {
          serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
          sans: 'Inter, "Helvetica Neue", Arial, sans-serif',
          mono: 'ui-monospace, "SF Mono", Menlo, monospace'
        };
        return stacks[family] ?? family;
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
    canvas2.width = Math.round(width * dpr2);
    canvas2.height = Math.round(height * dpr2);
    surface = canvas2.getContext("2d", { colorSpace: "srgb" });
    const instrument = (g) => {
      if (!g || g.__dshMotionAudited) return g;
      const original = g.fillText.bind(g);
      g.fillText = (text, x, y, ...rest) => {
        if (auditBoxes) {
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
      const kind3 = mod.kind === "auto" || !mod.kind ? "canvas2d" : mod.kind;
      const g = kind3 === "canvas2d" ? instrument(sc.getContext("2d", { colorSpace: "srgb" })) : null;
      const entry = { module: mod, kind: kind3, canvas: sc, g, ctx: null };
      entry.ctx = makeCtx(scene3, entry);
      await mod.mount?.(entry.ctx);
      mounted.set(scene3.id, entry);
    }
  }
  function renderAt(t2) {
    const scene3 = sceneAt(t2);
    const entry = mounted.get(scene3.id);
    if (!entry) throw new Error(`scene "${scene3.id}" is not mounted`);
    counter.reset();
    if (entry.kind === "canvas2d") {
      entry.g.setTransform(dpr2, 0, 0, dpr2, 0, 0);
      entry.g.clearRect(0, 0, width, height);
    }
    entry.module.render(Math.max(0, t2 - scene3.start), entry.ctx);
    lastTime = t2;
    surface.setTransform(1, 0, 0, 1, 0, 0);
    surface.clearRect(0, 0, canvas2.width, canvas2.height);
    surface.drawImage(entry.canvas, 0, 0, canvas2.width, canvas2.height);
    if (entry.module.overlay) {
      surface.setTransform(dpr2, 0, 0, dpr2, 0, 0);
      entry.module.overlay(surface, entry.ctx, Math.max(0, t2 - scene3.start));
    }
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
        return auditBoxes;
      } finally {
        auditBoxes = null;
      }
    },
    pick(x, y, atT) {
      const scene3 = sceneAt(atT);
      const entry = mounted.get(scene3.id);
      if (!entry?.module.hitTest) return null;
      return entry.module.hitTest(x, y, Math.max(0, atT - scene3.start));
    },
    textUsage(sceneId, atT) {
      const scene3 = sceneAt(atT);
      if (scene3.id !== sceneId) throw new Error(`t=${atT} is in scene "${scene3.id}", not "${sceneId}"`);
      const entry = mounted.get(sceneId);
      counter.reset();
      entry.module.render(Math.max(0, atT - scene3.start), entry.ctx);
      return counter.snapshot();
    }
  };
}

// src/validate.mjs
var HEX = /^#[0-9a-f]{6}$/i;
var REQUIRED_TOKENS = ["bg", "fg", "accent", "muted", "grid", "panel"];
var FITS = ["trim", "loop", "pad"];
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
          const slots3 = mod.slots ?? {};
          const usage = mod.textUsage ?? {};
          for (const [slot, n] of Object.entries(usage)) {
            if (!(slot in slots3)) err(`scenes[${i}]`, `textUsage references undeclared slot "${slot}"`);
            if (!Number.isInteger(n) || n < 1) err(`scenes[${i}]`, `textUsage.${slot} must be a positive integer`);
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
      for (const [sceneId, slots3] of Object.entries(timeline2.texts)) {
        const scene3 = timeline2.scenes?.find((s) => s.id === sceneId);
        if (!scene3) {
          err(`texts.${sceneId}`, "unknown scene id");
          continue;
        }
        const mod = modules?.find((m) => m.id === sceneId);
        for (const [slot, value] of Object.entries(slots3 ?? {})) {
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
var clamp01 = (x) => Math.min(1, Math.max(0, x));
function makeHistoryScene(config) {
  const { id: id3, slots: slots3, textUsage: textUsage3, ticks, pins, palette: _palette } = config;
  let ctx = null;
  function mount3(context) {
    ctx = context;
  }
  function render3(t2) {
    const g = ctx.canvas.getContext("2d");
    const W = ctx.width;
    const H = ctx.height;
    const bg = ctx.color("bg");
    const fg = ctx.color("fg");
    const accent = ctx.color("accent");
    const muted = ctx.color("muted");
    const grid = ctx.color("grid");
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
    const capA = 1;
    g.globalAlpha = capA;
    g.fillStyle = muted;
    g.font = `600 ${Math.round(H * 0.018)}px ${ctx.font("sans")}`;
    g.fillText(ctx.text("era").toUpperCase(), W * 0.08, H * 0.16);
    g.globalAlpha = 1;
    const titleA = 1;
    g.save();
    g.globalAlpha = titleA;
    g.translate(0, (1 - titleA) * H * 0.06);
    g.fillStyle = fg;
    g.font = `500 ${Math.round(H * 0.072)}px ${ctx.font("serif")}`;
    g.fillText(ctx.text("title"), W * 0.08, H * 0.26);
    g.restore();
    const subA = easeOut((t2 - 0.25) / 0.45);
    g.globalAlpha = subA;
    g.fillStyle = muted;
    g.font = `${Math.round(H * 0.026)}px ${ctx.font("sans")}`;
    g.fillText(ctx.text("subtitle"), W * 0.08, H * 0.325);
    g.globalAlpha = 1;
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
    g.font = `${Math.round(H * 0.016)}px ${ctx.font("mono")}`;
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
    const stemFor = (pin) => axisY - H * (0.14 + pin.lane * 0.135) + cardH;
    for (const pin of placed) {
      const appear = easeOutBack((t2 - pin.tIn) / 0.32);
      if (appear <= 0) continue;
      const pinColor = ctx.color("accent", pin.elementId);
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
      const appear = easeOutBack((t2 - pin.tIn) / 0.32);
      if (appear <= 0) continue;
      const pinColor = ctx.color("accent", pin.elementId);
      const cardY = axisY - H * (0.14 + pin.lane * 0.135);
      g.save();
      g.globalAlpha = appear * axisA;
      g.translate(0, (1 - appear) * H * 0.07);
      g.fillStyle = ctx.color("panel");
      g.strokeStyle = pinColor;
      g.lineWidth = 1.5;
      roundRect(g, pin.cx, cardY, cardW, cardH, 10);
      g.fill();
      g.stroke();
      g.fillStyle = pinColor;
      g.font = `600 ${Math.round(H * 0.017)}px ${ctx.font("mono")}`;
      g.fillText(pin.eraText, pin.cx + 18, cardY + H * 0.032);
      g.fillStyle = fg;
      g.font = `600 ${Math.round(H * 0.0205)}px ${ctx.font("sans")}`;
      wrapText(g, pin.noteText, pin.cx + 18, cardY + H * 0.07, cardW - 36, H * 0.027, 2);
      g.restore();
    }
    g.globalAlpha = 1;
    const beatGrid = ctx.beats ?? [];
    let pulse = 0;
    if (beatGrid.length) {
      const globalT = t2 + (ctx.sceneStart ?? 0);
      let nearest = Infinity;
      for (const bt of beatGrid) nearest = Math.min(nearest, Math.abs(bt - globalT));
      pulse = Math.exp(-Math.pow(nearest / 0.1, 2));
    }
    g.fillStyle = accent;
    g.globalAlpha = 0.9;
    g.fillRect(0, H - (6 + pulse * 6), W * clamp01(t2 / 15), 6 + pulse * 6);
    g.globalAlpha = 1;
    void _palette;
  }
  function layoutPins(W, H) {
    const axisY = H * 0.68;
    const x0 = W * 0.08;
    const x1 = W * 0.92;
    const cardW = W * 0.3;
    const cardH = H * 0.118;
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
      placed.push({ ...pin, px, cx, lane });
    }
    return { axisY, x0, x1, cardW, cardH, placed };
  }
  function hitTest3(x, y, t2) {
    const { axisY, cardW, cardH, placed } = layoutPins(ctx.width, ctx.height);
    for (const pin of placed) {
      if (t2 < pin.tIn) continue;
      const cardY = axisY - ctx.height * (0.14 + pin.lane * 0.135);
      if (x >= pin.cx && x <= pin.cx + cardW && y >= cardY && y <= cardY + cardH) {
        return {
          id: pin.elementId ? `pin-${pin.elementId}` : `pin-${pin.eraText}`,
          kind: "pin",
          x: Math.round(pin.cx),
          y: Math.round(cardY),
          w: Math.round(cardW),
          h: Math.round(cardH),
          label: pin.eraText,
          at: Number(t2.toFixed(2))
        };
      }
    }
    return null;
  }
  return { id: id3, kind: "canvas2d", slots: slots3, textUsage: textUsage3, mount: mount3, render: render3, hitTest: hitTest3 };
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
function wrapText(g, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text).split(" ");
  let line = "";
  let row = 0;
  const lines = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let last2 = shown[maxLines - 1];
    while (last2.length > 1 && g.measureText(`${last2}\u2026`).width > maxWidth) last2 = last2.slice(0, -1);
    shown[maxLines - 1] = `${last2}\u2026`;
  }
  for (const [i, l] of shown.entries()) {
    g.fillText(l, x, y + i * lineHeight);
    void row;
  }
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
    { at: 0.3, tIn: 1.8, eraText: "c. 13,000 BCE", noteText: "First people arrive from Siberia" },
    { at: 0.52, tIn: 3.4, eraText: "c. 11,000 BCE", noteText: "Clovis culture spreads across the Americas" }
  ]
});
var { id, kind, slots, textUsage, mount, render, hitTest } = scene;

// src/scenes/cold-war.mjs
var cold_war_exports = {};
__export(cold_war_exports, {
  hitTest: () => hitTest2,
  id: () => id2,
  kind: () => kind2,
  mount: () => mount2,
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
    { at: 0.62, tIn: 1.5, eraText: "1969", noteText: "People walk on the Moon" },
    { at: 0.8, tIn: 2.4, eraText: "1975", noteText: "Out of Vietnam" }
  ]
});
var { id: id2, kind: kind2, slots: slots2, textUsage: textUsage2, mount: mount2, render: render2, hitTest: hitTest2 } = scene2;

// src/scenes/index.mjs
var STATIC = [first_peoples_exports, cold_war_exports];
var LAZY = {
  orbit: () => import("./chunks/orbit.js")
};
async function loadModules(sceneIds) {
  const wanted = new Set(sceneIds);
  const modules = STATIC.filter((m) => wanted.has(m.id));
  for (const id3 of wanted) {
    if (!LAZY[id3]) continue;
    modules.push(await LAZY[id3]());
  }
  return modules;
}

// src/mount.mjs
async function mountMotion({ canvas: canvas2, width, height, dpr: dpr2 = window.devicePixelRatio || 1 }) {
  const requested = new URLSearchParams(location.search).get("timeline");
  const src = requested && /^(\.\/|\/plugins\/dsh-motion\/)/.test(requested) ? requested : "./timeline.json";
  const timeline2 = await (await fetch(src)).json();
  try {
    const res = await fetch("./out/beats.json");
    if (res.ok) timeline2.beats = await res.json();
  } catch {
  }
  const modules = await loadModules(timeline2.scenes.map((s) => s.id));
  assertTimeline(timeline2, modules);
  const kernel2 = createKernel({ timeline: timeline2, modules });
  await kernel2.mountAll(canvas2, {
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
  popSend: popSend2,
  popSubmit: popSubmit2,
  popClose: popClose2,
  threadsEl: threadsEl2,
  threadCount: threadCount2,
  timeline: timeline2,
  kernel: kernel2,
  fmt: fmt2,
  getTime,
  onSeek,
  onClearSelection,
  onError
}) {
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
  popClose2.addEventListener("click", () => {
    popover2.hidden = true;
    pending = null;
    selection2.hidden = true;
  });
  popSubmit2.addEventListener("click", async () => {
    if (!pending) return;
    const text = popText2.value.trim();
    if (!text) {
      popText2.focus();
      return;
    }
    const center = { x: pending.rect.x + pending.rect.w / 2, y: pending.rect.y + pending.rect.h / 2 };
    const hit = kernel2.pick(center.x, center.y, pending.t);
    const res = await fetch("./api/comments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        anchor: { t: pending.t, rect: pending.rect, elementId: hit?.id ?? null },
        text,
        activated: popSend2.checked
      })
    });
    if (!res.ok) {
      onError(`\u6279\u6CE8\u4FDD\u5B58\u5931\u8D25\uFF1A${escapeHtml((await res.json()).error ?? res.status)}`);
      return;
    }
    popover2.hidden = true;
    pending = null;
    selection2.hidden = true;
    await refreshThreads();
  });
  async function refreshThreads() {
    try {
      const data = await (await fetch("./api/comments")).json();
      const threads = data.threads ?? [];
      threadCount2.textContent = String(threads.length);
      if (!threads.length) {
        threadsEl2.innerHTML = '<p class="hint">\u5728\u753B\u9762\u4E0A\u62D6\u51FA\u4E00\u4E2A\u6846\uFF0C\u5199\u4E0B\u8981\u6539\u4EC0\u4E48\u3002</p>';
        return;
      }
      threadsEl2.innerHTML = threads.map(
        (th) => `
        <div class="thread" data-id="${th.id}" data-t="${th.anchor.t}">
          <div class="meta"><span>${fmt2(th.anchor.t)}</span><span class="badge ${th.status}">${th.status}</span></div>
          <div class="text">${escapeHtml(th.messages[0]?.text ?? "")}</div>
        </div>`
      ).join("");
      for (const el of threadsEl2.querySelectorAll(".thread")) {
        el.addEventListener("click", () => onSeek(Number(el.dataset.t)));
      }
    } catch {
    }
  }
  return {
    refreshThreads,
    consumeSuppress() {
      const value = suppressClick;
      suppressClick = false;
      return value;
    }
  };
}

// src/preview.mjs
var $ = (id3) => document.getElementById(id3);
var canvas = $("stage");
var box = $("canvasBox");
var selection = $("selection");
var inspector = $("inspector");
var tc = $("tc");
var durEl = $("dur");
var scrub = $("scrub");
var playBtn = $("play");
var loopBtn = $("loop");
var scenesEl = $("scenes");
var playhead = $("playhead");
var sceneName = $("sceneName");
var modeEl = $("mode");
var popover = $("popover");
var popT = $("popT");
var popText = $("popText");
var popSend = $("popSend");
var popSubmit = $("popSubmit");
var popClose = $("popClose");
var threadsEl = $("threads");
var threadCount = $("threadCount");
var dpr = Math.min(2, window.devicePixelRatio || 1);
var { timeline, kernel } = await mountMotion({ canvas, dpr });
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
var chips = timeline.scenes.map((scene3) => {
  const el = document.createElement("button");
  el.className = "chip";
  el.dataset.scene = scene3.id;
  el.style.flexGrow = String(scene3.length);
  el.style.flexBasis = "0";
  el.innerHTML = `${scene3.name} <span class="len">\xB7 ${scene3.length.toFixed(1)}s</span>`;
  el.addEventListener("click", () => {
    setTime(scene3.start + 1e-3);
    renderFrame();
  });
  scenesEl.insertBefore(el, playhead);
  return { el, scene: scene3 };
});
function currentScene(at) {
  return timeline.scenes.find((s) => at >= s.start && at < s.start + s.length) ?? timeline.scenes.at(-1);
}
function setTime(next) {
  t = Math.max(0, Math.min(total - 1e-3, next));
  scrub.value = String(t);
  tc.textContent = fmt(t);
  playhead.style.left = `${t / total * 100}%`;
  const scene3 = currentScene(t);
  sceneName.textContent = scene3.name;
  for (const { el, scene: s } of chips) el.setAttribute("aria-current", String(s.id === scene3.id));
  refreshSelection();
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
    inspector.innerHTML = '<p class="hint">\u8BE5\u65F6\u523B\u8FD9\u4E2A\u5143\u7D20\u4E0D\u53EF\u89C1\u3002\u518D\u70B9\u4E00\u6B21\u753B\u9762\u91CC\u7684\u5143\u7D20\u8BD5\u8BD5\u3002</p>';
    return;
  }
  selected = hit;
  showSelection(hit);
  inspector.innerHTML = `
    <div class="row"><span>id</span><strong>${hit.id}</strong></div>
    <div class="row"><span>t</span><span>${hit.at.toFixed(2)}s</span></div>
    <div class="row"><span>x / y</span><span>${hit.x} , ${hit.y}</span></div>
    <div class="row"><span>w \xD7 h</span><span>${hit.w} \xD7 ${hit.h}</span></div>
    <div class="row"><span>label</span><span>${hit.label ?? "\u2014"}</span></div>`;
}
function renderFrame() {
  kernel.renderAt(t);
  setTime(t);
}
function tick(now) {
  if (!playing) return;
  if (!last) last = now;
  const dt = Math.min(0.1, (now - last) / 1e3);
  last = now;
  let next = t + dt;
  if (next >= total) {
    if (looping) next = 0;
    else {
      next = total - 1e-3;
      playing = false;
      updatePlayButton();
    }
  }
  t = next;
  kernel.renderAt(t);
  setTime(t);
  if (playing) raf = requestAnimationFrame(tick);
}
function updatePlayButton() {
  playBtn.textContent = playing ? "\u23F8" : "\u25B6";
  modeEl.textContent = playing ? "playing" : "paused";
}
playBtn.addEventListener("click", () => {
  playing = !playing;
  last = 0;
  updatePlayButton();
  if (playing) raf = requestAnimationFrame(tick);
  else cancelAnimationFrame(raf);
});
loopBtn.addEventListener("click", () => {
  looping = !looping;
  loopBtn.setAttribute("aria-pressed", String(looping));
});
scrub.max = String(total);
scrub.addEventListener("input", () => {
  t = Number(scrub.value);
  kernel.renderAt(t);
  setTime(t);
});
var comments = createComments({
  canvas,
  box,
  selection,
  popover,
  popT,
  popText,
  popSend,
  popSubmit,
  popClose,
  threadsEl,
  threadCount,
  timeline,
  kernel,
  fmt,
  getTime: () => t,
  onSeek: (next) => {
    setTime(next);
    renderFrame();
  },
  onClearSelection: () => {
    selected = null;
  },
  onError: (message) => {
    inspector.innerHTML = `<p class="hint">${message}</p>`;
  }
});
canvas.addEventListener("click", (e) => {
  if (comments.consumeSuppress()) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * timeline.width;
  const y = (e.clientY - rect.top) / rect.height * timeline.height;
  const hit = kernel.pick(x, y, t);
  if (!hit) {
    selected = null;
    selection.hidden = true;
    inspector.innerHTML = '<p class="hint">\u8FD9\u91CC\u6CA1\u6709\u5143\u7D20\u3002\u70B9\u5361\u7247\u6216\u65F6\u95F4\u8F74\u4E0A\u7684\u5706\u70B9\u3002</p>';
    return;
  }
  selected = hit;
  refreshSelection();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    playBtn.click();
  } else if (e.code === "ArrowRight") {
    setTime(t + 1 / (timeline.fps ?? 30));
    renderFrame();
  } else if (e.code === "ArrowLeft") {
    setTime(t - 1 / (timeline.fps ?? 30));
    renderFrame();
  }
});
durEl.textContent = fmt(total);
scrub.max = String(total);
updatePlayButton();
renderFrame();
comments.refreshThreads();
window.__PREVIEW__ = {
  ready: true,
  time: () => t,
  setTime: (v) => {
    setTime(v);
    renderFrame();
  },
  selected: () => selected,
  audit: (t2) => kernel.audit(t2),
  play: () => playBtn.click(),
  scenes: timeline.scenes.map((s) => ({ id: s.id, start: s.start, length: s.length })),
  duration: total,
  boxRect: () => box.getBoundingClientRect(),
  comments: async () => (await (await fetch("./api/comments")).json()).threads,
  pixel: (x, y) => {
    const g = kernel.surface;
    const scale = g.canvas.width / timeline.width;
    const d = g.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }
};
