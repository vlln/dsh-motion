#!/usr/bin/env node
// Film gate: read the finished mp4 and measure three failure modes that code
// gates cannot see. Thresholds follow huashu-art-motion's film_gate.py
// (calibrated 2026-10 on 13 human-rated films); re-calibrate per content domain.
//
//   node scripts/gate-film.mjs [file] [--json]
//
// RED  = blank run >= 0.3s, fast-motion ratio < 0.035, blue-purple ratio >= 0.30
// WARN = fast-motion < 0.06, blue-purple >= 0.12

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const file = path.resolve(ROOT, args[0] && !args[0].startsWith('--') ? args[0] : 'out/demo.mp4');
const asJson = args.includes('--json');
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i === -1 ? d : Number(args[i + 1]);
};
const MIN_MOTION = opt('min-motion', 0.035);
const WARN_MOTION = opt('warn-motion', 0.06);
const MAX_PURPLE = opt('max-purple', 0.3);
const WARN_PURPLE = opt('warn-purple', 0.12);

if (!fs.existsSync(file)) {
  console.error(`missing ${path.relative(ROOT, file)} — run npm run video first`);
  process.exit(2);
}

const probe = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], {
    encoding: 'utf8',
  }),
);
const stream = probe.streams.find((s) => s.codec_type === 'video');
const W = Number(stream.width);
const H = Number(stream.height);
const duration = Number(probe.format.duration);

/** Decode raw frames at a given fps/width; calls onFrame(buffer, w, h) per frame. */
function decode({ fps, width, pixFmt }, onFrame) {
  return new Promise((resolve, reject) => {
    const h = Math.max(2, Math.round((width * H) / W / 2) * 2);
    const frameSize = width * h * (pixFmt === 'rgb24' ? 3 : 1);
    const ff = spawn('ffmpeg', [
      '-v', 'error', '-i', file,
      '-vf', `fps=${fps},scale=${width}:${h},format=${pixFmt}`,
      '-f', 'rawvideo', 'pipe:1',
    ]);
    let buf = Buffer.alloc(0);
    let count = 0;
    ff.stdout.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (buf.length >= frameSize) {
        onFrame(buf.subarray(0, frameSize), width, h, count++);
        buf = buf.subarray(frameSize);
      }
    });
    ff.on('close', (code) => (code === 0 ? resolve(count) : reject(new Error(`ffmpeg exited ${code}`))));
  });
}

const findings = { file: path.relative(ROOT, file), duration, motion: null, blank: [], purple: null };

// ---- pass 1: 12 fps gray, blank + motion ----
const GRAY_W = 320;
const frames = [];
await decode({ fps: 12, width: GRAY_W, pixFmt: 'gray' }, (buf, w, h) => {
  frames.push({ t: frames.length / 12, buf: Buffer.from(buf), w, h });
});

const edgeRatio = (f) => {
  const { buf, w, h } = f;
  const rowLimit = Math.floor(h * 0.85); // ignore the bottom caption band
  let edges = 0;
  let total = 0;
  for (let y = 0; y < rowLimit; y++) {
    for (let x = 0; x < w - 2; x += 2) {
      const i = y * w + x;
      if (Math.abs(buf[i + 2] - buf[i]) > 24) edges++;
      total++;
    }
  }
  return total ? edges / total : 0;
};

const meanDiff = (a, b) => {
  const w = a.w;
  const h = a.h;
  const rowLimit = Math.floor(h * 0.85);
  let sum = 0;
  let n = 0;
  for (let y = 0; y < rowLimit; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      sum += Math.abs(a.buf[i] - b.buf[i]);
      n++;
    }
  }
  return n ? sum / n : 0;
};

let blankRun = null;
for (const f of frames) {
  const blank = edgeRatio(f) < 0.002;
  if (blank && f.t > 0.5 && f.t < duration - 0.5) {
    if (!blankRun) blankRun = { from: f.t, to: f.t };
    else blankRun.to = f.t;
  } else if (blankRun) {
    if (blankRun.to - blankRun.from >= 0.25) findings.blank.push(blankRun);
    blankRun = null;
  }
}
if (blankRun && blankRun.to - blankRun.from >= 0.25) findings.blank.push(blankRun);

let fast = 0;
const diffs = [];
for (let i = 1; i < frames.length; i++) {
  const d = meanDiff(frames[i - 1], frames[i]);
  diffs.push({ t: frames[i].t, d });
  if (d >= 9) fast++;
}
findings.motion = frames.length > 1 ? fast / (frames.length - 1) : 0;
findings.top = [...diffs].sort((a, b) => b.d - a.d).slice(0, Number(opt('top', 0)) || 0);

// ---- pass 2: 2 fps RGB, blue-purple ----
let purpleFrames = 0;
let rgbFrames = 0;
await decode({ fps: 2, width: 160, pixFmt: 'rgb24' }, (buf, w, h) => {
  rgbFrames++;
  let hit = 0;
  const total = w * h;
  for (let i = 0; i < total; i++) {
    const r = buf[i * 3];
    const g = buf[i * 3 + 1];
    const b = buf[i * 3 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const v = max / 255;
    const s = max === 0 ? 0 : (max - min) / max;
    if (v < 0.06 || v > 0.9 || s < 0.3) continue;
    let hue;
    if (max === r) hue = 60 * (((g - b) / (max - min)) % 6);
    else if (max === g) hue = 60 * ((b - r) / (max - min) + 2);
    else hue = 60 * ((r - g) / (max - min) + 4);
    if (hue < 0) hue += 360;
    if (hue >= 225 && hue <= 300) hit++;
  }
  if (hit / total >= 0.3) purpleFrames++;
});
findings.purple = rgbFrames ? purpleFrames / rgbFrames : 0;

// ---- verdicts ----
const red = [];
const warn = [];
if (findings.blank.length) red.push(`blank run >=0.3s: ${findings.blank.map((b) => `${b.from.toFixed(2)}-${b.to.toFixed(2)}s`).join(', ')}`);
if (findings.motion < MIN_MOTION) red.push(`fast-motion ratio ${findings.motion.toFixed(3)} < ${MIN_MOTION}`);
else if (findings.motion < WARN_MOTION) warn.push(`fast-motion ratio ${findings.motion.toFixed(3)} < ${WARN_MOTION}`);
if (findings.purple >= MAX_PURPLE) red.push(`blue-purple frame ratio ${findings.purple.toFixed(3)} >= ${MAX_PURPLE}`);
else if (findings.purple >= WARN_PURPLE) warn.push(`blue-purple ratio ${findings.purple.toFixed(3)} >= ${WARN_PURPLE}`);

const result = { ...findings, red, warn };
if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  console.log(`file         ${result.file}  (${duration.toFixed(2)}s)`);
  console.log(`fast motion  ${findings.motion.toFixed(3)}  (red <0.035, warn <0.06)`);
  console.log(`blank runs   ${findings.blank.length ? findings.blank.map((b) => `${b.from.toFixed(2)}-${b.to.toFixed(2)}s`).join(', ') : 'none'}`);
  console.log(`blue-purple  ${(findings.purple * 100).toFixed(1)}%  (red >=30%, warn >=12%)`);
  if (findings.top?.length) {
    console.log('top frame diffs:');
    for (const p of findings.top) console.log(`  ${p.t.toFixed(2)}s  ${p.d.toFixed(1)}`);
  }
  for (const r of red) console.log(`RED   ${r}`);
  for (const w of warn) console.log(`WARN  ${w}`);
  console.log(red.length ? '\nFAIL' : warn.length ? '\nPASS (warnings)' : '\nPASS');
}
process.exit(red.length ? 1 : 0);
