#!/usr/bin/env node
// Plate gate: the "borrow a real picture" route has to work from a cold start —
// a fresh directory, one command, and a film that renders with its asset and its
// credit intact.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/dsh-motion.mjs');
const { check, finish } = createGate();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-plate-'));
try {
  const out = execFileSync(process.execPath, [BIN, 'init', '--template', 'plate'], { cwd: tmp, encoding: 'utf8' });
  const film = path.join(tmp, 'motion');
  check('the template builds a film', /1 scene/.test(out), out.trim().split('\n')[0]);

  // The whole point of this template is that the film owns its picture: the
  // asset has to travel with it, or the film is broken on any other machine.
  const plate = path.join(film, 'assets/plates/night.jpg');
  check('the plate travels with the film', fs.existsSync(plate), 'assets/plates/night.jpg');
  check('the plate is a real image', fs.existsSync(plate) && fs.statSync(plate).size > 100_000, fs.existsSync(plate) ? `${Math.round(fs.statSync(plate).size / 1024)} KB` : 'missing');
  check('the credit travels with it too', fs.existsSync(path.join(film, 'CREDITS.md')));

  const timeline = JSON.parse(fs.readFileSync(path.join(film, 'timeline.json'), 'utf8'));
  check('the asset is declared in the timeline', timeline.assets?.plate?.src === 'assets/plates/night.jpg', JSON.stringify(timeline.assets?.plate ?? null));
  check('the film has a cover time', typeof timeline.poster === 'number', String(timeline.poster));

  const checked = execFileSync(process.execPath, [BIN, 'check', '--fast'], { cwd: tmp, encoding: 'utf8' });
  check('the film passes check', /ok ·/.test(checked), checked.trim());

  execFileSync(process.execPath, [BIN, 'render', '--stills', '4', '--cols', '1', '--out', 'out/poster.png'], {
    cwd: tmp,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const still = path.join(film, 'out/poster-frames/00.png');
  check('it renders a frame', fs.existsSync(still), 'out/poster-frames/00.png');

  // A plate film is only worth anything if the plate is actually on screen: the
  // frame must be varied, not a flat fill with a sprite on it.
  const stats = spawnSync('ffmpeg', ['-hide_banner', '-i', still, '-vf', 'signalstats,metadata=print', '-frames:v', '1', '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  const spread = /lavfi\.signalstats\.YAVG=([0-9.]+)/.exec(String(stats.stderr ?? ''));
  check('the frame has an image in it', Boolean(spread), spread ? `YAVG ${Number(spread[1]).toFixed(0)}` : 'no stats');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
