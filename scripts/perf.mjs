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
const project = path.resolve(opt('project', process.env.DSH_MOTION_PROJECT ?? ROOT));

// perf only reads: never mount the film's out/ (which lives outside the
// session sandbox when the film is another workspace's).
const { origin, close } = await startServer(0, { project });
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 900, height: 640 } });
await page.goto(`${origin}/preview.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, null, { timeout: 90000 });

const rows = await page.evaluate(async () => {
  const p = window.__PREVIEW__;
  const scenes = (await (await fetch('./timeline.json', { cache: 'no-store' })).json()).scenes;
  const out = [];
  for (const scene of scenes) {
    const times = [];
    for (let i = 0; i < 6; i++) {
      const at = scene.start + scene.length * (0.15 + i * 0.12);
      const t0 = performance.now();
      p.setTime(at);
      p.pixel(2, 2);              // force the frame to actually be drawn
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    out.push({ id: scene.id, ms: +times[3].toFixed(1), max: +times[5].toFixed(1) });
  }
  return out;
});

await browser.close();
close();

const worst = rows.reduce((a, r) => (r.ms > a.ms ? r : a), rows[0] ?? { ms: 0, id: '—' });
for (const r of rows) {
  console.log(`${String(r.ms).padStart(7)} ms  ${r.id}${r.ms > budget ? '   ← over budget' : ''}`);
}
console.log(`\nbudget ${budget} ms · worst ${worst.ms} ms (${worst.id})`);
process.exit(worst.ms > budget ? 1 : 0);
