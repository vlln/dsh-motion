#!/usr/bin/env node
// UI gate: scene strip seeks, scrubber syncs, element click selects, play advances.
// Coordinates for the pin come from the scene layout, not from the app's own pick().

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();


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
// Sample the title band instead of one point: a single pixel can land in the gap
// between glyphs and call a good frame blank.
const sample = await page.evaluate(() => {
  const corner = window.__PREVIEW__.pixel(20, 20);
  const points = [
    [165, 235], [200, 250], [260, 270], [340, 240], [430, 260],
  ].map(([x, y]) => window.__PREVIEW__.pixel(x, y));
  return { painted: points.filter((p) => JSON.stringify(p) !== JSON.stringify(corner)).length, corner };
});
check('frame 0 is not blank', sample.painted >= 1, `${sample.painted}/5 points painted`);

// --- scene strip ---
await page.click('[data-scene="cold-war"]');
await page.waitForTimeout(120);
const tChip = await time();
check('chip click seeks into scene', tChip >= 8 && tChip < 15, `${tChip.toFixed(3)}s · ${await tc()}`);
check('timecode follows chip seek', (await tc()).startsWith('0:08'), await tc());
const active = await page.getAttribute('[data-scene="cold-war"]', 'aria-current');
check('active chip highlighted', active === 'true');

// --- the strip is the scrubber (there is no separate progress bar) ---
check('no separate scrub bar exists', (await page.locator('#scrub').count()) === 0);
const strip = await page.locator('#scenes').boundingBox();
const total = await page.evaluate(() => window.__PREVIEW__.duration);
const y = strip.y + strip.height / 2;
await page.mouse.move(strip.x + 4, y);
await page.mouse.down();
await page.mouse.move(strip.x + (3 / total) * strip.width, y, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(120);
check('dragging the strip scrubs', Math.abs((await time()) - 3) < 0.25, `${(await time()).toFixed(2)}s · ${await tc()}`);

// --- the section overview above the film ---
const segCount = await page.locator('.reel-seg').count();
const sceneCount = await page.evaluate(() => window.__PREVIEW__.scenes().length);
check('the reel has one pill per scene', segCount === sceneCount, `${segCount} vs ${sceneCount}`);
await page.locator('.reel-seg').nth(1).click();
await page.waitForTimeout(120);
const segStart = await page.evaluate(() => window.__PREVIEW__.scenes()[1].start);
check('clicking a pill seeks to that scene', Math.abs((await time()) - segStart) < 0.05, `${(await time()).toFixed(2)}s vs ${segStart}`);
const doneCount = await page.locator('.reel-seg.done').count();
check('pills fill up to the current scene', doneCount === 2, String(doneCount));

// --- hovering the strip peeks at the frame ---
await page.mouse.move(strip.x + strip.width * 0.5, y);
await page.waitForTimeout(250);
check('hovering the strip shows a peek', await page.locator('#hoverFrame').isVisible());
await page.mouse.move(strip.x + strip.width * 0.5, strip.y - 80);
await page.waitForTimeout(150);
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

finish();
