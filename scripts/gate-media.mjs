#!/usr/bin/env node
// Media gate: images and clip frames must load before the first frame, draw
// where asked, advance with t, be clickable, and fail loudly when the asset is
// missing or not prepared.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

// --- prep: negative controls ---
const run = (args, timeline) => {
  const file = path.join(os.tmpdir(), `media-gate-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify(timeline));
  try {
    return { code: 0, out: execFileSync(process.execPath, [path.join(ROOT, 'scripts/assets.mjs'), 'prep', '--timeline', file], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }) };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  } finally {
    fs.rmSync(file, { force: true });
  }
};

const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/timeline-media.json'), 'utf8'));
const traversal = run(null, { ...base, assets: { evil: { kind: 'image', src: '../../etc/passwd' } } });
const reason = (out) => (out.match(/Error: (.*)/) ?? [])[1] ?? out.trim().split('\n').pop();
check('prep refuses an asset that escapes the package', traversal.code !== 0 && /escapes/.test(traversal.out), reason(traversal.out));

const missing = run(null, { ...base, assets: { ghost: { kind: 'image', src: 'out/fixtures/nope.png' } } });
check('prep refuses a missing file', missing.code !== 0 && /not found/.test(missing.out), reason(missing.out));

// --- prep: the sheet ---
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/media/clipA.json'), 'utf8'));
check(
  'clip prep writes a sheet manifest',
  manifest.kind === 'clip' && manifest.count === 48 && manifest.cols === 8 && manifest.rows === 6 && manifest.fps === 24,
  `${manifest.count} frames ${manifest.cols}x${manifest.rows} @${manifest.fps}`,
);
check('clip sheet exists', fs.existsSync(path.join(ROOT, manifest.src)), manifest.src);

// --- render ---
const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${origin}/preview.html?timeline=./fixtures/timeline-media.json`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });

  const px = (x, y) => page.evaluate(([a, b]) => window.__PREVIEW__.pixel(a, b), [x, y]);
  const sum = ([r, g, b]) => r + g + b;

  // The fixture clip moves a white box 36 → 216 source px across t=0.2 → 1.2,
  // which lands at x≈305 then x≈811 in the 900px-wide draw box.
  await page.evaluate(() => window.__PREVIEW__.setTime(0.2));
  const early = sum(await px(305, 400));
  await page.evaluate(() => window.__PREVIEW__.setTime(1.2));
  const late = sum(await px(305, 400));
  check('the clip advances with t', early > late + 120, `${early} → ${late}`);

  const plate = await px(1420, 350);
  const nearGold = Math.abs(plate[0] - 0xe0) <= 4 && Math.abs(plate[1] - 0xb0) <= 4 && Math.abs(plate[2] - 0x40) <= 4;
  check('the image draws at its box', nearGold, plate.join(','));

  const clipHit = await page.evaluate(() => window.__PREVIEW__.pick(305, 400, 1.2));
  check('clicking a clip frame returns the clip node', clipHit?.kind === 'clip' && clipHit.id === 'clip-clipA', JSON.stringify(clipHit));

  const imageHit = await page.evaluate(() => window.__PREVIEW__.pick(1420, 350, 1.2));
  check('clicking the image returns the image node', imageHit?.kind === 'image' && imageHit.id === 'image-plate', JSON.stringify(imageHit));

  await page.evaluate(() => window.__PREVIEW__.setTime(1.0));
  const a = await px(600, 300);
  await page.evaluate(() => window.__PREVIEW__.setTime(1.0));
  const b = await px(600, 300);
  check('the same frame renders identically twice', JSON.stringify(a) === JSON.stringify(b), `${a} vs ${b}`);

  // --- missing asset: loud failure, no blank frame ---
  const broken = await browser.newPage();
  const brokenErrors = [];
  broken.on('pageerror', (e) => brokenErrors.push(e.message));
  await broken.goto(`${origin}/preview.html?timeline=./fixtures/timeline-media-broken.json`);
  await broken.waitForTimeout(1200);
  const ready = await broken.evaluate(() => Boolean(window.__PREVIEW__?.ready)).catch(() => false);
  check(
    'a missing image fails loudly instead of rendering a blank frame',
    ready === false && brokenErrors.some((m) => /HTTP 404|media "/.test(m)),
    brokenErrors[0] ?? 'no page error',
  );
  await broken.close();

  check('no page errors on the good timeline', errors.length === 0, errors[0] ?? '');
} finally {
  await browser.close();
  close();
}

finish();
