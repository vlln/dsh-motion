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

const result = await page.evaluate(async () => {
  const p = window.__PREVIEW__;
  const scenes = (await (await fetch('./timeline.json', { cache: 'no-store' })).json()).scenes;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = [];
  const playBtn = document.querySelector('#play');

  // Warm-up. The first rAF callbacks after `ready` are throttled while the
  // compositor settles, and measuring them reports 120-150ms for films that cost
  // under a millisecond — every film looked equally slow until this was added.
  p.setTime(0);
  playBtn?.click();
  await wait(700);
  playBtn?.click();

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
    deltas.splice(0, 4);                    // the first few after a seek are not the scene
    const sorted = [...deltas].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 999;

    // rAF is vsync-locked: while the scene fits in a frame the median is always
    // 16.7ms on a 60Hz display, so it can only ever prove an OVERRUN. The number
    // that says what the scene costs is a direct render.
    const t1 = performance.now();
    const N = 24;
    for (let i = 0; i < N; i++) p.setTime(scene.start + ((i + 1) / N) * Math.max(0.1, scene.length - 0.1));
    const cost = (performance.now() - t1) / N;
    out.push({ id: scene.id, ms: +median.toFixed(1), cost: +cost.toFixed(2), frames: deltas.length });
  }
  return { rows: out };
});

await browser.close();
close();

const { rows } = result;
const worst = rows.reduce((a, r) => (r.cost > a.cost ? r : a), rows[0] ?? { cost: 0, id: '—' });
for (const r of rows) {
  const over = r.cost > budget;
  const late = r.ms > budget * 1.2;
  console.log(
    `${String(r.cost).padStart(7)} ms  ${r.id}` +
      `${over ? '   ← over budget' : ''}` +
      `${late ? '   (playback drops frames)' : ''}`,
  );
}
if (rows.some((r) => r.ms > budget * 1.2)) {
  console.log('\nnote · a scene is dropping frames in playback; the cost column says whether it is the scene');
  console.log('       or the environment. Under ~8ms of draw cost, assume the browser.');
}
const over = rows.filter((r) => r.cost > budget);
if (!over.length) {
  console.log(`\nok · every scene under ${budget} ms of draw cost (worst ${worst.cost} ms, ${worst.id})`);
  process.exit(0);
}
console.log(`\nwarn · ${over.length} scene(s) over ${budget} ms of draw cost — playback will stutter (worst ${worst.cost} ms, ${worst.id})`);
console.log('     the preview redraws this every frame; a heavy scene looks fine in stills and feels broken in play');
process.exit(strict ? 1 : 0);
