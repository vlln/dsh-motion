#!/usr/bin/env node
// Validation gates: one legal timeline, N illegal ones that must be rejected.
// A validator that accepts everything is worse than no validator.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTimeline } from '../src/validate.mjs';
import { modules } from '../src/scenes/all.mjs';
import { createGate } from './lib/gate.mjs';
import { sceneTime } from '../src/clock.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(base));

const { check, finish } = createGate();

const expectError = (name, mutate, needle) => {
  const timeline = clone();
  mutate(timeline);
  const { ok, errors } = validateTimeline(timeline, modules);
  const hit = errors.some((e) => e.includes(needle));
  check(name, !ok && hit, ok ? 'accepted (should reject)' : errors[0]);
};

// 1. the real timeline must pass
{
  const { ok, errors } = validateTimeline(clone(), modules);
  check('valid timeline accepted', ok, errors.join('; '));
}

// 2. required palette token missing
expectError('missing palette token', (t) => delete t.palettes.main.bg, 'palettes.main.bg');

// 3. overlapping scenes
expectError('overlapping scenes', (t) => (t.scenes[1].start = 7), 'gap or overlap');

// 4. undeclared text slot
expectError('unknown text slot', (t) => {
  t.texts = { 'first-peoples': { nope: 'x' } };
}, 'unknown slot');

// 5. duplicate scene id
expectError('duplicate scene id', (t) => (t.scenes[1].id = t.scenes[0].id), 'duplicate id');

// 6. bad audio target
expectError('bad target LUFS', (t) => (t.audio.targetLufs = -3), 'audio.targetLufs');

// 7. override points at a scene that does not exist
expectError('override unknown scene', (t) => (t.overrides = { ghost: { accent: '#ff0000' } }), 'unknown scene');

// 8. duration does not match the last scene
expectError('duration mismatch', (t) => (t.duration = 20), 'timeline.duration');

// 9. text longer than maxChars
expectError(
  'text exceeds maxChars',
  (t) => (t.texts = { 'first-peoples': { title: 'x'.repeat(80) } }),
  'exceeds maxChars',
);

// 10. missing scene module
expectError('missing scene module', (t) => (t.scenes[0].id = 'nope'), 'no scene module registered');

// --- the scene clock: trim vs compress ---
const okTimeline = clone();
void okTimeline;

const trim = sceneTime({ start: 10, length: 14, speed: 1 }, undefined, 13);
check('trim: a scene hears its own seconds', Math.abs(trim - 3) < 1e-9, `${trim}`);

const trimmed = sceneTime({ start: 10, length: 2, speed: 1 }, undefined, 12);
check('trim: a shorter slot still hears 2s', Math.abs(trimmed - 2) < 1e-9, `${trimmed}`);

const compressed = sceneTime({ start: 10, length: 2, speed: 1 }, 14, 12);
check('compress: 14s of content in a 2s slot runs at 7x', Math.abs(compressed - 14) < 1e-9, `${compressed}`);

const stretched = sceneTime({ start: 0, length: 8, speed: 1 }, 4, 8);
check('compress: 4s of content in an 8s slot runs at 0.5x', Math.abs(stretched - 4) < 1e-9, `${stretched}`);

const fast = sceneTime({ start: 10, length: 14, speed: 2 }, undefined, 12);
check('speed multiplies on its own', Math.abs(fast - 4) < 1e-9, `${fast}`);

const both = sceneTime({ start: 10, length: 2, speed: 2 }, 14, 11);
check('speed and compression multiply', Math.abs(both - 14) < 1e-9, `${both}`);

finish();
