#!/usr/bin/env node
// Text tool contract (stand-in for motion_texts): edits timeline.json, validates,
// and reverts if the result would be illegal.
//   node scripts/texts.mjs get --scene first-peoples --slot title
//   node scripts/texts.mjs set --scene first-peoples --slot title --value "..."

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTimeline } from '../src/validate.mjs';
import { snapshot } from '../src/snapshots.mjs';
import { modules } from '../src/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = path.resolve(process.env.DSH_MOTION_PROJECT ?? ROOT);
const mods = await modules(PROJECT);
const file = path.join(PROJECT, 'timeline.json');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};

const timeline = JSON.parse(fs.readFileSync(file, 'utf8'));
const sceneId = opt('scene');
const slot = opt('slot');

if (!sceneId || !slot) {
  console.error('usage: texts.mjs get|set --scene <id> --slot <slot> [--value "..."]');
  process.exit(1);
}

const mod = mods.find((m) => m.id === sceneId);
if (!mod) {
  console.error(`unknown scene "${sceneId}"`);
  process.exit(1);
}
if (!(slot in (mod.slots ?? {}))) {
  console.error(`unknown slot "${slot}" (declared: ${Object.keys(mod.slots ?? {}).join(', ')})`);
  process.exit(1);
}

if (cmd === 'get') {
  const value = timeline.texts?.[sceneId]?.[slot] ?? mod.slots[slot].default;
  console.log(value);
} else if (cmd === 'set') {
  const value = opt('value');
  if (value === undefined) {
    console.error('missing --value');
    process.exit(1);
  }
  const before = timeline.texts?.[sceneId]?.[slot];
  timeline.texts ??= {};
  timeline.texts[sceneId] ??= {};
  timeline.texts[sceneId][slot] = value;

  const { ok, errors } = validateTimeline(timeline, mods);
  if (!ok) {
    console.error(`rejected:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
    process.exit(1);
  }
  snapshot(PROJECT, `text-${sceneId}-${slot}`);
  fs.writeFileSync(file, `${JSON.stringify(timeline, null, 2)}\n`);
  console.log(`${sceneId}.${slot}: ${JSON.stringify(before ?? null)} -> ${JSON.stringify(value)}`);
} else {
  console.error('usage: texts.mjs get|set');
  process.exit(1);
}
