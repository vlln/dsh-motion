// The kernel: owns the timeline, mounts scenes, resolves text/palette,
// and renders a global time t. It knows nothing about video encoding.

import { makeResolver, patchPalettes } from './palette.mjs';
import { resolveText, setText as writeText, makeCounter } from './texts.mjs';
import { checkParam, describeParams, resolveParam } from './params.mjs';
import { checkValue, describeValues, formatValue, resolveValue } from './values.mjs';
import { layoutText } from './text.mjs';
import { sceneTime } from './clock.mjs';
import { paint } from './paint.mjs';
import { fitRect, frameAt, frameRect } from './media.mjs';

import { fontStack, resolveFont } from './fonts.mjs';
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
  let auditSuppress = 0; // drawText registers its own boxes; don't count them twice
  let active = null; // 2d context of the pass in progress (scene canvas or overlay)
  let frameText = []; // text drawn this frame: { slot, box, lines }
  let frameNodes = []; // images / clip frames drawn this frame
  let width = timeline.width ?? 1920;
  let height = timeline.height ?? 1080;
  let dpr = 1;
  // Preview-only: draw the film at a fraction of its resolution. Scenes keep
  // their coordinates; only the backing store shrinks, which is what makes a
  // 1920x1080 film playable inside a 900px panel.
  let scale = 1;
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

    const media = { images: new Map(), clips: new Map() };
    // Drawing verbs a scene may use, or ignore: smoothPath, capsule, wash,
    // strokeOutline, grain. Pure functions, so render(t) stays pure.
    const verbs = paint;

    /** Shared text painter: drawText and drawValue differ only in where the string comes from. */
    const paintText = (value, opts = {}) => {
      const g = active;
      const size = opts.size ?? Math.round(height * 0.03);
      const weight = opts.weight ?? 400;
      const lineHeight = opts.lineHeight ?? 1.35;
      const family = resolveFont(timeline, opts.family ?? 'sans');
      const align = opts.align ?? 'left';
      const x = opts.x ?? 0;
      const y = opts.y ?? 0;
      const w = opts.w ?? width - x;
      const maxLines = opts.maxLines ?? 3;

      g.save();
      g.font = `${weight} ${size}px ${family}`;
      if ('letterSpacing' in g && opts.letterSpacing) g.letterSpacing = `${opts.letterSpacing}px`;
      g.textBaseline = 'top';
      g.textAlign = 'left';
      g.fillStyle = opts.color ?? color(scene, 'fg');
      g.globalAlpha = opts.alpha ?? 1;

      const measure = (text) => g.measureText(text).width;
      const { lines, truncated } = layoutText({ text: String(value), measure, maxWidth: w, maxLines, ellipsis: opts.ellipsis ?? '…' });
      const lineH = size * lineHeight;
      const boxes = [];
      auditSuppress++;
      try {
        lines.forEach((line, i) => {
          const lw = measure(line);
          const lx = align === 'center' ? x + (w - lw) / 2 : align === 'right' ? x + w - lw : x;
          const ly = y + i * lineH;
          g.fillText(line, lx, ly);
          boxes.push({ text: line, x: lx, y: ly, w: lw, h: size });
        });
      } finally {
        auditSuppress--;
      }
      g.restore();

      // The box hugs the drawn glyphs, not the column they were wrapped into:
      // a highlight that spans the whole column looks like a mistake.
      const first = boxes[0];
      const minX = Math.min(...boxes.map((b) => b.x));
      const maxX = Math.max(...boxes.map((b) => b.x + b.w));
      return {
        box: {
          x: first ? minX : x,
          y,
          w: first ? Math.max(1, maxX - minX) : 0,
          h: Math.max(size, lines.length * lineH),
        },
        lines: boxes,
        truncated,
      };
    };

    const loadBitmap = async (src) => {
      const res = await fetch(new URL(src, document.baseURI));
      if (!res.ok) throw new Error(`media "${src}": HTTP ${res.status}`);
      return createImageBitmap(await res.blob());
    };

    return {
      /** Drawing verbs: smoothPath, capsule, wash, strokeOutline, grain. */
      paint: verbs,
      /** Load every asset the scene declared. Called by the kernel before mount(). */
      async preload(names = []) {
        for (const name of names) {
          const spec = timeline.assets?.[name];
          if (!spec) {
            throw new Error(`scene "${scene.id}" declares asset "${name}" but timeline.assets has no such entry`);
          }
          if (spec.kind === 'image') {
            media.images.set(name, await loadBitmap(spec.src));
            continue;
          }
          if (spec.kind === 'clip') {
            const res = await fetch(new URL(`out/media/${name}.json`, document.baseURI));
            if (!res.ok) throw new Error(`clip "${name}" is not prepared — run: npm run assets`);
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
      font(role) {
        return resolveFont(timeline, role);
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
        const r = fitRect({ srcW: bitmap.width, srcH: bitmap.height, boxX, boxY, boxW, boxH, fit: opts.fit ?? 'cover', focus: opts.focus });
        g.save();
        if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
        g.drawImage(bitmap, r.sx, r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
        g.restore();
        frameNodes.push({ kind: 'image', name, box: { x: boxX, y: boxY, w: boxW, h: boxH } });
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
        const r = fitRect({ srcW: clip.frameW, srcH: clip.frameH, boxX, boxY, boxW, boxH, fit: opts.fit ?? 'cover', focus: opts.focus });
        g.save();
        if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
        g.drawImage(clip.sheet, cell.sx + r.sx, cell.sy + r.sy, r.sw, r.sh, r.dx, r.dy, r.dw, r.dh);
        g.restore();
        frameNodes.push({ kind: 'clip', name, box: { x: boxX, y: boxY, w: boxW, h: boxH } });
        return { x: boxX, y: boxY, w: boxW, h: boxH };
      },
      drawText(slot, opts = {}) {
        if (!active) throw new Error(`drawText("${slot}") called outside a render pass`);
        const value = resolveText(timeline, scene, mod.slots, slot);
        counter.hit(slot);
        const out = paintText(value, opts);
        frameText.push({ slot, sceneId: scene.id, kind: 'text', box: out.box, lines: out.lines, truncated: out.truncated, text: value });
        return out;
      },
      /** Raw value, for charts and layout maths. */
      value(key) {
        return resolveValue(timeline, scene, mod.values, key);
      },
      /** Formatted value drawn as text, registered like a slot so it is editable. */
      drawValue(key, opts = {}) {
        if (!active) throw new Error(`drawValue("${key}") called outside a render pass`);
        const spec = mod.values?.[key];
        const raw = resolveValue(timeline, scene, mod.values, key);
        const text = formatValue(raw, spec);
        const out = paintText(text, opts);
        frameText.push({
          slot: `value:${key}`,
          key,
          value: raw,
          sceneId: scene.id,
          kind: 'value',
          box: out.box,
          lines: out.lines,
          truncated: out.truncated,
          text,
        });
        return out;
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
    scale = size?.scale ?? scale;
    canvas.width = Math.round(width * dpr * scale);
    canvas.height = Math.round(height * dpr * scale);
    // Display surface composites one scene canvas per frame. Pinning the colour
    // space here keeps readback stable on macOS (display-P3 otherwise shifts values).
    surface = canvas.getContext('2d', { colorSpace: 'srgb' });

    const instrument = (g) => {
      if (!g || g.__dshMotionAudited) return g;
      const original = g.fillText.bind(g);
      g.fillText = (text, x, y, ...rest) => {
        if (auditBoxes && !auditSuppress) {
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
      await entry.ctx.preload(mod.assets ?? []);
      await mod.mount?.(entry.ctx);
      mounted.set(scene.id, entry);
    }
  }

  function renderAt(t) {
    const scene = sceneAt(t);
    const entry = mounted.get(scene.id);
    if (!entry) throw new Error(`scene "${scene.id}" is not mounted`);

    counter.reset();
    frameText = [];
    frameNodes = [];
    if (entry.kind === 'canvas2d') {
      entry.g.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      entry.g.clearRect(0, 0, width, height);
    }
    active = entry.kind === 'canvas2d' ? entry.g : null;
    entry.module.render(sceneTime(scene, entry.module.duration, t), entry.ctx);
    lastTime = t;

    // composite: scene canvas (device px) -> display canvas (CSS px)
    surface.setTransform(1, 0, 0, 1, 0, 0);
    surface.clearRect(0, 0, canvas.width, canvas.height);
    surface.drawImage(entry.canvas, 0, 0, canvas.width, canvas.height);

    // optional 2D overlay on top of the composited scene (3D + typography)
    if (entry.module.overlay) {
      surface.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
      active = surface;
      entry.module.overlay(surface, entry.ctx, sceneTime(scene, entry.module.duration, t));
    }
    active = null;

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
    /** What the last rendered frame actually put on screen, with slot identity. */
    texts() {
      // The declared box is the layout column; the tight box is what the glyphs
      // actually cover. Highlighting the column looks like a mistake, so report
      // the tight one (falling back to the column when nothing was drawn).
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
        const box = tight(record);
        return {
          scene: record.sceneId,
          slot: record.slot,
          kind: record.kind ?? 'text',
          key: record.key,
          value: record.value,
          text: record.text,
          truncated: record.truncated,
          box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) },
        };
      });
    },
    setValue(sceneId, key, value) {
      const scene = timeline.scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`unknown scene "${sceneId}"`);
      const mod = byId.get(sceneId);
      checkValue(mod?.values, key, value);
      timeline.values ??= {};
      timeline.values[sceneId] ??= {};
      timeline.values[sceneId][key] = value;
      return resolveValue(timeline, scene, mod.values, key);
    },
    /** Assets drawn on the last rendered frame, with their declared source. */
    assets() {
      const seen = new Set();
      return frameNodes
        .filter((node) => {
          const id = `${node.kind}:${node.name}`;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .map((node) => {
          const spec = timeline.assets?.[node.name] ?? {};
          return {
            name: node.name,
            kind: node.kind,
            scene: sceneAt(lastTime).id,
            src: spec.src ?? '',
            editable: node.kind === 'image',
            rebakeable: node.kind === 'clip',
            box: {
              x: Math.round(node.box.x),
              y: Math.round(node.box.y),
              w: Math.round(node.box.w),
              h: Math.round(node.box.h),
            },
          };
        });
    },
    /** Re-decode every asset after timeline.assets changed. */
    async reloadAssets() {
      for (const [sceneId, entry] of mounted) {
        const mod = byId.get(sceneId);
        await entry.ctx.preload(mod.assets ?? []);
      }
    },
    describeValues(sceneId) {
      const scene = timeline.scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error(`unknown scene "${sceneId}"`);
      return describeValues(timeline, scene, byId.get(sceneId)?.values);
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
    /** The live timeline object every resolver closes over. */
    get timeline() {
      return timeline;
    },
    /** Resolve a palette token for the frame currently drawn (debug + UI). */
    colorAt(token, elementId) {
      return color(sceneAt(lastTime), token, elementId);
    },
    /** Re-run every scene's mount(): scenes cache palette-derived sprites there,
     *  so a style change has to rebuild them. */
    remount() {
      for (const entry of mounted.values()) {
        try {
          entry.module.mount?.(entry.ctx);
        } catch (error) {
          console.error(`remount ${entry.id ?? ''}`, error);
        }
      }
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
        const drawn = frameText.flatMap((record) =>
          record.lines.map((line) => ({ ...line, slot: record.slot, scene: record.sceneId })),
        );
        return [...auditBoxes, ...drawn];
      } finally {
        auditBoxes = null;
      }
    },
    pick(x, y, atT) {
      const scene = sceneAt(atT);
      const entry = mounted.get(scene.id);
      const hit = entry?.module.hitTest?.(x, y, Math.max(0, atT - scene.start));
      if (hit) return hit;
      // Text drawn through ctx.drawText is addressable without per-scene code.
      // Only valid for the frame that is currently drawn, hence the time check.
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
            at: Number(atT.toFixed(2)),
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
          kind: 'text',
          slot: record.slot,
          x: Math.round(bx),
          y: Math.round(by),
          w: Math.round(w),
          h: Math.round(h),
          label: (record.lines[0]?.text ?? record.text).slice(0, 40),
          at: Number(atT.toFixed(2)),
        };
      }
      return null;
    },
    textUsage(sceneId, atT) {
      const scene = sceneAt(atT);
      if (scene.id !== sceneId) throw new Error(`t=${atT} is in scene "${scene.id}", not "${sceneId}"`);
      const entry = mounted.get(sceneId);
      counter.reset();
      active = entry.kind === 'canvas2d' ? entry.g : null;
      entry.module.render(Math.max(0, atT - scene.start), entry.ctx);
      active = null;
      return counter.snapshot();
    },
  };
}
