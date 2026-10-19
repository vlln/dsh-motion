#!/usr/bin/env node
// Capture a timeline to stills / contact sheet / mp4.
//
//   node scripts/capture.mjs --stills 0,3,6 --cols 3 --out out/sheet.png
//   node scripts/capture.mjs --video --out out/demo.mp4 [--fps 30] [--from 0] [--to 15]
//   node scripts/capture.mjs --still 7.5 --out out/frame.png

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { mux } from './mux.mjs';
import { findChromium } from './lib/chromium.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const has = (k) => argv.includes(`--${k}`);


const { origin, close } = await startServer();
const exe = findChromium();
const browser = await chromium.launch({ executablePath: exe, args: ['--hide-scrollbars'] });

const W = Number(opt('width', 1920));
const H = Number(opt('height', 1080));
const dpr = Number(opt('dpr', 1));
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
page.on('pageerror', (e) => console.error('[page error]', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));

await page.goto(`${origin}/index.html`);
await page.waitForFunction(() => window.__MOTION__?.ready === true, null, { timeout: 30000 });

const out = path.resolve(ROOT, opt('out', 'out/out.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });

async function renderAt(t) {
  await page.evaluate((x) => window.__MOTION__.renderAt(x), t);
}

const stillList = opt('stills');
if (stillList) {
  const ts = stillList.split(',').map(Number);
  const dir = out.replace(/\.(png|mp4)$/, '') + '-frames';
  fs.mkdirSync(dir, { recursive: true });
  for (const [i, t] of ts.entries()) {
    await renderAt(t);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(2, '0')}.png`) });
  }
  const cols = Math.min(ts.length, Number(opt('cols', 3)));
  const tw = Math.round(W * 0.4);
  const th = Math.round(H * 0.4);
  await new Promise((r) =>
    spawn(
      'ffmpeg',
      [
        '-loglevel', 'error', '-y',
        '-framerate', '1', '-i', path.join(dir, '%02d.png'),
        '-vf', `scale=${tw}:${th},tile=${cols}x${Math.ceil(ts.length / cols)}:padding=6:color=0x1a1a1a`,
        '-frames:v', '1', out,
      ],
      { stdio: 'inherit' },
    ).on('close', r),
  );
  console.log(`sheet → ${path.relative(ROOT, out)} (${ts.length} frames in ${path.relative(ROOT, dir)})`);
  await browser.close();
  close();
  process.exit(0);
}

if (opt('still') !== undefined) {
  await renderAt(Number(opt('still')));
  await page.screenshot({ path: out });
  console.log(`still → ${path.relative(ROOT, out)}`);
  await browser.close();
  close();
  process.exit(0);
}

if (!has('video')) {
  console.error('usage: --stills 0,3 | --still 7.5 | --video');
  process.exit(1);
}

const fps = Number(opt('fps', 30));
const from = Number(opt('from', 0));
const to = Number(opt('to', timeline.duration ?? 15));
const frames = Math.round((to - from) * fps);

const useAudio = Boolean(timeline.audio) && !has('no-audio');
const silent = useAudio ? out.replace(/\.mp4$/, '-silent.mp4') : out;

const ff = spawn(
  'ffmpeg',
  [
    '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', silent,
  ],
  { stdio: ['pipe', 'inherit', 'inherit'] },
);

const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  await renderAt(from + i / fps);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  if (i % fps === 0) {
    process.stdout.write(`\r${i}/${frames} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await browser.close();
close();
console.log(`\r${frames}/${frames} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);

if (useAudio) {
  await mux({
    silent,
    audio: path.resolve(ROOT, timeline.audio.src),
    out,
    start: timeline.audio.start ?? 0,
    targetLufs: timeline.audio.targetLufs ?? -14,
    fadeOut: to - 0.5,
  });
  fs.rmSync(silent, { force: true });
  console.log(`audio → ${timeline.audio.src} (loudnorm ${timeline.audio.targetLufs ?? -14} LUFS)`);
}
console.log(`video → ${path.relative(ROOT, out)}`);
