// Runtime validation for the timeline + scene modules.
// The kernel refuses to mount anything that fails here: a missing palette token
// or an undeclared text slot must fail loudly, not render a black frame.

import { FONT_KEYS } from './fonts.mjs';

const HEX = /^#[0-9a-f]{6}$/i;
const REQUIRED_TOKENS = ['bg', 'fg', 'accent', 'muted', 'grid', 'panel'];
const FITS = ['trim', 'loop'];

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function validateTimeline(timeline, modules = null) {
  const errors = [];
  const warnings = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);
  const warn = (path, msg) => warnings.push(`${path}: ${msg}`);

  if (!timeline || typeof timeline !== 'object') {
    return { ok: false, errors: ['timeline: not an object'], warnings };
  }

  for (const key of ['width', 'height']) {
    if (!isNum(timeline[key]) || timeline[key] <= 0) err(key, `must be a positive number (got ${timeline[key]})`);
  }
  // A scaffolded film has no shots and therefore no length; that state is
  // reported once, below, with what to do about it.
  if (!isNum(timeline.duration) || timeline.duration < 0) err('duration', `must be a number (got ${timeline.duration})`);
  if (timeline.fps !== undefined && (!isNum(timeline.fps) || timeline.fps < 1 || timeline.fps > 120)) {
    err('fps', `must be 1..120 (got ${timeline.fps})`);
  }

  // poster: the frame the panel opens on; it may be later than zero, because a
  // film is allowed to start from black.
  if (timeline.poster !== undefined) {
    if (!isNum(timeline.poster) || timeline.poster < 0 || timeline.poster > timeline.duration) {
      err('poster', `must be a number within 0..duration (got ${timeline.poster})`);
    }
  }

  // fonts: the four built-in roles are defaults, not a closed set. A film may
  // name any role of its own; what has to hold is that a file comes with a
  // family name and a src that stays inside the film.
  if (timeline.fonts !== undefined) {
    if (!timeline.fonts || typeof timeline.fonts !== 'object' || Array.isArray(timeline.fonts)) {
      err('fonts', 'must be an object of role → { family, src }');
    } else {
      for (const [role, spec] of Object.entries(timeline.fonts)) {
        if (!spec || typeof spec !== 'object') err(`fonts.${role}`, 'must be an object');
        else if (spec.src && !spec.family) err(`fonts.${role}`, 'needs a family name for the loaded file');
        else if (spec.src && !String(spec.src).startsWith('fonts/')) {
          err(`fonts.${role}`, 'src must live under the film\'s fonts/ directory');
        }
      }
    }
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
    // A scaffolded film has no shots yet. That is a state, not a typo: say what
    // to do about it instead of failing the schema.
    err(
      'scenes',
      'this film has no shots yet — write 镜头表.md (the look in three lines, then one row per shot: a thing and what it does), then add scenes/<id>.mjs',
    );
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

          // value specs: same reasoning as knobs, plus a known format.
          for (const [key, spec] of Object.entries(mod.values ?? {})) {
            const at = `scenes[${i}].values.${key}`;
            if (!isNum(spec?.default)) err(at, 'default must be a number');
            if (!isNum(spec?.min) || !isNum(spec?.max)) err(at, 'min/max must be numbers');
            else if (spec.min >= spec.max) err(at, `min (${spec.min}) must be < max (${spec.max})`);
            else if (isNum(spec.default) && (spec.default < spec.min || spec.default > spec.max)) {
              err(at, `default (${spec.default}) outside ${spec.min}..${spec.max}`);
            }
            if (spec?.format && !['int', 'decimal', 'percent', 'compact'].includes(spec.format)) {
              err(at, `unknown format "${spec.format}" (int | decimal | percent | compact)`);
            }
          }

          // knob specs: a bad default would make the panel show a value the
          // scene cannot draw, so the spec is part of the contract.
          for (const [key, spec] of Object.entries(mod.params ?? {})) {
            const at = `scenes[${i}].params.${key}`;
            if (!isNum(spec?.default)) err(at, 'default must be a number');
            if (!isNum(spec?.min) || !isNum(spec?.max)) err(at, 'min/max must be numbers');
            else if (spec.min >= spec.max) err(at, `min (${spec.min}) must be < max (${spec.max})`);
            else if (isNum(spec.default) && (spec.default < spec.min || spec.default > spec.max)) {
              err(at, `default (${spec.default}) outside ${spec.min}..${spec.max}`);
            }
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

  // params
  if (timeline.params !== undefined) {
    if (!timeline.params || typeof timeline.params !== 'object') {
      err('params', 'must be an object keyed by scene id');
    } else {
      for (const [sceneId, knobs] of Object.entries(timeline.params)) {
        const scene = timeline.scenes?.find((s) => s.id === sceneId);
        if (!scene) {
          err(`params.${sceneId}`, 'unknown scene id');
          continue;
        }
        if (!knobs || typeof knobs !== 'object') {
          err(`params.${sceneId}`, 'must be an object of params');
          continue;
        }
        const mod = modules?.find((m) => m.id === sceneId);
        for (const [key, value] of Object.entries(knobs)) {
          const at = `params.${sceneId}.${key}`;
          if (!isNum(value)) {
            err(at, `must be a finite number (got ${JSON.stringify(value)})`);
            continue;
          }
          if (!mod) continue; // the modules loop already reported the scene
          const spec = mod.params?.[key];
          if (!spec) {
            err(at, `unknown param (declared: ${Object.keys(mod.params ?? {}).join(', ') || 'none'})`);
          } else if (value < spec.min || value > spec.max) {
            err(at, `must be ${spec.min}..${spec.max} (got ${value})`);
          }
        }
      }
    }
  }

  // values
  if (timeline.values !== undefined) {
    if (!timeline.values || typeof timeline.values !== 'object') {
      err('values', 'must be an object keyed by scene id');
    } else {
      for (const [sceneId, entries] of Object.entries(timeline.values)) {
        const scene = timeline.scenes?.find((s) => s.id === sceneId);
        if (!scene) {
          err(`values.${sceneId}`, 'unknown scene id');
          continue;
        }
        if (!entries || typeof entries !== 'object') {
          err(`values.${sceneId}`, 'must be an object of values');
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
            err(at, `unknown value (declared: ${Object.keys(mod.values ?? {}).join(', ') || 'none'})`);
          } else if (value < spec.min || value > spec.max) {
            err(at, `must be ${spec.min}..${spec.max} (got ${value})`);
          }
        }
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
