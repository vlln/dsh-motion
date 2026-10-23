#!/usr/bin/env node
// Tweaks gate: the panel must list the text actually on screen at the playhead,
// edit it in place, persist with a snapshot, and refuse an over-long value.

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
const hadMeta = fs.existsSync(path.join(ROOT, '.motion'));
const snapsBefore = new Set(listSnapshots(ROOT).map((s) => s.id));
const TOUR = path.join(ROOT, 'fixtures/timeline-tour.json');
const tourBefore = fs.readFileSync(TOUR, 'utf8');

const { check, finish } = createGate();
const read = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (predicate, ms = 4000) => {
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
  await page.goto(`${origin}/preview.html`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await page.evaluate(() => window.__PREVIEW__.setTime(4));

  const texts = await page.evaluate(() => window.__PREVIEW__.texts());
  const title = texts.find((t) => t.slot === 'title');
  check('the panel lists the text on screen at t', Boolean(title) && texts.length >= 3, texts.map((t) => t.slot).join(', '));

  const rows = await page.locator('#textList input').count();
  check('every on-screen slot gets an input', rows === texts.length, `${rows} inputs / ${texts.length} slots`);

  const input = page.locator('#textList input[data-text-slot="title"]');
  check('the title input carries the rendered text', (await input.inputValue()) === title.text, await input.inputValue());

  // Clicking the text on the canvas focuses the matching input.
  const rect = await page.evaluate(() => window.__PREVIEW__.boxRect());
  const cx = rect.left + ((title.box.x + title.box.w / 2) / 1920) * rect.width;
  const cy = rect.top + ((title.box.y + title.box.h / 2) / 1080) * rect.height;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(120);
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return el && el.dataset ? el.dataset.textSlot ?? null : null;
  });
  check('clicking text focuses its field', focused === 'title', String(focused));

  const sample = () =>
    page.evaluate(() => {
      const corner = window.__PREVIEW__.pixel(20, 20);
      const pts = [[165, 235], [200, 250], [260, 270], [340, 240], [430, 260]].map(([x, y]) => window.__PREVIEW__.pixel(x, y));
      return JSON.stringify({ pts, corner });
    });
  const pixelsBefore = await sample();

  const edited = '把方法公开，然后一起做';
  await input.fill(edited);
  // fill() fires input but not change: blur is what the panel listens to for persistence.
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(250);

  const live = await page.evaluate(() => window.__PREVIEW__.texts().find((t) => t.slot === 'title')?.text ?? '');
  check('typing updates the rendered frame', live === edited, live);

  const pixelsAfter = await sample();
  check('typing changes the pixels', pixelsAfter !== pixelsBefore);

  const saved = await until(() => read().texts?.['first-peoples']?.title === edited);
  check('blurring writes timeline.json', saved, String(read().texts?.['first-peoples']?.title));

  const created = listSnapshots(ROOT).filter((s) => !snapsBefore.has(s.id));
  check(
    'the write keeps the previous version',
    created.some((s) => s.reason === 'text-first-peoples-title'),
    created.map((s) => s.reason).join(', ') || 'none',
  );

  // --- negative: the slot's maxChars is enforced ---
  const long = 'x'.repeat(120);
  const res = await fetch(`${origin}/api/texts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scene: 'first-peoples', slot: 'title', value: long }),
  });
  const body = await res.json();
  check('an over-long value is rejected', res.status === 400 && /maxChars/.test(body.error ?? ''), body.error ?? res.status);
  check('the rejected write left the file alone', read().texts['first-peoples'].title === edited);

  // --- the page writes to the timeline it was opened with ---
  const rootAtTour = fs.readFileSync(FILE, 'utf8');
  const tourPage = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await tourPage.goto(`${origin}/preview.html?timeline=./fixtures/timeline-tour.json`);
  await tourPage.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await tourPage.evaluate(() => window.__PREVIEW__.setTime(2));
  const tourInput = tourPage.locator('#textList input[data-text-slot="title"]');
  await tourInput.fill('Tour title');
  await tourPage.evaluate(() => document.activeElement.blur());
  const tourSaved = await until(() => JSON.parse(fs.readFileSync(TOUR, 'utf8')).texts?.['first-peoples']?.title === 'Tour title');
  check('writes follow the timeline the page opened', tourSaved, JSON.parse(fs.readFileSync(TOUR, 'utf8')).texts?.['first-peoples']?.title ?? 'unchanged');
  check('the default timeline is untouched by a tour edit', fs.readFileSync(FILE, 'utf8') === rootAtTour);
  await tourPage.close();

  const ghost = await fetch(`${origin}/api/texts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scene: 'first-peoples', slot: 'nope', value: 'x' }),
  });
  check('an unknown slot is rejected', ghost.status === 400, String((await ghost.json()).error));
} finally {
  await browser.close();
  close();
  fs.writeFileSync(FILE, before);
  fs.writeFileSync(TOUR, tourBefore);
  for (const snap of listSnapshots(ROOT)) {
    if (snapsBefore.has(snap.id)) continue;
    fs.rmSync(path.join(ROOT, '.motion/snapshots', `${snap.id}.json`), { force: true });
  }
  if (!hadMeta) fs.rmSync(path.join(ROOT, '.motion'), { recursive: true, force: true });
}

finish();
