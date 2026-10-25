#!/usr/bin/env node
// Read a reference frame and hand back its palette.
//
// The single biggest score jump in this repo came from this step, and it was
// done by hand: the Egyptian card went 47 → 65 in one pass by sampling the
// reference frame's colours and replacing the invented "candy primaries" with
// them. Nothing else in nine rounds moved the number that far.
//
//   node scripts/palette-from.mjs <image> [--colors 8] [--out out/palette.png]
//
// Prints one line per colour: hex, share of the frame, and a swatch strip is
// written next to it so the numbers can be looked at.
//
// This is a ruler. It does not decide anything about a style.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const src = argv[0];
if (!src || src.startsWith('--')) {
  console.error('usage: palette-from.mjs <image> [--colors 8] [--out out/palette.png]');
  process.exit(2);
}
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};

const colors = Math.max(2, Math.min(24, Number(opt('colors', 8)) || 8));
const out = opt('out', null);

/** Decode to raw RGB at a workable size — palette does not need 4K. */
function pixels(file) {
  const probe = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  if (probe.status !== 0) throw new Error(probe.stderr.trim() || 'ffprobe failed');
  const [w0, h0] = probe.stdout.trim().split(',').map(Number);
  const scale = Math.min(1, 480 / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));
  const res = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `scale=${w}:${h}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });
  if (res.status !== 0) throw new Error((res.stderr ?? '').toString().trim() || 'ffmpeg failed');
  return { data: res.stdout, w, h };
}

const { data, w, h } = pixels(src);
const n = w * h;

// k-means, seeded by the most common colours so it lands on the palette rather
// than on the noise between palette entries.
const hist = new Map();
for (let i = 0; i < data.length; i += 3) {
  const key = ((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3);
  hist.set(key, (hist.get(key) ?? 0) + 1);
}
const seeds = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, colors).map(([k]) => [
  (((k >> 10) & 31) << 3) + 4,
  (((k >> 5) & 31) << 3) + 4,
  ((k & 31) << 3) + 4,
]);

let centres = seeds.map((c) => [...c]);
for (let iter = 0; iter < 12; iter++) {
  const sum = centres.map(() => [0, 0, 0, 0]);
  for (let i = 0; i < data.length; i += 3) {
    let best = 0;
    let dist = Infinity;
    for (let k = 0; k < centres.length; k++) {
      const d = (data[i] - centres[k][0]) ** 2 + (data[i + 1] - centres[k][1]) ** 2 + (data[i + 2] - centres[k][2]) ** 2;
      if (d < dist) { dist = d; best = k; }
    }
    sum[best][0] += data[i];
    sum[best][1] += data[i + 1];
    sum[best][2] += data[i + 2];
    sum[best][3]++;
  }
  centres = centres.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
}

// Share of the frame each centre owns, then sort by area — the biggest area is
// the wall/ground, and that is the colour the eye reads as "the picture".
const counts = new Array(centres.length).fill(0);
for (let i = 0; i < data.length; i += 3) {
  let best = 0;
  let dist = Infinity;
  for (let k = 0; k < centres.length; k++) {
    const d = (data[i] - centres[k][0]) ** 2 + (data[i + 1] - centres[k][1]) ** 2 + (data[i + 2] - centres[k][2]) ** 2;
    if (d < dist) { dist = d; best = k; }
  }
  counts[best]++;
}
// 合并撞在一起的中心（k 大于画面里真实颜色数时会重复），丢掉空簇
const merged = [];
centres.forEach((c, k) => {
  if (!counts[k]) return;
  const same = merged.find((m) => Math.abs(m.rgb[0] - c[0]) < 6 && Math.abs(m.rgb[1] - c[1]) < 6 && Math.abs(m.rgb[2] - c[2]) < 6);
  if (same) { same.count += counts[k]; return; }
  merged.push({ rgb: c.map(Math.round), count: counts[k] });
});
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const rows = merged
  .map((m) => ({ hex: hex(m.rgb), share: m.count / n, rgb: m.rgb }))
  .sort((a, b) => b.share - a.share);

console.log(`${path.basename(src)}  ${w}×${h}  ${colors} colours\n`);
for (const r of rows) {
  const bar = '█'.repeat(Math.max(1, Math.round(r.share * 40)));
  console.log(`  ${r.hex}  ${(r.share * 100).toFixed(1).padStart(5)}%  ${bar}  rgb(${r.rgb.join(',')})`);
}
console.log(`\ncopy into the film's palette:\n  ${rows.map((r) => r.hex).join(' ')}`);

if (out) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const sw = 120;
  const args = [];
  rows.forEach((r, i) => args.push('-f', 'lavfi', '-i', `color=c=${r.hex}:s=${sw}x${sw}:d=1`));
  const filter = rows.map((_, i) => `[${i}:v]`).join('') + `hstack=inputs=${rows.length}`;
  const res = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args, '-filter_complex', filter, '-frames:v', '1', out]);
  if (res.status === 0) console.log(`swatch: ${out}`);
}
