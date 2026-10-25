#!/usr/bin/env node
// Live gate: the agent edits the same files this panel reads. Data changes must
// appear without a reload; code changes cannot, so they raise a banner.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'timeline.json');
const before = fs.readFileSync(FILE, 'utf8');
const { check, finish } = createGate();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (predicate, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await predicate()) return true;
    await sleep(150);
  }
  return false;
};

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${origin}/preview.html`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await page.evaluate(() => window.__PREVIEW__.setTime(4));

  // The panel reloads itself when scene code changes, so a poll can land between
  // documents. A missing handle is "not yet", not a failure.
  const titleOf = async () => {
    try {
      return await page.evaluate(() => window.__PREVIEW__?.texts().find((t) => t.slot === 'title')?.text ?? '');
    } catch {
      // the document went away between the poll and the evaluate: not yet
      return '';
    }
  };
  check('the panel starts on the file', (await titleOf()) === 'The first peoples', await titleOf());

  // --- an outside write to the timeline shows up in place ---
  const timeline = JSON.parse(before);
  timeline.texts = { 'first-peoples': { title: 'Written from outside' } };
  fs.writeFileSync(FILE, `${JSON.stringify(timeline, null, 2)}\n`);

  const applied = await until(async () => (await titleOf()) === 'Written from outside');
  check('an outside timeline write appears without a reload', applied, await titleOf());
  check('the timecode did not move', Math.abs((await page.evaluate(() => window.__PREVIEW__.time())) - 4) < 0.01);
  check('a data change raises no banner', await page.locator('#stale').isHidden());

  // --- a scene-code change raises the banner instead of silently doing nothing ---
  fs.utimesSync(path.join(ROOT, 'scenes/text-lab.mjs'), new Date(), new Date());
  const banner = await until(async () => page.locator('#stale').isVisible(), 8000);
  check('a code change raises a refresh banner', banner);

  // --- restoring the file restores the panel ---
  fs.writeFileSync(FILE, before);
  const restored = await until(async () => (await titleOf()) === 'The first peoples');
  check('restoring the timeline restores the panel', restored, await titleOf());
} finally {
  await browser.close();
  close();
  fs.writeFileSync(FILE, before);
}

finish();
