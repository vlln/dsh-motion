#!/usr/bin/env node
// Reference ingest: read the video the user wants to imitate, return the
// structure a scene writer needs — duration, cuts, motion curve, palette and
// per-segment summaries. Prints JSON; also writes out/reference.json.
//
//   node scripts/reference.mjs clip.mp4 [--out out/reference.json] [--cut 0.12]
//
// Two passes, both streamed: 10 fps gray for cuts and motion (only the previous
// frame is kept), 2 fps RGB for colour (one histogram per segment).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, probe } from './lib/decode.mjs';
import { findCuts, meanAbsDiff, motionSummary, Palette } from '../src/reference.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i === -1 ? d : args[i + 1];
};

const target = args[0];
if (!target || target.startsWith('--')) {
  console.error('usage: reference.mjs <video> [--out out/reference.json] [--cut 0.12]');
  process.exit(1);
}

const file = path.resolve(ROOT, target);
if (!fs.existsSync(file)) {
  console.error(`no such file: ${target}`);
  process.exit(2);
}

const SERIES_FPS = 10;
const cutThreshold = Number(opt('cut', 0.12));
const out = path.resolve(ROOT, opt('out', 'out/reference.json'));

const info = probe(file);

// ---- pass 1: structure ----
let prev = null;
const series = [];
await decode(file, { info, fps: SERIES_FPS, width: 320, pixFmt: 'gray' }, (buf, w, h, index) => {
  if (prev) series.push({ t: index / SERIES_FPS, v: meanAbsDiff(prev, buf, w, h) });
  prev = Buffer.from(buf);
});

// A cut within a fifth of a second of either end is an artefact, not a segment.
const cuts = findCuts(series, { threshold: cutThreshold }).filter(
  (c) => c.t > 0.2 && c.t < info.duration - 0.2,
);
const motion = motionSummary(series);
const boundaries = [0, ...cuts.map((c) => c.t), info.duration];

// ---- pass 2: colour, per segment ----
const palettes = boundaries.slice(0, -1).map(() => new Palette());
const overall = new Palette();
const segmentOf = (t) => {
  let i = 0;
  while (i + 1 < palettes.length && t >= boundaries[i + 1]) i++;
  return i;
};

await decode(file, { info, fps: 2, width: 96, pixFmt: 'rgb24' }, (buf, w, h, index) => {
  const t = index / 2;
  overall.add(buf, w, h);
  palettes[segmentOf(t)].add(buf, w, h);
});

const guard = 2 / SERIES_FPS; // a transition frame belongs to neither side
const segments = boundaries.slice(0, -1).map((start, i) => {
  const end = boundaries[i + 1];
  const within = series.filter((p) => p.t > start + guard && p.t < end - guard).map((p) => p.v);
  return {
    start: Number(start.toFixed(2)),
    length: Number((end - start).toFixed(2)),
    motion: Number((within.length ? within.reduce((a, b) => a + b, 0) / within.length : 0).toFixed(3)),
    colors: palettes[i].top(2).map((c) => c.hex),
  };
});

const relative = path.relative(ROOT, file);
const result = {
  source: relative.startsWith('..') ? file : relative,
  width: info.width,
  height: info.height,
  fps: Number(info.fps.toFixed(3)),
  duration: Number(info.duration.toFixed(2)),
  cutThreshold,
  cuts,
  motion,
  palette: overall.top(5),
  segments,
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
