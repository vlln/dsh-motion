#!/usr/bin/env node
// UI gate: scene strip seeks, scrubber syncs, element click selects, play advances.
// Coordinates for the pin come from the scene layout, not from the app's own pick().

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const dir of fs.existsSync(base) ? fs.readdirSync(base).filter((d) => d.startsWith('chromium-')) : []) {
    for (const arch of ['chrome-mac', 'chrome-mac-arm64']) {
      for (const app of ['Chromium', 'Google Chrome for Testing']) {
        const p = path.join(base, dir, arch, `${app}.app`, 'Contents', 'MacOS', app);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page error]', e.message));

await page.goto(`${origin}/preview.html`);
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });

const tc = () => page.textContent('#tc');
const time = () => page.evaluate(() => window.__PREVIEW__.time());

check('initial time is 0', (await time()) === 0, await tc());
const frame0 = await page.screenshot();
const sample = await page.evaluate(() => ({
  title: window.__PREVIEW__.pixel(220, 250),
  corner: window.__PREVIEW__.pixel(20, 20),
}));
check('frame 0 is not blank', JSON.stringify(sample.title) !== JSON.stringify(sample.corner), JSON.stringify(sample.title));

// --- scene strip ---
await page.click('[data-scene="cold-war"]');
await page.waitForTimeout(120);
const tChip = await time();
check('chip click seeks into scene', tChip >= 8 && tChip < 15, `${tChip.toFixed(3)}s · ${await tc()}`);
check('timecode follows chip seek', (await tc()).startsWith('0:08'), await tc());
const active = await page.getAttribute('[data-scene="cold-war"]', 'aria-current');
check('active chip highlighted', active === 'true');

// --- scrubber ---
await page.evaluate(() => {
  const el = document.getElementById('scrub');
  el.value = '3';
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
await page.waitForTimeout(80);
check('scrubber sets time', Math.abs((await time()) - 3) < 0.05, `${(await time()).toFixed(2)}s · ${await tc()}`);
const headLeft = await page.evaluate(() => parseFloat(document.getElementById('playhead').style.left));
const expectedLeft = ((await time()) / 19) * 100;
check('playhead position tracks time', Math.abs(headLeft - expectedLeft) < 0.05, `${headLeft}% vs ${expectedLeft.toFixed(3)}%`);

// --- element inspector (coordinates from scene layout, not from pick()) ---
const W = 1920;
const H = 1080;
const axisY = H * 0.68;
const x0 = W * 0.08;
const x1 = W * 0.92;
const cardW = W * 0.3;
const cardH = H * 0.118;
const px = x0 + (x1 - x0) * 0.3;
const cardY = axisY - H * 0.14;
const rect = await page.evaluate(() => window.__PREVIEW__.boxRect());
const clickX = rect.left + (px / W) * rect.width;
const clickY = rect.top + ((cardY + cardH / 2) / H) * rect.height;

await page.evaluate(() => window.__PREVIEW__.setTime(4));
await page.mouse.click(clickX, clickY);
await page.waitForTimeout(80);

const inspectorText = await page.textContent('#inspector');
const boxHidden = await page.evaluate(() => document.getElementById('selection').hidden);
const picked = await page.evaluate(() => window.__PREVIEW__.selected());
check('click selects an element', Boolean(picked), picked ? picked.id : 'none');
check('inspector shows geometry', /x \/ y/.test(inspectorText) && /w × h/.test(inspectorText));
check('selection box visible', boxHidden === false);

await page.screenshot({ path: path.join(ROOT, 'out/ui-selection.png') });

// --- playback ---
await page.click('#play');
await page.waitForTimeout(450);
const tPlay = await time();
await page.click('#play');
check('play advances time', tPlay > 4.1, `${tPlay.toFixed(2)}s`);
check('pause stops playback', await page.evaluate(() => document.getElementById('mode').textContent === 'paused'));

await page.evaluate(() => window.__PREVIEW__.setTime(4.5));
await page.waitForTimeout(150);
await page.screenshot({ path: path.join(ROOT, 'out/ui-panel.png') });

await browser.close();
close();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
