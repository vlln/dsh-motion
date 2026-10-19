#!/usr/bin/env node
// Waveform + beat grid + drop marker, as one PNG the agent can look at.
// This is the audio equivalent of a contact sheet.

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audio = process.argv[2] ?? path.join(ROOT, 'out/bed.wav');
const beatsFile = process.argv[3] ?? path.join(ROOT, 'out/beats.json');
const out = process.argv[4] ?? path.join(ROOT, 'out/wave.png');

const W = 1600;
const H = 300;
const base = path.join(ROOT, 'out/.wave-base.png');

const run = (args) =>
  new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(err.slice(-800)))));
  });

await run([
  '-y',
  '-f', 'lavfi', '-i', `color=c=0x0b1426:s=${W}x${H}:d=1`,
  '-i', audio,
  '-filter_complex', `[1:a]showwavespic=s=${W}x${H}:colors=0x6fa8ff[w];[0:v][w]overlay=format=auto`,
  '-frames:v', '1', base,
]);

const { beats, drop, duration } = JSON.parse(fs.readFileSync(beatsFile, 'utf8'));
const x = (t) => Math.max(0, Math.min(W - 1, Math.round((t / duration) * W)));

const filters = beats.map(
  (t, i) =>
    i % 4 === 0
      ? `drawbox=x=${x(t)}:y=0:w=3:h=${H}:color=0xffb84d@0.9:t=fill`
      : `drawbox=x=${x(t)}:y=0:w=2:h=${H}:color=0xffd36a@0.55:t=fill`,
);
if (drop != null) {
  filters.push(`drawbox=x=${x(drop)}:y=0:w=3:h=${H}:color=0xff5a4a@0.9:t=fill`);
}
// top/bottom rules so the image reads as a chart, not a blob
filters.push(`drawbox=x=0:y=0:w=${W}:h=2:color=0x1b2a44@1:t=fill`);
filters.push(`drawbox=x=0:y=${H - 2}:w=${W}:h=2:color=0x1b2a44@1:t=fill`);

await run(['-y', '-i', base, '-vf', filters.join(','), out]);
fs.rmSync(base, { force: true });
console.log(`wave → ${path.relative(ROOT, out)}  (${beats.length} beats, drop=${drop}s)`);
