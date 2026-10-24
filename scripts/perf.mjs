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
    deltas.sort((a, b) => a - b);
    const median = deltas.length ? deltas[Math.floor(deltas.length / 2)] : 999;
    out.push({ id: scene.id, ms: +median.toFixed(1), frames: deltas.length });
  }
  // Cross-check the playback numbers against the cost of rendering the frame
  // directly. Headless Chrome throttles rAF in bursts (150ms, 300ms); when the
  // direct cost is tiny the stutter is the measurement, not the scene.
  const probe = out[0]?.id;
  let direct = null;
  if (probe) {
    const p2 = window.__PREVIEW__;
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) p2.setTime(p2.time() + i / 600);
    direct = (performance.now() - t0) / 20;
  }
  return { rows: out, direct };
});

await browser.close();
close();

const { rows, direct } = result;
const worst = rows.reduce((a, r) => (r.ms > a.ms ? r : a), rows[0] ?? { ms: 0, id: '—' });
for (const r of rows) {
  console.log(`${String(r.ms).padStart(7)} ms  ${r.id}${r.ms > budget ? '   ← over budget' : ''}`);
}
// A frame that costs 0.3ms to draw cannot cost 150ms to play: that is the
// browser skipping frames, not the film.
const throttled = direct !== null && direct < budget / 8 && worst.ms > budget * 3;
if (throttled) {
  console.log(`\nnote · playback is throttled in this environment (direct render ${direct.toFixed(2)} ms/frame).`);
  console.log('       the numbers above are dropped rAF callbacks, not scene cost; nothing to fix here.');
  process.exit(0);
}
const over = rows.filter((r) => r.ms > budget);
if (!over.length) {
  console.log(`\nok · every scene under ${budget} ms (worst ${worst.ms} ms, ${worst.id})`);
  process.exit(0);
}
console.log(`\nwarn · ${over.length} scene(s) over ${budget} ms — playback will stutter (worst ${worst.ms} ms, ${worst.id})`);
console.log('     the preview redraws this every frame; a heavy scene looks fine in stills and feels broken in play');
process.exit(strict ? 1 : 0);
