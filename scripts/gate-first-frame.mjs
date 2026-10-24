#!/usr/bin/env node
// First-frame gate: a film created from a template must not open on an empty
// canvas. Renders time 0 for every template and measures how much is there.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { createFilmFromTemplate, listTemplates } from '../src/film.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-first-'));

/** Standard deviation and dominant-colour share, from a PNG, via one ffmpeg call. */
function inkiness(file) {
  const raw = execFileSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', 'scale=160:-2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const n = raw.length / 3;
  let sum = 0;
  let sumSq = 0;
  const buckets = new Map();
  for (let i = 0; i < raw.length; i += 3) {
    const v = (raw[i] + raw[i + 1] + raw[i + 2]) / 3;
    sum += v;
    sumSq += v * v;
    const key = `${raw[i] >> 4},${raw[i + 1] >> 4},${raw[i + 2] >> 4}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sumSq / n - mean * mean));
  const dominant = Math.max(...buckets.values()) / n;
  return { mean: Number(mean.toFixed(1)), sd: Number(sd.toFixed(1)), dominant: Number(dominant.toFixed(2)) };
}

try {
  // Negative control: a solid frame must be caught, or the gate proves nothing.
  const solid = path.join(tmp, 'solid.png');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x64', '-frames:v', '1', solid]);
  const blank = inkiness(solid);
  check('a solid frame is detected as blank', blank.dominant > 0.985 && blank.sd < 6, `sd ${blank.sd} · dominant ${blank.dominant}`);

  for (const id of listTemplates()) {
    const dir = path.join(tmp, id);
    fs.mkdirSync(dir, { recursive: true });
    const { film } = createFilmFromTemplate(dir, id);
    const width = Math.min(720, film.width);
    const height = Math.round((width / film.width) * film.height);
    execFileSync(
      process.execPath,
      [path.join(ROOT, 'scripts/capture.mjs'), '--stills', '0', '--cols', '1', '--width', String(width), '--height', String(height), '--out', 'out/first.png'],
      { cwd: path.join(dir, 'motion'), env: { ...process.env, DSH_MOTION_PROJECT: path.join(dir, 'motion') } },
    );
    const frames = path.join(dir, 'motion/out/first-frames');
    const file = fs.readdirSync(frames).filter((f) => f.endsWith('.png')).sort()[0];
    const stat = inkiness(path.join(frames, file));
    // Almost everything one colour, with no spread, is a blank frame.
    const blank = stat.dominant > 0.985 && stat.sd < 6;
    check(`${id}: the first frame has content`, !blank, `sd ${stat.sd} · dominant ${stat.dominant}`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
finish();
