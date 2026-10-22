#!/usr/bin/env node
// Values gate: numbers that are content. They format for display, drive a chart,
// are editable from the panel, and persist through the same write layer.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';
import { formatValue } from '../src/values.mjs';
import { setProjectValue } from '../src/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

// --- formatting ---
check('int formats with a suffix', formatValue(21, { format: 'int', suffix: ' km/h' }) === '21 km/h', formatValue(21, { format: 'int', suffix: ' km/h' }));
check('percent scales by 100', formatValue(0.421, { format: 'percent' }) === '42%', formatValue(0.421, { format: 'percent' }));
check('decimal keeps places', formatValue(3.14159, { format: 'decimal', places: 2 }) === '3.14');
check('compact shortens thousands', formatValue(12500, { format: 'compact' }) === '12.5k', formatValue(12500, { format: 'compact' }));

// --- write layer, against a throwaway project root ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-values-'));
fs.copyFileSync(path.join(ROOT, 'fixtures/timeline-values.json'), path.join(tmp, 'timeline.json'));
try {
  const saved = await setProjectValue(tmp, 'data-lab', 'speed', 100);
  const written = JSON.parse(fs.readFileSync(path.join(tmp, 'timeline.json'), 'utf8'));
  check('a value write lands in timeline.values', written.values?.['data-lab']?.speed === 100, JSON.stringify(written.values));
  check('the write keeps a snapshot', fs.existsSync(path.join(tmp, '.motion/snapshots', `${saved.snapshot.id}.json`)), saved.snapshot?.reason);

  let rangeError = '';
  try {
    await setProjectValue(tmp, 'data-lab', 'speed', 999);
  } catch (err) {
    rangeError = err.message;
  }
  check('an out-of-range value is refused', /must be 0\.\.200/.test(rangeError), rangeError || 'accepted');

  let unknownError = '';
  try {
    await setProjectValue(tmp, 'data-lab', 'nope', 1);
  } catch (err) {
    unknownError = err.message;
  }
  check('an unknown value key is refused', /unknown value/.test(unknownError), unknownError || 'accepted');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

// --- kernel + panel ---
const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${origin}/preview.html?timeline=./fixtures/timeline-values.json`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await page.evaluate(() => window.__PREVIEW__.setTime(1));

  const texts = await page.evaluate(() => window.__PREVIEW__.texts());
  const values = texts.filter((t) => t.kind === 'value');
  const speed = values.filter((v) => v.key === 'speed');
  check('values register like slots', speed.length === 2 && values.some((v) => v.key === 'growth'), `${values.length} value rows`);
  check('the value is formatted for display', speed[0]?.text === '21 km/h', speed[0]?.text);

  const inputs = page.locator('#textList input[type="number"]');
  check('the panel renders number inputs', (await inputs.count()) === values.length, `${await inputs.count()} inputs`);

  const sum = ([r, g, b]) => r + g + b;
  const before = sum(await page.evaluate(() => window.__PREVIEW__.pixel(500, 740)));

  const first = page.locator('#textList input[data-text-slot="value:speed"]').first();
  await first.fill('100');
  await page.evaluate(() => document.activeElement.blur());
  await page.waitForTimeout(200);
  const after = sum(await page.evaluate(() => window.__PREVIEW__.pixel(500, 740)));
  check('changing the value grows the bar', after > before + 120, `${before} → ${after}`);

  const shown = await page.evaluate(() => window.__PREVIEW__.texts().filter((t) => t.key === 'speed').map((t) => t.text));
  check('every place showing the value updates', shown.every((t) => t === '100 km/h'), shown.join(' / '));

  const http = await fetch(`${origin}/api/values`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scene: 'ghost', key: 'speed', value: 1 }),
  });
  check('the API refuses an unknown scene', http.status === 400, String((await http.json()).error));
} finally {
  await browser.close();
  close();
}

finish();
