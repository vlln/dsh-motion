#!/usr/bin/env node
// Turn motion/audio.json into the film's soundtrack, and a picture of it.
//
//   node <skill>/scripts/make-audio.mjs            # render, print what to paste
//   node <skill>/scripts/make-audio.mjs --write    # render and update timeline.json
//
// The sheet is the source of truth: kind, gain, and `at` for an event. Everything
// is synthesized here (no samples, no licences), so the score can be re-cut in
// seconds when the edit changes — which is the whole reason to write it in code.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { sheetFor, renderSheet, toWav, beatGrid, KINDS } from '../../../src/audio.mjs';

const FILM = path.resolve(process.env.DSH_MOTION_PROJECT ?? 'motion');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i === -1 ? d : argv[i + 1];
};

const sheetFile = path.join(FILM, opt('sheet', 'audio.json'));
if (!fs.existsSync(sheetFile)) {
  console.error(`no cue sheet: ${path.relative(process.cwd(), sheetFile)}`);
  console.error('');
  console.error('Write one first — the film talks about sound, the sheet is the score:');
  console.error('');
  console.error('  { "length": 60, "layers": [');
  console.error('      { "kind": "rain", "gain": 0.6 },');
  console.error('      { "kind": "roomtone", "gain": 0.5 },');
  console.error('      { "kind": "page", "at": 34 },');
  console.error('      { "kind": "wheel", "at": 56 } ] }');
  console.error('');
  console.error(`kinds: ${Object.entries(KINDS).map(([k, v]) => `${k} (${v})`).join('\n       ')}`);
  process.exit(1);
}

// The score is as long as the film — that is not information to copy by hand.
const timelineFile = path.join(FILM, 'timeline.json');
const film = fs.existsSync(timelineFile) ? JSON.parse(fs.readFileSync(timelineFile, 'utf8')) : null;
let sheet;
try {
  sheet = sheetFor(JSON.parse(fs.readFileSync(sheetFile, 'utf8')), film?.duration);
} catch (err) {
  console.error(`invalid cue sheet: ${err.message}`);
  process.exit(1);
}

const out = path.join(FILM, opt('out', sheet.out ?? 'assets/audio/bed.wav'));
fs.mkdirSync(path.dirname(out), { recursive: true });

const t0 = Date.now();
const pcm = renderSheet(sheet);
fs.writeFileSync(out, toWav(pcm));

const rel = path.relative(FILM, out).split(path.sep).join('/');
const peaks = (() => {
  // one number per second, so a long quiet stretch is visible in the text too
  const sr = pcm.sampleRate;
  const rows = [];
  for (let s = 0; s + sr <= pcm.left.length; s += sr) {
    let peak = 0;
    let sum = 0;
    for (let i = s; i < s + sr; i++) {
      const v = Math.max(Math.abs(pcm.left[i]), Math.abs(pcm.right[i]));
      peak = Math.max(peak, v);
      sum += v * v;
    }
    rows.push({ peak, rms: Math.sqrt(sum / sr) });
  }
  return rows;
})();
const db = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const loudest = peaks.reduce((a, p) => Math.max(a, p.peak), 0);
// The agent cannot hear the file, so say the shape in one line: one block per
// second, events rise out of the bed. A flat run of blocks is a mix to fix.
// Scaled to the loudest second, over 21 dB: relative shape is what you mix with.
const BARS = '▁▂▃▄▅▆▇█';
const levels = peaks.map((p) => db(p.rms));
const top = Math.max(...levels);
const shape = levels
  .map((d) => BARS[Math.max(0, Math.min(7, Math.round((d - (top - 21)) / 3)))])
  .join('');

// A waveform the agent can look at: the audio equivalent of a contact sheet.
// Cue marks are what make it readable as a plan rather than a blob.
const wave = path.join(FILM, 'out/audio/wave.png');
fs.mkdirSync(path.dirname(wave), { recursive: true });
const W = 1600;
const H = 260;
const x = (t) => Math.max(0, Math.min(W - 1, Math.round((t / pcm.length) * W)));
const marks = [];
(sheet.layers ?? []).forEach((l) => {
  if (l.at !== undefined) marks.push(`drawbox=x=${x(l.at)}:y=0:w=3:h=${H}:color=0xffb84d@0.85:t=fill`);
});
for (let t = 5; t < pcm.length; t += 5) {
  marks.push(`drawbox=x=${x(t)}:y=${H - 14}:w=1:h=14:color=0x6fa8ff@0.5:t=fill`);
}
const ff = spawnSync(
  'ffmpeg',
  [
    '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `color=c=0x0b1426:s=${W}x${H}:d=1`,
    '-i', out,
    '-filter_complex',
    `[1:a]showwavespic=s=${W}x${H}:colors=0x9ad0ff:scale=sqrt[w];[0:v][w]overlay=format=auto,${marks.join(',') || 'null'}`,
    '-frames:v', '1',
    wave,
  ],
  { encoding: 'utf8' },
);
const ms = Date.now() - t0;

console.log(`${rel}  ${pcm.length}s · 48k stereo · peak ${db(loudest).toFixed(1)} dBFS · ${ms} ms`);
console.log(`wave → ${path.relative(FILM, wave)}  (${(sheet.layers ?? []).length} layers, ${(sheet.layers ?? []).filter((l) => l.at !== undefined).length} cues)`);
console.log(`level ${shape}   1 block = 1s`);

const grid = beatGrid(sheet);
const targetLufs = Number(sheet.targetLufs ?? -20);
if (flag('write')) {
  const file = path.join(FILM, 'timeline.json');
  const timeline = JSON.parse(fs.readFileSync(file, 'utf8'));
  timeline.audio = { src: rel, targetLufs };
  if (grid) timeline.beats = grid;
  fs.writeFileSync(file, `${JSON.stringify(timeline, null, 2)}\n`);
  console.log(`timeline.json ← audio.src ${rel}${grid ? ` · beats ${grid.bpm} BPM` : ''}`);
} else {
  console.log('paste into motion/timeline.json (or run again with --write):');
  console.log(JSON.stringify({ audio: { src: rel, targetLufs }, ...(grid ? { beats: grid } : {}) }, null, 2));
}
