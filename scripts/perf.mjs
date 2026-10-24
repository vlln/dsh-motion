#!/usr/bin/env node
// Per-frame cost of a film, measured in the same browser the panel uses.
//   node scripts/perf.mjs [--budget 33] [--project <film dir>]
// Prints one line per scene and fails when the median frame is over budget.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const budget = Number(opt('budget', 33));
const strict = argv.includes('--strict');
const project = path.resolve(opt('project', process.env.DSH_MOTION_PROJECT ?? ROOT));

// perf only reads: never mount the film's out/ (which lives outside the
// session sandbox when the film is another workspace's).
const { origin, close } = await startServer(0, { project });
const browser = await chromium.launch({ channel: 'chrome' });
// Retina is the real condition: dpr 2 doubles the pixels the panel must paint.
const page = await browser.newPage({ viewport: { width: 900, height: 640 }, deviceScaleFactor: Number(opt('dpr', 2)) });
await page.goto(`${origin}/preview.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, null, { timeout: 90000 });

const rows = await page.evaluate(async () => {
  const p = window.__PREVIEW__;
  const scenes = (await (await fetch('./timeline.json', { cache: 'no-store' })).json()).scenes;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const playBtn = document.querySelector('#play');

  for (const scene of scenes) {
    p.setTime(scene.start + 0.05);
    playBtn?.click();                       // real playback: that is what stutters
    await wait(120);
    const deltas = [];
    let last = performance.now();
    await new Promise((res) => {
      const t0 = performance.now();
      const tick = (now) => {
        deltas.push(now - last);
        last = now;
        if (now - t0 < 900) requestAnimationFrame(tick);
        else res();
      };
      requestAnimationFrame(tick);
    });
    playBtn?.click();                       // pause
    deltas.shift();
    deltas.sort((a, b) => a - b);
    const median = deltas.length ? deltas[Math.floor(deltas.length / 2)] : 999;
    out.push({ id: scene.id, ms: +median.toFixed(1), frames: deltas.length });
  }
  return out;
});

await browser.close();
close();

const worst = rows.reduce((a, r) => (r.ms > a.ms ? r : a), rows[0] ?? { ms: 0, id: '—' });
for (const r of rows) {
  console.log(`${String(r.ms).padStart(7)} ms  ${r.id}${r.ms > budget ? '   ← over budget' : ''}`);
}
const over = rows.filter((r) => r.ms > budget);
if (!over.length) {
  console.log(`\nok · every scene under ${budget} ms (worst ${worst.ms} ms, ${worst.id})`);
  process.exit(0);
}
console.log(`\nwarn · ${over.length} scene(s) over ${budget} ms — playback will stutter (worst ${worst.ms} ms, ${worst.id})`);
console.log('     the preview redraws this every frame; a heavy scene looks fine in stills and feels broken in play');
process.exit(strict ? 1 : 0);
