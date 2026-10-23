// The project edit layer: the one place that reads timeline.json, checks a
// change against the scene modules, snapshots the previous file, then writes.
// The panel API and the agent tools both go through here, so a drag and a tool
// call cannot drift apart.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateTimeline } from './validate.mjs';
import { describeParams, resolveParam, checkParam as validateParam } from './params.mjs';
import { checkValue as validateValue } from './values.mjs';
import { listSnapshots, readSnapshot, snapshot } from './snapshots.mjs';

const timelineFile = (root, file = 'timeline.json') => {
  const abs = path.resolve(root, file);
  if (!abs.startsWith(root + path.sep)) throw new Error(`timeline path escapes the package: ${file}`);
  if (path.extname(abs) !== '.json') throw new Error(`timeline must be a .json file: ${file}`);
  return abs;
};

// The node-side module list pulls three in (orbit.mjs). Loading it lazily keeps
// `dsh` boot free of that cost: only an edit or a panel open ever pays it.
let cached = null;
export async function modules() {
  cached ??= (await import('./scenes/all.mjs')).modules;
  return cached;
}

export function readTimeline(root, file = 'timeline.json') {
  return JSON.parse(fs.readFileSync(timelineFile(root, file), 'utf8'));
}

function assertValid(timeline, mods) {
  const { ok, errors } = validateTimeline(timeline, mods);
  if (!ok) throw new Error(`invalid timeline:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
}

/** Validate, keep the previous file, then write. `reason` ends up in the snapshot id. */
export async function writeTimeline(root, timeline, reason = 'edit', file = 'timeline.json') {
  const mods = await modules();
  assertValid(timeline, mods);
  const snap = snapshot(root, reason, undefined, file);
  fs.writeFileSync(timelineFile(root, file), `${JSON.stringify(timeline, null, 2)}\n`);
  return snap;
}

/** Every scene that declares knobs, with its current values. */
export async function describeProject(root, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const mods = await modules();
  return timeline.scenes
    .map((scene) => {
      const mod = mods.find((m) => m.id === scene.id);
      return {
        id: scene.id,
        name: scene.name,
        knobs: describeParams(timeline, scene, mod?.params),
      };
    })
    .filter((scene) => scene.knobs.length > 0);
}

export async function setProjectParam(root, sceneId, key, value, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const scene = timeline.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`unknown scene "${sceneId}"`);

  const mod = (await modules()).find((m) => m.id === sceneId);
  validateParam(mod?.params, key, value);

  timeline.params ??= {};
  timeline.params[sceneId] ??= {};
  timeline.params[sceneId][key] = value;

  const snap = await writeTimeline(root, timeline, `param-${sceneId}-${key}`, file);
  return { value: resolveParam(timeline, scene, mod.params, key), snapshot: snap };
}

export async function setProjectText(root, sceneId, slot, value, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const scene = timeline.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`unknown scene "${sceneId}"`);

  const mod = (await modules()).find((m) => m.id === sceneId);
  if (!mod?.slots?.[slot]) {
    throw new Error(`unknown slot "${slot}" for scene "${sceneId}" (declared: ${Object.keys(mod?.slots ?? {}).join(', ') || 'none'})`);
  }

  timeline.texts ??= {};
  timeline.texts[sceneId] ??= {};
  timeline.texts[sceneId][slot] = String(value);

  const snap = await writeTimeline(root, timeline, `text-${sceneId}-${slot}`, file);
  return { value: String(value), snapshot: snap };
}

export async function setProjectValue(root, sceneId, key, value, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const scene = timeline.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`unknown scene "${sceneId}"`);

  const mod = (await modules()).find((m) => m.id === sceneId);
  validateValue(mod?.values, key, value);

  timeline.values ??= {};
  timeline.values[sceneId] ??= {};
  timeline.values[sceneId][key] = value;

  const snap = await writeTimeline(root, timeline, `value-${sceneId}-${key}`, file);
  return { value, snapshot: snap };
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/**
 * Point an existing image asset at another file inside the package.
 * Clips are refused: their sprite sheet was baked by `npm run assets`, so a new
 * source needs a new bake — changing the path alone would render the old frames.
 */
export async function setProjectAsset(root, name, src, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const spec = timeline.assets?.[name];
  if (!spec) throw new Error(`unknown asset "${name}" (declared: ${Object.keys(timeline.assets ?? {}).join(', ') || 'none'})`);
  if (spec.kind !== 'image') {
    throw new Error(`asset "${name}" is ${spec.kind === 'image' ? 'an' : 'a'} ${spec.kind}: re-run \`npm run assets\` after changing its source`);
  }

  const abs = path.resolve(root, src);
  if (!abs.startsWith(root + path.sep)) throw new Error(`asset path escapes the package: ${src}`);
  if (!fs.existsSync(abs)) throw new Error(`asset not found: ${src}`);
  const ext = path.extname(abs).toLowerCase();
  if (!IMAGE_EXT.has(ext)) throw new Error(`not an image (${ext || 'no extension'}): ${src}`);

  timeline.assets[name] = { ...spec, src };
  const snap = await writeTimeline(root, timeline, `asset-${name}`, file);
  return { name, src, snapshot: snap };
}

const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v']);

/**
 * Rebake a clip: optionally repoint it, then run the sheet builder for that one
 * asset. If the bake fails the timeline is rolled back — a clip whose source is
 * not baked would render stale frames, which is worse than refusing.
 */
export async function rebakeAsset(root, name, src, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const spec = timeline.assets?.[name];
  if (!spec) throw new Error(`unknown asset "${name}" (declared: ${Object.keys(timeline.assets ?? {}).join(', ') || 'none'})`);
  if (spec.kind !== 'clip') throw new Error(`asset "${name}" is ${spec.kind === 'image' ? 'an' : 'a'} ${spec.kind}: only clips are baked`);

  const target = src ?? spec.src;
  const abs = path.resolve(root, target);
  if (!abs.startsWith(root + path.sep)) throw new Error(`asset path escapes the package: ${target}`);
  if (!fs.existsSync(abs)) throw new Error(`asset not found: ${target}`);
  if (!VIDEO_EXT.has(path.extname(abs).toLowerCase())) {
    throw new Error(`not a video (${path.extname(abs) || 'no extension'}): ${target}`);
  }

  const previous = fs.readFileSync(timelineFile(root, file), 'utf8');
  if (target !== spec.src) {
    timeline.assets[name] = { ...spec, src: target };
    await writeTimeline(root, timeline, `asset-${name}`, file);
  }

  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/assets.mjs'), 'prep', '--only', name, '--timeline', 'timeline.json'], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch (err) {
    fs.writeFileSync(timelineFile(root, file), previous);
    throw new Error(`rebake failed: ${String(err.stderr || err.stdout || err.message).trim()}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'out/media', `${name}.json`), 'utf8'));
  return { name, src: target, manifest };
}

export function history(root) {
  return listSnapshots(root);
}

/** Restore a snapshot; the state being replaced is itself snapshotted first. */
export async function restoreProject(root, id, file = 'timeline.json') {
  const next = readSnapshot(root, id);
  const mods = await modules();
  assertValid(next, mods);
  snapshot(root, 'pre-restore', undefined, file);
  fs.writeFileSync(timelineFile(root, file), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
