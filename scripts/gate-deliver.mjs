#!/usr/bin/env node
// Delivery gate: the delivery check must catch the failures that were actually
// shipped before it existed — a film with no sound, and a film that never moves.
//
// The clips are synthetic and built here, so the gate measures the checker, not
// a sample.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { fixtureFilm } from './lib/fixture-film.mjs';
import { inspect } from './film-gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/dsh-motion.mjs');
const { check, finish } = createGate();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-deliver-'));
const clip = (name, args) => {
  const out = path.join(tmp, name);
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args, out]);
  return out;
};

try {
  // 1. a picture that changes, with a sound
  const moving = clip('moving.mp4', [
    '-f', 'lavfi', '-i', 'testsrc=size=192x108:rate=30:duration=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
  ]);
  const a = inspect(moving);
  check('a moving film reports motion', a.moved > 0.5, `${(a.moved * 100).toFixed(0)}%`);
  check('a moving film has no frozen run', a.frozenRun < 0.5, `${a.frozenRun.toFixed(2)}s`);
  check('a moving film has sound', a.hasAudio, a.audio?.codec);
  check('nothing is blank in it', a.blankShare === 0, `${(a.blankShare * 100).toFixed(0)}%`);

  // 2. one frame held for two seconds — the slideshow
  const still = clip('still.mp4', [
    '-f', 'lavfi', '-i', 'color=c=#224488:s=192x108:rate=30:duration=2',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest',
  ]);
  const b = inspect(still);
  check('a held frame reports no motion', b.moved < 0.5, `${(b.moved * 100).toFixed(0)}%`);
  check('a held frame is counted as a long still', b.frozenRun > 1, `${b.frozenRun.toFixed(2)}s`);
  check('a flat colour counts as blank', b.blankShare > 0.9, `${(b.blankShare * 100).toFixed(0)}%`);

  // 3. the same picture with the sound stripped
  const silent = clip('silent.mp4', [
    '-f', 'lavfi', '-i', 'testsrc=size=192x108:rate=30:duration=2',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-an',
  ]);
  check('a silent film reports no audio', !inspect(silent).hasAudio);

  // --- the command the agent actually runs ---
  const project = path.join(tmp, 'film');
  fixtureFilm(project, { id: 'shot', length: 2 });
  fs.mkdirSync(path.join(project, 'motion/out'), { recursive: true });

  const run = () => {
    try {
      return { code: 0, out: execFileSync(process.execPath, [BIN, 'check', '--deliver'], { cwd: project, encoding: 'utf8', stdio: 'pipe' }) };
    } catch (err) {
      return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
    }
  };

  const none = run();
  check(
    'no rendered file is a red, named as such',
    none.code !== 0 && /no film rendered yet/.test(none.out),
    none.out.trim().split('\n').pop(),
  );

  fs.copyFileSync(silent, path.join(project, 'motion/out/video.mp4'));
  const noSound = run();
  check(
    'a silent render is a red, and says where the sound comes from',
    noSound.code !== 0 && /no audio stream/.test(noSound.out) && /audio\.json/.test(noSound.out),
    noSound.out.trim().split('\n').slice(-2).join(' '),
  );

  fs.copyFileSync(moving, path.join(project, 'motion/out/video.mp4'));
  const good = run();
  check('a full render passes', good.code === 0 && /deliverable/.test(good.out), good.out.trim().split('\n').pop());
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
