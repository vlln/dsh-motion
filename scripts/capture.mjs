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
// The film lives wherever the caller points us: a workspace's motion/ directory
// when a session renders, the package itself for `npm run video` and the gates.
const PROJECT = path.resolve(process.env.DSH_MOTION_PROJECT ?? ROOT);
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const has = (k) => argv.includes(`--${k}`);

// Which timeline to render. The panel passes the file it was opened with, so a
// fixture or a second project can be exported without touching timeline.json.
const timelinePath = path.resolve(PROJECT, opt('timeline', 'timeline.json'));
if (!timelinePath.startsWith(PROJECT + path.sep)) throw new Error(`timeline escapes the film: ${opt('timeline')}`);
const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf8'));


const { origin, close } = await startServer(0, { project: PROJECT });
const exe = findChromium();
const browser = await chromium.launch({ executablePath: exe, args: ['--hide-scrollbars'] });

const W = Number(opt('width', 1920));
const H = Number(opt('height', 1080));
// Supersampling: render the page at N× device scale, then scale back down in
// ffmpeg. Text is the reason — it is rasterised at capture resolution, so a 2×
// pass keeps glyph edges sharp at 1080p.
const supersample = Math.max(1, Math.min(2, Number(opt('supersample', 1))));
const dpr = Number(opt('dpr', supersample));
// Encoder quality and output height are separate knobs: CRF changes how much
// the same pixels are compressed, height changes how many pixels there are.
const crf = String(Math.max(0, Math.min(51, Number(opt('crf', 18)))));
const outHeight = Number(opt('out-height', 0));
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dpr });
page.on('pageerror', (e) => console.error('[page error]', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('[page]', m.text()));

const query = timelinePath === path.join(PROJECT, 'timeline.json') ? '' : `?timeline=${encodeURIComponent(`./${path.relative(PROJECT, timelinePath)}`)}`;
await page.goto(`${origin}/index.html${query}`);
await page.waitForFunction(() => window.__MOTION__?.ready === true, null, { timeout: 30000 });

const isVideo = has('video');
const out = path.resolve(PROJECT, opt('out', isVideo ? 'out/video.mp4' : 'out/out.png'));
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
  console.log(`sheet → ${path.relative(PROJECT, out)} (${ts.length} frames in ${path.relative(PROJECT, dir)})`);
  await browser.close();
  close();
  process.exit(0);
}

if (opt('still') !== undefined) {
  await renderAt(Number(opt('still')));
  await page.screenshot({ path: out });
  console.log(`still → ${path.relative(PROJECT, out)}`);
  await browser.close();
  close();
  process.exit(0);
}

if (!has('video')) {
  console.error('usage: --stills 0,3 | --still 7.5 | --video');
  process.exit(1);
}

const fps = Number(opt('fps', timeline.fps ?? 30));
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
    ...(() => {
      const filters = [];
      if (supersample > 1) filters.push(`scale=${W}:${H}:flags=lanczos`);
      if (outHeight && outHeight !== H) filters.push(`scale=-2:${outHeight}:flags=lanczos`);
      return filters.length ? ['-vf', filters.join(',')] : [];
    })(),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', crf,
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
    audio: path.resolve(PROJECT, timeline.audio.src),
    out,
    start: timeline.audio.start ?? 0,
    targetLufs: timeline.audio.targetLufs ?? -14,
    fadeOut: to - 0.5,
  });
  fs.rmSync(silent, { force: true });
  console.log(`audio → ${timeline.audio.src} (loudnorm ${timeline.audio.targetLufs ?? -14} LUFS)`);
}
console.log(`video → ${path.relative(PROJECT, out)}`);
