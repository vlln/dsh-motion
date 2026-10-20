#!/usr/bin/env node
// Split gate: a 2D-only timeline must never fetch the 3D chunk, and the default
// timeline must fetch it — the second half is the positive control for the tracker.

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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page error]', e.message));

const requests = [];
page.on('request', (r) => requests.push(r.url()));
const fetched3d = () => requests.some((u) => /orbit|chunks\//.test(u));

// --- 2D only ---
await page.goto(`${origin}/preview.html?timeline=./fixtures/timeline-2d.json`);
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 20000 });
const chips2d = await page.locator('.chip').count();
const dur2d = await page.evaluate(() => window.__PREVIEW__.duration);
check('2D timeline mounts', chips2d === 2 && Math.abs(dur2d - 15) < 0.01, `${chips2d} chips, ${dur2d}s`);
check('2D timeline never fetches the 3D chunk', !fetched3d(), requests.filter((u) => /orbit|chunks\//.test(u)).join(', '));

// --- positive control: the tracker can see a 3D load ---
requests.length = 0;
await page.goto(`${origin}/preview.html`);
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 20000 });
check('default timeline does fetch the 3D chunk', fetched3d());

await browser.close();
close();
finish();
