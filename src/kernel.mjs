// The kernel: owns the timeline, mounts scenes, resolves text/palette,
// and renders a global time t. It knows nothing about video encoding.

import { makeResolver, patchPalettes } from './palette.mjs';
import { resolveText, setText as writeText, makeCounter } from './texts.mjs';
import { checkParam, describeParams, resolveParam } from './params.mjs';
import { rng } from './rng.mjs';

export function createKernel({ timeline, modules }) {
  const color = makeResolver(timeline);
  const byId = new Map(modules.map((m) => [m.id, m]));
  const mounted = new Map(); // sceneId -> { module, ctx, canvas }
  const counter = makeCounter();
  const warnings = [];
  let canvas = null;
  let surface = null;
  let auditBoxes = null; // non-null only while audit() runs
  let width = timeline.width ?? 1920;
  let height = timeline.height ?? 1080;
  let dpr = 1;
  let lastTime = 0;

  function sceneAt(t) {
    const total = timeline.duration ?? timeline.scenes.reduce((a, s) => Math.max(a, s.start + s.length), 0);
    const clamped = Math.max(0, Math.min(t, total - 1e-6));
    for (const s of timeline.scenes) {
      if (clamped >= s.start && clamped < s.start + s.length) return s;
    }
    return timeline.scenes[timeline.scenes.length - 1];
  }

  function makeCtx(scene, entry) {
    const mod = byId.get(scene.id);
    if (!mod) throw new Error(`scene module "${scene.id}" is not registered`);

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
        return dpr;
      },
      seed: timeline.seed ?? 746337560,
      sceneStart: scene.start,
      beats: timeline.beats?.beats ?? [],
      bpm: timeline.beats?.bpm ?? null,
      capture: Boolean(globalThis.__CAPTURE__),
      text(slot) {
        counter.hit(slot);
        return resolveText(timeline, scene, mod.slots, slot);
      },
      param(key) {
        return resolveParam(timeline, scene, mod.params, key);
      },
      color(token, elementId) {
        return color(scene, token, elementId);
      },
      colorNumber(token, elementId) {
        const hex = color(scene, token, elementId);
        return parseInt(hex.replace('#', ''), 16);
      },
      font(family) {
        const stacks = {
          serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
          sans: 'Inter, "Helvetica Neue", Arial, sans-serif',
          mono: 'ui-monospace, "SF Mono", Menlo, monospace',
        };
        return stacks[family] ?? family;
      },
      rng(key) {
        return rng(timeline.seed ?? 746337560, `${scene.id}:${key}`);
      },
      asset(name) {
        return new URL(`../assets/${name}`, import.meta.url).href;
      },
    };
  }

  async function mountAll(targetCanvas, size) {
    canvas = targetCanvas;
    width = size?.width ?? width;
    height = size?.height ?? height;
    dpr = size?.dpr ?? dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    // Display surface composites one scene canvas per frame. Pinning the colour
    // space here keeps readback stable on macOS (display-P3 otherwise shifts values).
    surface = canvas.getContext('2d', { colorSpace: 'srgb' });

    const instrument = (g) => {
      if (!g || g.__dshMotionAudited) return g;
      const original = g.fillText.bind(g);
      g.fillText = (text, x, y, ...rest) => {
        if (auditBoxes) {
          const size = Number((g.font.match(/(\d+(?:\.\d+)?)px/) ?? [])[1] ?? 16);
          auditBoxes.push({
            text: String(text).slice(0, 48),
            x: Number(x),
            y: Number(y) - size * 0.8,
            w: g.measureText(String(text)).width,
            h: size,
            font: g.font,
            alpha: g.globalAlpha,
          });
        }
        return original(text, x, y, ...rest);
      };
      g.__dshMotionAudited = true;
      return g;
    };

    instrument(surface);

    for (const scene of timeline.scenes) {
      const mod = byId.get(scene.id);
      const sc = document.createElement('canvas');
      sc.width = canvas.width;
      sc.height = canvas.height;
      const kind = mod.kind === 'auto' || !mod.kind ? 'canvas2d' : mod.kind;

      // A canvas can hold only one context type, so each scene owns its own.
      const g = kind === 'canvas2d' ? instrument(sc.getContext('2d', { colorSpace: 'srgb' })) : null;
      const entry = { module: mod, kind, canvas: sc, g, ctx: null };
      entry.ctx = makeCtx(scene, entry);
      await mod.mount?.(entry.ctx);
      mounted.set(scene.id, entry);
    }
  }

  function renderAt(t) {
    const scene = sceneAt(t);
    const entry = mounted.get(scene.id);
    if (!entry) throw new Error(`scene "${scene.id}" is not mounted`);

    counter.reset();
    if (entry.kind === 'canvas2d') {
      entry.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      entry.g.clearRect(0, 0, width, height);
    }
    entry.module.render(Math.max(0, t - scene.start), entry.ctx);
    lastTime = t;

    // composite: scene canvas (device px) -> display canvas (CSS px)
    surface.setTransform(1, 0, 0, 1, 0, 0);
    surface.clearRect(0, 0, canvas.width, canvas.height);
    surface.drawImage(entry.canvas, 0, 0, canvas.width, canvas.height);

    // optional 2D overlay on top of the composited scene (3D + typography)
    if (entry.module.overlay) {
      surface.setTransform(dpr, 0, 0, dpr, 0, 0);
      entry.module.overlay(surface, entry.ctx, Math.max(0, t - scene.start));
    }

    const issues = counter.verify(entry.module);
    if (issues.length) warnings.push({ scene: scene.id, t, issues });
  }

  function describe() {
    return {
      width,
      height,
      duration: timeline.duration,
      scenes: timeline.scenes.map((s) => {
        const mod = byId.get(s.id);
        return {
          id: s.id,
          name: s.name,
          start: s.start,
          length: s.length,
          kind: mod?.kind ?? 'canvas2d',
          slots: mod?.slots ?? {},
          textUsage: mod?.textUsage ?? {},
          params: describeParams(timeline, s, mod?.params),
          currentText: Object.fromEntries(
            Object.keys(mod?.slots ?? {}).map((k) => [k, resolveText(timeline, s, mod.slots, k)]),
          ),
        };
      }),
    };
  }

  return {
    timeline,
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
      const scene = timeline.scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      writeText(timeline, scene, mod.slots, slot, value);
      return resolveText(timeline, scene, mod.slots, slot);
    },
    setParam(sceneId, key, value) {
      const scene = timeline.scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      checkParam(mod?.params, key, value);
      timeline.params ??= {};
      timeline.params[sceneId] ??= {};
      timeline.params[sceneId][key] = value;
      return resolveParam(timeline, scene, mod.params, key);
    },
    /** Replace the timeline in place (after a restore) without re-mounting.
     *  The beat grid came from out/beats.json, not from timeline.json, so keep it. */
    reload(next) {
      const beats = timeline.beats;
      for (const key of Object.keys(timeline)) if (!(key in next)) delete timeline[key];
      Object.assign(timeline, next);
      if (beats) timeline.beats = beats;
    },
    setPalette(patch) {
      patchPalettes(timeline, patch);
    },
    setOverride(sceneId, elementId, patch) {
      timeline.overrides ??= {};
      const key = elementId ? `${sceneId}/${elementId}` : sceneId;
      timeline.overrides[key] = { ...(timeline.overrides[key] ?? {}), ...patch };
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
      const scene = sceneAt(atT);
      const entry = mounted.get(scene.id);
      if (!entry?.module.hitTest) return null;
      return entry.module.hitTest(x, y, Math.max(0, atT - scene.start));
    },
    textUsage(sceneId, atT) {
      const scene = sceneAt(atT);
      if (scene.id !== sceneId) throw new Error(`t=${atT} is in scene "${scene.id}", not "${sceneId}"`);
      const entry = mounted.get(sceneId);
      counter.reset();
      entry.module.render(Math.max(0, atT - scene.start), entry.ctx);
      return counter.snapshot();
    },
  };
}
