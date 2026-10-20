#!/usr/bin/env node
// Layout gate: every frame's text must sit inside the safe area, stay above a
// minimum size, and not overlap another text box. This automates the "text
// clipped / unreadable on a phone" item from the review checklist.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

const MARGIN = 60;     // px at the timeline's native size
const MIN_SIZE = 14;   // px; below this a caption is not readable in a phone-sized tile
const STEP = 0.5;

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page error]', e.message));

await page.goto(`${origin}/preview.html`);
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 20000 });

const { duration, width, height } = await page.evaluate(() => ({
  duration: window.__PREVIEW__.duration,
  width: 1920,
  height: 1080,
}));

const violations = [];
let boxes = 0;
let frames = 0;

for (let t = 0; t < duration; t += STEP) {
  const list = await page.evaluate((x) => window.__PREVIEW__.audit(x), t);
  frames++;
  boxes += list.length;
  for (const b of list) {
    const size = b.h;
    if (size < MIN_SIZE) violations.push(`${t.toFixed(1)}s small ${size.toFixed(0)}px "${b.text}"`);
    if (b.alpha <= 0.02) continue; // fully transparent text is not drawn
    if (b.x < MARGIN || b.y < MARGIN || b.x + b.w > width - MARGIN || b.y + b.h > height - MARGIN) {
      violations.push(
        `${t.toFixed(1)}s out-of-safe [${b.x.toFixed(0)},${b.y.toFixed(0)},${(b.x + b.w).toFixed(0)},${(b.y + b.h).toFixed(0)}] "${b.text}"`,
      );
    }
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const c = list[j];
      if (a.alpha <= 0.02 || c.alpha <= 0.02) continue;
      const ix = Math.max(0, Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x));
      const iy = Math.max(0, Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y));
      if (ix * iy > 8) violations.push(`${t.toFixed(1)}s overlap "${a.text}" × "${c.text}" (${Math.round(ix * iy)}px²)`);
    }
  }
}

check('audit saw text', boxes > 0, `${boxes} boxes over ${frames} frames`);
check('text stays in the safe area', !violations.some((v) => v.includes('out-of-safe')), violations.find((v) => v.includes('out-of-safe')) ?? '');
check('text is large enough', !violations.some((v) => v.includes('small')), violations.find((v) => v.includes('small')) ?? '');
check('text boxes do not overlap', !violations.some((v) => v.includes('overlap')), violations.find((v) => v.includes('overlap')) ?? '');

if (violations.length) {
  console.log('\nfirst violations:');
  for (const v of violations.slice(0, 8)) console.log(`  ${v}`);
}

await browser.close();
close();
finish();
