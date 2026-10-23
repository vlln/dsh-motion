#!/usr/bin/env node
// Assets gate: an image on screen must be repointable at another file, live.
// Clips are refused on purpose — their sheet was baked, so a new source needs a
// new bake, and pretending otherwise would render the old frames.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';
import { rebakeAsset, setProjectAsset } from '../src/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

// --- write layer against a throwaway root ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-assets-'));
fs.copyFileSync(path.join(ROOT, 'fixtures/timeline-media.json'), path.join(tmp, 'timeline.json'));
// Asset paths are package-relative, so the throwaway root needs the fixtures too.
fs.cpSync(path.join(ROOT, 'out/fixtures'), path.join(tmp, 'out/fixtures'), { recursive: true });
fs.mkdirSync(path.join(tmp, 'scripts'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'scripts/assets.mjs'), path.join(tmp, 'scripts/assets.mjs'));
const attempt = async (fn) => {
  try {
    return { ok: true, value: await fn() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};
try {
  const saved = await attempt(() => setProjectAsset(tmp, 'plate', 'out/fixtures/plate2.png'));
  const written = JSON.parse(fs.readFileSync(path.join(tmp, 'timeline.json'), 'utf8'));
  check('an image asset repoints and persists', saved.ok && written.assets.plate.src === 'out/fixtures/plate2.png', saved.error ?? written.assets.plate.src);
  check('the repoint keeps a snapshot', saved.ok && fs.existsSync(path.join(tmp, '.snapshots', `${saved.value.snapshot.id}.json`)), saved.value?.snapshot?.reason);

  const escape = await attempt(() => setProjectAsset(tmp, 'plate', '../outside.png'));
  check('a path outside the package is refused', !escape.ok && /escapes/.test(escape.error), escape.error ?? 'accepted');

  const missing = await attempt(() => setProjectAsset(tmp, 'plate', 'out/fixtures/nope.png'));
  check('a missing file is refused', !missing.ok && /not found/.test(missing.error), missing.error ?? 'accepted');

  const clip = await attempt(() => setProjectAsset(tmp, 'clipA', 'out/fixtures/clip.mp4'));
  check('a clip refuses a path-only swap', !clip.ok && /re-run/.test(clip.error), clip.error ?? 'accepted');

  const ghost = await attempt(() => setProjectAsset(tmp, 'ghost', 'out/fixtures/plate.png'));
  check('an unknown asset is refused', !ghost.ok && /unknown asset/.test(ghost.error), ghost.error ?? 'accepted');

  // --- rebake: a new source is baked, not just recorded ---
  const baked = await attempt(() => rebakeAsset(tmp, 'clipA', 'out/fixtures/clip2.mp4'));
  const afterBake = JSON.parse(fs.readFileSync(path.join(tmp, 'timeline.json'), 'utf8'));
  check(
    'rebaking repoints the clip and bakes a new sheet',
    baked.ok && afterBake.assets.clipA.src === 'out/fixtures/clip2.mp4' && baked.value.manifest.count === 24,
    baked.error ?? `${baked.value?.manifest.count} frames`,
  );
  check('the new sheet is written', fs.existsSync(path.join(tmp, 'out/media/clipA.jpg')), 'out/media/clipA.jpg');

  const notVideo = await attempt(() => rebakeAsset(tmp, 'clipA', 'out/fixtures/plate.png'));
  check('rebaking a non-video is refused', !notVideo.ok && /not a video/.test(notVideo.error), notVideo.error ?? 'accepted');

  const imageBake = await attempt(() => rebakeAsset(tmp, 'plate'));
  check('rebaking an image is refused', !imageBake.ok && /only clips are baked/.test(imageBake.error), imageBake.error ?? 'accepted');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- the panel and the live redraw ---
const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${origin}/preview.html?timeline=./fixtures/timeline-media.json`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await page.evaluate(() => window.__PREVIEW__.setTime(1));

  const listed = await page.evaluate(() => window.__PREVIEW__.assets());
  check('the panel lists what is on screen', listed.length === 2, listed.map((a) => `${a.name}:${a.kind}`).join(', '));

  const clipInput = page.locator('#assetList input[data-asset-name="clipA"]');
  const plateInput = page.locator('#assetList input[data-asset-name="plate"]');
  check('clip sources are editable again, but only through a rebake', await clipInput.isEnabled(), 'enabled');
  check('clips get a rebake button', (await page.locator('#assetList button[data-bake="clipA"]').count()) === 1, 'button present');
  check('images have no rebake button', (await page.locator('#assetList button[data-bake="plate"]').count()) === 0);
  check('image sources are editable', await plateInput.isEnabled(), 'enabled');

  const gold = await page.evaluate(() => window.__PREVIEW__.pixel(1420, 350));
  check('the fixture plate is gold to begin with', Math.abs(gold[0] - 0xe0) <= 4 && Math.abs(gold[1] - 0xb0) <= 4, gold.join(','));

  await page.evaluate(() => window.__PREVIEW__.setAssetSrc('plate', 'out/fixtures/plate2.png'));
  await page.waitForTimeout(150);
  const red = await page.evaluate(() => window.__PREVIEW__.pixel(1420, 350));
  check('repointing the image redraws the frame', Math.abs(red[0] - 0xd9) <= 4 && Math.abs(red[1] - 0x4a) <= 4, red.join(','));

  await page.evaluate(() => window.__PREVIEW__.setTime(1));
  check('the panel shows the new source', (await plateInput.inputValue()) === 'out/fixtures/plate2.png', await plateInput.inputValue());
} finally {
  await browser.close();
  close();
}

finish();
