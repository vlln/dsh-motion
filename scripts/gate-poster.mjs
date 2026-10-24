#!/usr/bin/env node
// Poster gate: the cover is a number the user can set from the frame they are
// looking at, validated, snapshotted, and used when a template-made film opens.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/dsh-motion.mjs');
const { check, finish } = createGate();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-poster-'));
execFileSync(process.execPath, [BIN, 'init', '--template', 'kinetic'], { cwd: tmp });
const file = path.join(tmp, 'motion/timeline.json');
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));

const { origin, close } = await startServer(0, { project: path.join(tmp, 'motion') });
try {
  const first = await (
    await fetch(`${origin}/api/poster`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ time: 2.5 }),
    })
  ).json();
  check('the api stores a cover time', first.poster === 2.5, JSON.stringify(first));
  check('the file carries it', read().poster === 2.5, String(read().poster));

  const bad = await fetch(`${origin}/api/poster`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ time: 99 }),
  });
  check('an out-of-range cover is refused', bad.status === 400, String(bad.status));

  const snaps = fs.existsSync(path.join(tmp, 'motion/.snapshots')) ? fs.readdirSync(path.join(tmp, 'motion/.snapshots')) : [];
  check('the write left a snapshot', snaps.some((name) => name.includes('-poster')), snaps.slice(0, 2).join(','));

  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 460, height: 1000 } });
  await page.goto(`${origin}/preview.html?from=template`, { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  const clock = await page.evaluate(() => document.querySelector('#tc')?.textContent);
  check('a template-made film opens on the cover', clock === '0:02.50', clock);
  await browser.close();
} finally {
  await new Promise((resolve) => {
    close();
    resolve();
  });
  fs.rmSync(tmp, { recursive: true, force: true });
}
finish();
