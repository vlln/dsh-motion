#!/usr/bin/env node
// Look report: the numbers an agent can feel when it cannot see.
//
// Three measures, chosen because each separates a painted frame from a flat one:
//   flatness — share of the frame covered by a handful of dominant colours.
//              Vector fills are a few big colours; paint is thousands of small ones.
//   texture  — mean Laplacian over luma. Flat fills have no local detail at all.
//   spread   — mean colour distance to the reference frame, when out/ref has one.
//
// Soft by default: it prints and writes a report. `check --strict` is what makes
// it fatal, because a threshold on taste must never be beyond argument.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILM = path.resolve(process.env.DSH_MOTION_PROJECT ?? 'motion');
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const flag = (n) => argv.includes(`--${n}`);

/** Decode an image to RGBA at a fixed small size, so every frame is comparable. */
function pixels(file, w = 240, h = 135) {
  const res = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}:flags=area,format=rgba`, '-frames:v', '1', '-f', 'rawvideo', '-'],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.stdout?.length >= w * h * 4) return { data: res.stdout.subarray(0, w * h * 4), w, h };
  return null;
}

function measure({ data, w, h }) {
  // --- flatness: how much of the frame is a few dominant colours ------------
  const bins = new Map();
  for (let i = 0; i < w * h * 4; i += 4) {
    // 5 bits per channel: tolerant of grain, still separates flat fills
    const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
    bins.set(key, (bins.get(key) ?? 0) + 1);
  }
  const total = w * h;
  const shares = [...bins.values()].map((n) => n / total).sort((a, b) => b - a);
  const flatShare = shares.filter((s) => s > 0.015).reduce((a, b) => a + b, 0);

  // --- texture: mean absolute Laplacian on luma -----------------------------
  const luma = new Float32Array(w * h);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    luma[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }
  let sum = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      sum += Math.abs(4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - w] - luma[i + w]);
      n++;
    }
  }
  return { flatness: Number(flatShare.toFixed(3)), texture: Number((sum / n).toFixed(2)) };
}

/** Mean colour distance to a reference frame, if the film was made from one. */
function distanceToReference(shot, refFile) {
  const ref = pixels(refFile, shot.w, shot.h);
  if (!ref) return null;
  let sum = 0;
  for (let i = 0; i < shot.w * shot.h * 4; i += 4) {
    sum += Math.abs(shot.data[i] - ref.data[i]) + Math.abs(shot.data[i + 1] - ref.data[i + 1]) + Math.abs(shot.data[i + 2] - ref.data[i + 2]);
  }
  return Number((sum / ((shot.w * shot.h) * 3)).toFixed(1));
}

/** Pick the reference frame nearest a time, from the frames a `reference` run left. */
function nearestReference(t) {
  const dir = path.join(FILM, 'out/ref');
  const indexFile = path.join(dir, 'index.json');
  if (!fs.existsSync(indexFile)) return null;
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  const frames = fs.readdirSync(dir).filter((f) => /^f\d+\.jpg$/.test(f)).sort();
  if (!frames.length) return null;
  const fps = Number(index.fps ?? 2);
  const want = Math.max(1, Math.min(frames.length, Math.round(t * fps) + 1));
  return path.join(dir, frames[want - 1]);
}

// --- where the still comes from ---------------------------------------------
const shotFile = path.join(FILM, 'out/look/shot.png');
fs.mkdirSync(path.dirname(shotFile), { recursive: true });
// capture.mjs puts Chromium's profile here; a missing TMPDIR fails silently.
fs.mkdirSync(path.join(FILM, 'out/.tmp'), { recursive: true });

const explicit = opt('file');
const timelineFile = path.join(FILM, 'timeline.json');
if (!fs.existsSync(timelineFile) && !explicit) {
  console.error('no film here');
  process.exit(1);
}
const timeline = fs.existsSync(timelineFile) ? JSON.parse(fs.readFileSync(timelineFile, 'utf8')) : {};
const at = Number(opt('at', timeline.poster ?? (timeline.duration ?? 0) / 2));

if (!flag('reuse') || !fs.existsSync(shotFile) || explicit) {
  if (!explicit) {
    execFileSync(
      process.execPath,
      [path.join(PKG, 'scripts/capture.mjs'), '--stills', String(at), '--cols', '1', '--out', 'out/look/shot.png'],
      { cwd: PKG, env: { ...process.env, DSH_MOTION_PROJECT: FILM, TMPDIR: path.join(FILM, 'out/.tmp') }, stdio: ['ignore', 'pipe', 'pipe'] },
    );
  }
}
const frames = path.join(FILM, 'out/look/shot-frames');
const still = explicit ? path.resolve(explicit) : fs.existsSync(path.join(frames, '00.png')) ? path.join(frames, '00.png') : shotFile;
if (!fs.existsSync(still)) {
  console.error('could not render a still to look at');
  process.exit(1);
}

const shot = pixels(still);
if (!shot) {
  console.error('could not decode the still');
  process.exit(1);
}
const stats = measure(shot);

const refFile = nearestReference(at);
const spread = refFile ? distanceToReference(shot, refFile) : null;

// The reference's own numbers are the useful comparison: an absolute threshold
// on "flat" is an argument about taste, a ratio against the thing you were asked
// to match is a fact.
const refStats = refFile ? measure(pixels(refFile)) : null;

const report = {
  at: Number(at.toFixed(2)),
  still: path.relative(FILM, still),
  mine: stats,
  ...(refStats ? { reference: { file: path.relative(FILM, refFile), ...refStats, colourDistance: spread } } : {}),
  // Only the extreme is a defect: almost the whole frame one colour means
  // nothing was drawn. Everything else is a judgement call for the film.
  empty: stats.flatness > 0.85 && stats.texture < 5,
};
fs.writeFileSync(path.join(FILM, 'out/look/report.json'), `${JSON.stringify(report, null, 2)}\n`);

// A side-by-side is the only way an agent has of seeing "mine vs theirs".
if (refFile) {
  const vs = path.join(FILM, 'out/look/vs-ref.jpg');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', refFile, '-i', still, '-filter_complex', '[0:v]scale=640:-2[a];[1:v]scale=640:-2[b];[a][b]vstack', vs], {
    stdio: 'ignore',
  });
  if (fs.existsSync(vs)) report.vsRef = path.relative(FILM, vs);
}

if (flag('json')) {
  console.log(JSON.stringify(report));
} else {
  const line = (label, m) => `${label} solid ${m.flatness.toFixed(2)} · texture ${m.texture.toFixed(1)}`;
  console.log(`look · ${report.at}s · ${line('mine', stats)}`);
  if (refStats) console.log(`       ${line('ref ', refStats)} · colour distance ${spread}`);
  if (report.empty) {
    console.log('  almost the whole frame is one colour: nothing was drawn, or nothing survived the grade.');
  } else if (refStats && refStats.texture > stats.texture * 1.8) {
    console.log(`  the reference has ${(refStats.texture / stats.texture).toFixed(1)}x the local detail of this frame.`);
  }
}

if (flag('strict') && report.empty) process.exit(1);
