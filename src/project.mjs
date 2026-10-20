// The project edit layer: the one place that reads timeline.json, checks a
// change against the scene modules, snapshots the previous file, then writes.
// The panel API and the agent tools both go through here, so a drag and a tool
// call cannot drift apart.

import fs from 'node:fs';
import path from 'node:path';
import { validateTimeline } from './validate.mjs';
import { describeParams, resolveParam, checkParam as validateParam } from './params.mjs';
import { listSnapshots, readSnapshot, snapshot } from './snapshots.mjs';

const timelineFile = (root) => path.join(root, 'timeline.json');

// The node-side module list pulls three in (orbit.mjs). Loading it lazily keeps
// `dsh` boot free of that cost: only an edit or a panel open ever pays it.
let cached = null;
export async function modules() {
  cached ??= (await import('./scenes/all.mjs')).modules;
  return cached;
}

export function readTimeline(root) {
  return JSON.parse(fs.readFileSync(timelineFile(root), 'utf8'));
}

function assertValid(timeline, mods) {
  const { ok, errors } = validateTimeline(timeline, mods);
  if (!ok) throw new Error(`invalid timeline:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
}

/** Validate, keep the previous file, then write. `reason` ends up in the snapshot id. */
export async function writeTimeline(root, timeline, reason = 'edit') {
  const mods = await modules();
  assertValid(timeline, mods);
  const snap = snapshot(root, reason);
  fs.writeFileSync(timelineFile(root), `${JSON.stringify(timeline, null, 2)}\n`);
  return snap;
}

/** Every scene that declares knobs, with its current values. */
export async function describeProject(root) {
  const timeline = readTimeline(root);
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

export async function setProjectParam(root, sceneId, key, value) {
  const timeline = readTimeline(root);
  const scene = timeline.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`unknown scene "${sceneId}"`);

  const mod = (await modules()).find((m) => m.id === sceneId);
  validateParam(mod?.params, key, value);

  timeline.params ??= {};
  timeline.params[sceneId] ??= {};
  timeline.params[sceneId][key] = value;

  const snap = await writeTimeline(root, timeline, `param-${sceneId}-${key}`);
  return { value: resolveParam(timeline, scene, mod.params, key), snapshot: snap };
}

export function history(root) {
  return listSnapshots(root);
}

/** Restore a snapshot; the state being replaced is itself snapshotted first. */
export async function restoreProject(root, id) {
  const next = readSnapshot(root, id);
  const mods = await modules();
  assertValid(next, mods);
  snapshot(root, 'pre-restore');
  fs.writeFileSync(timelineFile(root), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
