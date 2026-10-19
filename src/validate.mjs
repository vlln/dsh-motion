// Runtime validation for the timeline + scene modules.
// The kernel refuses to mount anything that fails here: a missing palette token
// or an undeclared text slot must fail loudly, not render a black frame.

const HEX = /^#[0-9a-f]{6}$/i;
const REQUIRED_TOKENS = ['bg', 'fg', 'accent', 'muted', 'grid', 'panel'];
const FITS = ['trim', 'loop', 'pad'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function validateTimeline(timeline, modules = null) {
  const errors = [];
  const warnings = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);
  const warn = (path, msg) => warnings.push(`${path}: ${msg}`);

  if (!timeline || typeof timeline !== 'object') {
    return { ok: false, errors: ['timeline: not an object'], warnings };
  }

  for (const key of ['width', 'height', 'duration']) {
    if (!isNum(timeline[key]) || timeline[key] <= 0) err(key, `must be a positive number (got ${timeline[key]})`);
  }
  if (timeline.fps !== undefined && (!isNum(timeline.fps) || timeline.fps < 1 || timeline.fps > 120)) {
    err('fps', `must be 1..120 (got ${timeline.fps})`);
  }

  // palettes
  if (!timeline.palettes || typeof timeline.palettes !== 'object') {
    err('palettes', 'missing');
  } else {
    if (!timeline.palettes.main) err('palettes.main', 'missing');
    for (const [name, tokens] of Object.entries(timeline.palettes)) {
      if (!tokens || typeof tokens !== 'object') {
        err(`palettes.${name}`, 'must be an object of tokens');
        continue;
      }
      for (const [token, value] of Object.entries(tokens)) {
        if (!HEX.test(value)) err(`palettes.${name}.${token}`, `not a hex color (${value})`);
      }
    }
    for (const token of REQUIRED_TOKENS) {
      if (timeline.palettes.main && !(token in timeline.palettes.main)) {
        err(`palettes.main.${token}`, 'required token missing');
      }
    }
  }

  // scenes
  if (!Array.isArray(timeline.scenes) || timeline.scenes.length === 0) {
    err('scenes', 'must be a non-empty array');
  } else {
    const ids = new Set();
    const moduleById = new Map((modules ?? []).map((m) => [m.id, m]));

    for (const [i, scene] of timeline.scenes.entries()) {
      const p = `scenes[${i}]`;
      if (typeof scene.id !== 'string' || !scene.id) err(`${p}.id`, 'must be a non-empty string');
      else if (ids.has(scene.id)) err(`${p}.id`, `duplicate id "${scene.id}"`);
      else ids.add(scene.id);

      if (typeof scene.name !== 'string' || !scene.name) err(`${p}.name`, 'must be a non-empty string');
      if (!isNum(scene.start) || scene.start < 0) err(`${p}.start`, 'must be >= 0');
      if (!isNum(scene.length) || scene.length <= 0) err(`${p}.length`, 'must be > 0');
      if (isNum(scene.start) && isNum(scene.length) && isNum(timeline.duration) && scene.start + scene.length > timeline.duration + 1e-6) {
        err(`${p}`, 'extends past timeline.duration');
      }
      if (typeof scene.palette !== 'string') err(`${p}.palette`, 'must be a palette name');
      else if (timeline.palettes && !(scene.palette in timeline.palettes)) {
        err(`${p}.palette`, `unknown palette "${scene.palette}"`);
      }
      if (scene.speed !== undefined && ![0.5, 1, 2].includes(scene.speed)) {
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
        }
      }
    }

    // contiguous coverage, in start order
    const ordered = [...timeline.scenes].filter((s) => isNum(s.start) && isNum(s.length)).sort((a, b) => a.start - b.start);
    if (ordered.length) {
      if (Math.abs(ordered[0].start) > 1e-6) err('scenes', `first scene must start at 0 (got ${ordered[0].start})`);
      for (let i = 1; i < ordered.length; i++) {
        const prevEnd = ordered[i - 1].start + ordered[i - 1].length;
        if (Math.abs(ordered[i].start - prevEnd) > 1e-6) {
          err('scenes', `gap or overlap between "${ordered[i - 1].id}" (ends ${prevEnd}) and "${ordered[i].id}" (starts ${ordered[i].start})`);
        }
      }
      const lastEnd = ordered[ordered.length - 1].start + ordered[ordered.length - 1].length;
      if (isNum(timeline.duration) && Math.abs(lastEnd - timeline.duration) > 1e-6) {
        err('scenes', `last scene ends at ${lastEnd}, timeline.duration is ${timeline.duration}`);
      }
    }
  }

  // texts
  if (timeline.texts !== undefined) {
    if (!timeline.texts || typeof timeline.texts !== 'object') {
      err('texts', 'must be an object keyed by scene id');
    } else {
      for (const [sceneId, slots] of Object.entries(timeline.texts)) {
        const scene = timeline.scenes?.find((s) => s.id === sceneId);
        if (!scene) {
          err(`texts.${sceneId}`, 'unknown scene id');
          continue;
        }
        const mod = modules?.find((m) => m.id === sceneId);
        for (const [slot, value] of Object.entries(slots ?? {})) {
          if (typeof value !== 'string') err(`texts.${sceneId}.${slot}`, 'must be a string');
          if (mod) {
            const spec = mod.slots?.[slot];
            if (!spec) {
              err(`texts.${sceneId}.${slot}`, `unknown slot (declared: ${Object.keys(mod.slots ?? {}).join(', ') || 'none'})`);
            } else if (spec.maxChars && typeof value === 'string' && value.length > spec.maxChars) {
              err(`texts.${sceneId}.${slot}`, `exceeds maxChars ${spec.maxChars} (got ${value.length})`);
            }
          }
        }
      }
    }
  }

  // overrides
  if (timeline.overrides !== undefined) {
    for (const [key, patch] of Object.entries(timeline.overrides ?? {})) {
      const [sceneId, elementId] = key.split('/');
      const scene = timeline.scenes?.find((s) => s.id === sceneId);
      if (!scene) err(`overrides.${key}`, `unknown scene "${sceneId}"`);
      if (!patch || typeof patch !== 'object') err(`overrides.${key}`, 'must be an object');
      else for (const [token, value] of Object.entries(patch)) {
        if (!HEX.test(value)) err(`overrides.${key}.${token}`, `not a hex color (${value})`);
        void elementId;
      }
    }
  }

  // audio
  if (timeline.audio !== undefined) {
    const a = timeline.audio;
    if (!a || typeof a !== 'object') err('audio', 'must be an object');
    else {
      if (typeof a.src !== 'string' || !a.src) err('audio.src', 'must be a non-empty path');
      if (a.start !== undefined && (!isNum(a.start) || a.start < 0)) err('audio.start', 'must be >= 0');
      if (a.targetLufs !== undefined && (!isNum(a.targetLufs) || a.targetLufs < -30 || a.targetLufs > -5)) {
        err('audio.targetLufs', `must be -30..-5 (got ${a.targetLufs})`);
      }
      if (a.fit !== undefined && !FITS.includes(a.fit)) err('audio.fit', `must be one of ${FITS.join(' | ')}`);
    }
  }

  if (timeline.beats !== undefined && timeline.beats !== null) {
    const b = timeline.beats;
    if (!isNum(b.bpm) || b.bpm <= 0) err('beats.bpm', 'must be a positive number');
    if (!Array.isArray(b.beats)) err('beats.beats', 'must be an array');
  }

  return { ok: errors.length === 0, errors, warnings };
}

/** Throw a single readable error instead of mounting a broken timeline. */
export function assertTimeline(timeline, modules = null) {
  const { ok, errors } = validateTimeline(timeline, modules);
  if (!ok) {
    const detail = errors.map((e) => `  - ${e}`).join('\n');
    throw new Error(`invalid timeline:\n${detail}`);
  }
}
