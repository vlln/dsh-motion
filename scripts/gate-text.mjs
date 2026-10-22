#!/usr/bin/env node
// Text gate: the primitive must break Chinese, keep English words whole, stay
// inside its box, be addressable by slot, and render identically twice.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';
import { layoutText, segments } from '../src/text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

// A deterministic stand-in for measureText: CJK counts 2, everything else 1.
const measure = (s) => [...s].reduce((n, ch) => n + (/[\u2e80-\u9fff]/.test(ch) ? 2 : 1), 0);

// --- pure layout ---
const zh = layoutText({ text: '把方法公开，因为我们需要让更多人看到这套流程', measure, maxWidth: 20 });
check('Chinese wraps into several lines', zh.lines.length >= 3, `${zh.lines.length} lines`);
check(
  'no line starts with closing punctuation',
  zh.lines.slice(1).every((line) => !'，。、；：）'.includes(line[0])),
  JSON.stringify(zh.lines),
);
check(
  'nothing is lost when wrapping',
  zh.lines.join('').replace(/\s+/g, '') === '把方法公开，因为我们需要让更多人看到这套流程',
);

const en = layoutText({ text: 'the quick brown fox jumps over the lazy dog', measure, maxWidth: 12 });
check(
  'English words are never split',
  en.lines.join(' ').replace(/\s+/g, ' ') === 'the quick brown fox jumps over the lazy dog' &&
    en.lines.every((line) => line.length > 0 && !line.startsWith(' ')),
  JSON.stringify(en.lines),
);

const cut = layoutText({ text: '把方法公开，因为我们需要让更多人看到这套流程', measure, maxWidth: 20, maxLines: 2 });
check(
  'truncation respects maxLines and shows an ellipsis',
  cut.truncated && cut.lines.length === 2 && cut.lines[1].endsWith('…'),
  JSON.stringify(cut.lines),
);

const openUnits = segments('（括号').map((u) => u.text);
const closeUnits = segments('括号）').map((u) => u.text);
check(
  'opening brackets never end a line, closing ones never start one',
  openUnits.every((u) => !'（【《「'.includes(u[u.length - 1])) && closeUnits.every((u) => !'）】》」'.includes(u[0])),
  JSON.stringify({ openUnits, closeUnits }),
);

// --- the primitive inside the kernel ---
const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${origin}/preview.html?timeline=./fixtures/timeline-text.json`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await page.evaluate(() => window.__PREVIEW__.setTime(1));

  const audit = await page.evaluate(() => window.__PREVIEW__.audit(1));
  const title = audit.filter((b) => b.slot === 'title');
  const body = audit.filter((b) => b.slot === 'body');

  check('drawText registers every line with its slot', title.length >= 2 && body.length >= 1, `${title.length} title lines · ${body.length} body lines`);
  check(
    'the Chinese title actually wrapped in the browser',
    title.length >= 2,
    title.map((b) => b.text).join(' / '),
  );

  const boxX = 1920 * 0.08;
  const boxW = 1920 * 0.6;
  check(
    'every line fits the requested box',
    title.every((b) => b.x >= boxX - 1 && b.x + b.w <= boxX + boxW + 1),
    title.map((b) => `${Math.round(b.x)}+${Math.round(b.w)}`).join(' '),
  );

  // The frame that audit() rendered is the one pick() can address.
  const first = title[0];
  const hit = await page.evaluate(
    ([x, y]) => window.__PREVIEW__.pick(x, y, 1),
    [first.x + first.w / 2, first.y + first.h / 2],
  );
  check('clicking text returns its slot', hit?.slot === 'title', JSON.stringify(hit));

  const miss = await page.evaluate(() => window.__PREVIEW__.pick(10, 10, 1));
  check('clicking empty space returns nothing', miss === null, JSON.stringify(miss));

  const twice = await page.evaluate(() => window.__PREVIEW__.audit(1));
  check(
    'the same frame lays out identically twice',
    JSON.stringify(twice) === JSON.stringify(audit),
    `${twice.length} boxes each`,
  );

  const doubled = audit.filter((b) => !b.slot && title.some((t) => t.text === b.text));
  check('drawText does not double-register in audit', doubled.length === 0, `${doubled.length} duplicates`);

  // --- legacy scenes still work: they draw with fillText and have no slots ---
  const legacy = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await legacy.goto(`${origin}/preview.html`);
  await legacy.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await legacy.evaluate(() => window.__PREVIEW__.setTime(4));
  const legacyBoxes = await legacy.evaluate(() => window.__PREVIEW__.audit(4));
  check('legacy fillText scenes still audit', legacyBoxes.length > 0, `${legacyBoxes.length} boxes`);
  await legacy.close();
} finally {
  await browser.close();
  close();
}

finish();
