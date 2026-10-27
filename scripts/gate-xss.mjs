#!/usr/bin/env node
// Text from a film file is text, never markup.
//
// A scene name and a palette value both come from timeline.json, which an agent
// writes and a user can edit in the panel. Both used to be interpolated straight
// into innerHTML, so a name like <img src=x onerror=...> ran in the panel.
//
// The negative control is built in: this gate plants the payload, so if the
// escaping is ever removed the frame reports executed script.

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

const PAYLOAD = '<img src=x onerror="window.__pwned=(window.__pwned||0)+1">';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-xss-'));
const film = path.join(tmp, 'motion');
fs.mkdirSync(path.join(film, 'scenes'), { recursive: true });

fs.writeFileSync(
  path.join(film, 'scenes/s1.mjs'),
  `export const id = 's1';
export const kind = 'canvas2d';
export const slots = {};
let C;
export function mount(c) { C = c; }
export function render(t) {
  const g = C.canvas.getContext('2d');
  g.fillStyle = C.color('bg');
  g.fillRect(0, 0, C.w, C.h);
}
`,
);

const timeline = {
  width: 640,
  height: 360,
  fps: 30,
  duration: 2,
  palettes: { main: { bg: '#101010', fg: '#f0f0f0', accent: '#ff0000', muted: '#888888', grid: '#222222', panel: '#111111' } },
  overrides: {},
  texts: {},
  values: {},
  scenes: [{ id: 's1', name: PAYLOAD, start: 0, length: 2, palette: 'main' }],
};
fs.writeFileSync(path.join(film, 'timeline.json'), JSON.stringify(timeline, null, 2));

const { origin, close } = await startServer(0, { project: film });
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const dialogs = [];
page.on('dialog', (d) => {
  dialogs.push(d.type());
  d.dismiss();
});

try {
  await page.goto(`${origin}/preview.html`, { waitUntil: 'load' });
  await page.waitForTimeout(3500);

  const mounted = await page.evaluate(() => window.__PREVIEW__?.ready === true);
  check('the film actually mounted (otherwise nothing below is evidence)', mounted, String(mounted));
  if (!mounted) {
    await browser.close();
    close();
    fs.rmSync(tmp, { recursive: true, force: true });
    finish();
  }

  const pwned = await page.evaluate(() => window.__pwned ?? 0);
  check('the payload does not run', pwned === 0, `__pwned = ${pwned}`);
  check('no dialog was raised', dialogs.length === 0, dialogs.join(',') || 'none');

  // The name lands in the shot strip several times (label, aria-label, title).
  const seen = await page.evaluate(() => ({
    labels: [...document.querySelectorAll('.reel-seg, .chip-label')].map((el) => el.textContent + ' ' + (el.getAttribute('aria-label') ?? '')),
    injected: document.querySelectorAll('.reel-seg img, .chip-label img').length,
  }));
  check('the name is present as text', seen.labels.some((t) => t.includes('<img')), seen.labels.join(' | ').slice(0, 80));
  check('no element was created from the name', seen.injected === 0, `${seen.injected} <img> inside the strip`);
} finally {
  await browser.close();
  close();
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
