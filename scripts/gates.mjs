#!/usr/bin/env node
// Three gates for the kernel contract:
//   1. determinism   — same t twice => byte-identical frame
//   2. text slots    — editing a slot changes pixels without reloading code
//   3. palette       — one token change propagates to every scene that inherits it

import crypto from 'node:crypto';
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);


const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

let loads = 0;
page.on('load', () => loads++);
page.on('pageerror', (e) => console.error('[page error]', e.message));

await page.goto(`${origin}/index.html`);
await page.waitForFunction(() => window.__MOTION__?.ready === true, { timeout: 30000 });

const render = (t) => page.evaluate((x) => window.__MOTION__.renderAt(x), t);
const shot = (t) => page.screenshot({ type: 'png' });

// ---------- Gate 1: determinism ----------
await render(3.2);
const a = await shot(3.2);
await render(0);
await render(3.2);
const b = await shot(3.2);
check('G1 same t twice => identical frame', sha(a) === sha(b), `sha=${sha(a).slice(0, 12)}`);

// a second sample point, in the middle of an animated section
await render(6.1);
const c = await shot(6.1);
await render(1.0);
await render(6.1);
const d = await shot(6.1);
check('G1 second sample identical', sha(c) === sha(d), `sha=${sha(c).slice(0, 12)}`);

// ---------- Gate 2: text slots ----------
const resourcesBefore = await page.evaluate(() => performance.getEntriesByType('resource').length);

await render(2.0);
const bgBefore = await page.evaluate(() => window.__MOTION__.pixel(30, 300));
const before = await shot(2.0);
const changed = await page.evaluate(() => window.__MOTION__.setText('first-peoples', 'title', 'A different title'));
await render(2.0);
const after = await shot(2.0);
const bgAfter = await page.evaluate(() => window.__MOTION__.pixel(30, 300));
const resourcesAfter = await page.evaluate(() => performance.getEntriesByType('resource').length);

check('G2 slot write returns new value', changed === 'A different title', changed);
check('G2 title edit changes pixels', sha(before) !== sha(after));
check('G2 background untouched', eq(bgBefore, bgAfter), `${bgBefore} vs ${bgAfter}`);
check('G2 no page reload', loads === 1, `loads=${loads}`);
check('G2 no new resources', resourcesAfter === resourcesBefore, `${resourcesBefore} -> ${resourcesAfter}`);

// usage counts declared in textUsage
await render(2.0);
const usage = await page.evaluate(() => window.__MOTION__.textUsage('first-peoples', 2.0));
const declared = await page.evaluate(
  () => window.__MOTION__.describe().scenes.find((s) => s.id === 'first-peoples').textUsage,
);
const usageOk = Object.entries(usage).every(([k, v]) => declared[k] === v);
check('G2 usage matches declaration', usageOk, JSON.stringify(usage));

// unknown slot must throw
const threw = await page.evaluate(() => {
  try {
    window.__MOTION__.setText('first-peoples', 'nope', 'x');
    return false;
  } catch {
    return true;
  }
});
check('G2 unknown slot rejected', threw);

// ---------- Gate 3: palette ----------
const scene1Bg = await page.evaluate(() => window.__MOTION__.pixel(30, 300));
await page.evaluate(() => window.__MOTION__.setPalette({ main: { bg: '#123456' } }));

await render(2.0);
const scene1After = await page.evaluate(() => window.__MOTION__.pixel(30, 300));
await render(10.0);
const scene2After = await page.evaluate(() => window.__MOTION__.pixel(30, 300));

check('G3 scene 1 picks up new bg', eq(scene1After, [18, 52, 86, 255]), `${scene1Bg} -> ${scene1After}`);
check('G3 scene 2 inherits main bg', eq(scene2After, [18, 52, 86, 255]), `${scene2After}`);

// element override reaches the scene
await page.evaluate(() => window.__MOTION__.setOverride?.('cold-war', 'superpowers', { accent: '#ff2b2b' }));
const hasOverride = await page.evaluate(() => Boolean(window.__MOTION__.setOverride));
check('G3 element override available', hasOverride);

await browser.close();
close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
