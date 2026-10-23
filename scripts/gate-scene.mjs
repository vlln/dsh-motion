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

  // The card may start open or closed; make sure it is open, like a user would.
  if (!(await page.locator('#scene').evaluate((el) => el.open))) {
    await page.locator('#scene > summary').click();
  }
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
