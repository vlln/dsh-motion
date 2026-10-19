#!/usr/bin/env node
// Validation gates: one legal timeline, N illegal ones that must be rejected.
// A validator that accepts everything is worse than no validator.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTimeline } from '../src/validate.mjs';
import { modules } from '../src/scenes/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const clone = () => JSON.parse(JSON.stringify(base));

const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

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

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
