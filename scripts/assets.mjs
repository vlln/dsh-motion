#!/usr/bin/env node
// Asset prep: turn declared clips into a single sprite sheet the renderer can
// hold in memory, and check that image sources exist and stay inside the package.
//
//   node scripts/assets.mjs prep [--timeline timeline.json]
//
// Output: out/media/<name>.jpg + out/media/<name>.json
// A sheet (not a frame directory) because one bitmap is cheap to preload and
// drawImage with a source rect is exact — no per-frame file IO during capture.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT = path.resolve(process.env.DSH_MOTION_PROJECT ?? ROOT);
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};

if (cmd !== 'prep') {
  console.error('usage: assets.mjs prep [--timeline timeline.json]');
  process.exit(1);
}

const timelinePath = path.resolve(PROJECT, opt('timeline', 'timeline.json'));
const only = opt('only', null);
const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));
const assets = timeline.assets ?? {};
const outDir = path.join(PROJECT, 'out', 'media');
fs.mkdirSync(outDir, { recursive: true });

function inside(src) {
  const abs = path.resolve(PROJECT, src);
  if (!abs.startsWith(PROJECT + path.sep)) throw new Error(`asset escapes the film: ${src}`);
  if (!fs.existsSync(abs)) throw new Error(`asset not found: ${src}`);
  return abs;
}

function probe(file) {
  const out = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file], {
      encoding: 'utf8',
    }),
  );
  const stream = out.streams.find((s) => s.codec_type === 'video');
  return { width: Number(stream.width), height: Number(stream.height), duration: Number(out.format.duration) };
}

const prepared = [];
for (const [name, spec] of Object.entries(assets)) {
  if (only && name !== only) continue;
  if (!spec || typeof spec !== 'object') throw new Error(`assets.${name}: must be an object`);
  const src = inside(spec.src);

  if (spec.kind === 'image') {
    prepared.push({ name, kind: 'image', src: spec.src });
    continue;
  }

  if (spec.kind !== 'clip') throw new Error(`assets.${name}.kind must be image | clip (got ${spec.kind})`);

  const info = probe(src);
  const fps = Number(spec.fps ?? timeline.fps ?? 30);
  if (!(fps > 0)) throw new Error(`assets.${name}.fps must be > 0`);
  const count = Math.max(1, Math.round(info.duration * fps));
  const frameW = Math.max(2, Math.round(Math.min(Number(spec.width ?? 480), info.width) / 2) * 2);
  const frameH = Math.max(2, Math.round((frameW * info.height) / info.width / 2) * 2);
  const cols = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(count * (frameW / frameH)))));
  const rows = Math.ceil(count / cols);

  const sheet = path.join(outDir, `${name}.jpg`);
  execFileSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-i', src, '-vf', `fps=${fps},scale=${frameW}:${frameH},tile=${cols}x${rows}`, '-frames:v', '1', '-q:v', '2', sheet],
    { cwd: PROJECT },
  );

  const manifest = {
    kind: 'clip',
    src: `out/media/${name}.jpg`,
    cols,
    rows,
    frameW,
    frameH,
    count,
    fps,
  };
  fs.writeFileSync(path.join(outDir, `${name}.json`), `${JSON.stringify(manifest, null, 2)}\n`);
  prepared.push({ name, ...manifest });
}

// Index lets the kernel tell "not prepared yet" from "declared but broken".
// `--only` rebakes one asset, so merge with what is already indexed.
const indexPath = path.join(outDir, 'index.json');
const previous = fs.existsSync(indexPath) ? (JSON.parse(fs.readFileSync(indexPath, 'utf8')).assets ?? []) : [];
const merged = [...previous.filter((entry) => !prepared.some((p) => p.name === entry.name)), ...prepared];
fs.writeFileSync(indexPath, `${JSON.stringify({ assets: merged }, null, 2)}\n`);
for (const item of prepared) {
  console.log(`${item.name.padEnd(12)} ${item.kind === 'clip' ? `${item.count} frames ${item.cols}x${item.rows}` : item.src}`);
}
