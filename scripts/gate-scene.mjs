#!/usr/bin/env node
// Scene gate: length and speed are editable from the panel, and changing a length
// reflows every later scene plus the total duration.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';
import { listSnapshots } from '../src/snapshots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'timeline.json');
const before = fs.readFileSync(FILE, 'utf8');
const hadMeta = fs.existsSync(path.join(ROOT, '.snapshots'));
const snapsBefore = new Set(listSnapshots(ROOT).map((s) => s.id));

const { check, finish } = createGate();
const read = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (predicate, ms = 6000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (predicate()) return true;
    await sleep(50);
  }
  return false;
};

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.addInitScript(() => localStorage.setItem('dshm:tweaks', '1'));
  await page.goto(`${origin}/preview.html`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });

  const len = page.locator('#sceneLen');
  check('the scene card shows the current length', (await len.inputValue()) === '8', await len.inputValue());

  const failed = [];
  page.on('requestfailed', (r) => failed.push(r.url()));

  await len.fill('6');
  await len.dispatchEvent('change');
  const reflowed = await until(() => read().scenes[0].length === 6);
  check('changing the length writes the file', reflowed, String(read().scenes[0].length));

  const timeline = read();
  check('later scenes move up', Math.abs(timeline.scenes[1].start - 6) < 0.001, `scene 2 starts at ${timeline.scenes[1].start}`);
  check('the duration follows', Math.abs(timeline.duration - 17) < 0.001, `${timeline.duration}s`);

  const created = listSnapshots(ROOT).filter((s) => !snapsBefore.has(s.id));
  check('the previous timeline is kept', created.some((s) => s.reason === 'scene-first-peoples'), created.map((s) => s.reason).join(', ') || 'none');

  // --- rename, and prev/next through the strip ---
  const nameInput = page.locator('#sceneNameInput');
  await nameInput.fill('Renamed scene');
  await nameInput.dispatchEvent('change');
  const renamed = await until(() => read().scenes[0].name === 'Renamed scene');
  check('a scene can be renamed from the panel', renamed, read().scenes[0].name);
  const chipText = await page.locator('.chip').first().textContent();
  check('the chip follows the new name', (chipText ?? '').includes('Renamed scene'), chipText ?? '');

  const nextStart = read().scenes[1].start;
  await page.click('#nextScene');
  const atNext = await until(async () => Math.abs((await page.evaluate(() => window.__PREVIEW__.time())) - nextStart) < 0.01);
  check('next jumps to the next scene', atNext, String(await page.evaluate(() => window.__PREVIEW__.time())));
  await page.click('#prevScene');
  const back = await until(async () => (await page.evaluate(() => window.__PREVIEW__.time())) < 0.01);
  check('prev comes back', back, String(await page.evaluate(() => window.__PREVIEW__.time())));

  // --- a scene can be deleted from its chip menu ---
  const beforeDelete = read().scenes.length;
  const doomed = read().scenes[1].id;
  const target = page.locator(`.chip[data-scene="${doomed}"]`);
  await target.hover();
  await target.locator('.chip-more').click();
  await page.locator('#chipDelete').click();
  const gone = await until(() => read().scenes.length === beforeDelete - 1);
  check('a scene can be deleted from its chip menu', gone, `${read().scenes.length} left`);
  check('the survivors close the gap', read().scenes[0].start === 0 && read().scenes[1].start === read().scenes[0].length, JSON.stringify(read().scenes.map((s) => s.start)));
  check('the deletion leaves no orphan text', !read().texts?.[doomed], JSON.stringify(Object.keys(read().texts ?? {})));
  const chipGone = await until(async () => (await page.locator(`.chip[data-scene="${doomed}"]`).count()) === 0, 3000);
  check('the chip is gone', chipGone);

  // --- negative: a bad speed is refused ---
  const bad = await fetch(`${origin}/api/scene`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scene: 'first-peoples', speed: 3 }),
  });
  check('an invalid speed is refused', bad.status === 400, String((await bad.json()).error));

  const missing = await fetch(`${origin}/api/scene`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scene: 'nope', length: 5 }),
  });
  check('an unknown scene is refused', missing.status === 400, String((await missing.json()).error));
} finally {
  await browser.close();
  close();
  fs.writeFileSync(FILE, before);
  for (const snap of listSnapshots(ROOT)) {
    if (snapsBefore.has(snap.id)) continue;
    fs.rmSync(path.join(ROOT, '.snapshots', `${snap.id}.json`), { force: true });
  }
  if (!hadMeta) fs.rmSync(path.join(ROOT, '.snapshots'), { recursive: true, force: true });
}

finish();
