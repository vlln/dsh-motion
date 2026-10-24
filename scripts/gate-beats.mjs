#!/usr/bin/env node
// Beat gate: when a film came from a reference, hovering a scene chip must show
// that beat's still — the reference and the timeline line up on screen.
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

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-beats-'));
const { origin, close } = await startServer(0, { project: path.join(tmp, 'motion') });

try {
  execFileSync(process.execPath, [BIN, 'init', '--template', 'kinetic'], { cwd: tmp });

  // A storyboard with one beat and its still, as `storyboard --write` leaves it.
  const ref = path.join(tmp, 'motion/out/ref');
  fs.mkdirSync(path.join(ref, 'beats'), { recursive: true });
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=lime:s=64x64', '-frames:v', '1', path.join(ref, 'beats/beat01.png')]);
  fs.writeFileSync(
    path.join(ref, 'storyboard.json'),
    `${JSON.stringify({ beats: [{ index: 1, name: 'Beat 01', start: 0, length: 6, still: 'out/ref/beats/beat01.png' }] }, null, 2)}\n`,
  );

  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 460, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${origin}/preview.html`, { waitUntil: 'load' });
  await page.waitForTimeout(2200);

  check('the chip knows its still', (await page.locator('.chip').first().getAttribute('data-still')) === 'out/ref/beats/beat01.png', 'data-still');
  check('the peek starts hidden', await page.evaluate(() => document.getElementById('beatPeek').hidden), 'hidden');

  await page.locator('.chip').first().hover();
  await page.waitForTimeout(400);
  const peek = await page.evaluate(() => {
    const el = document.getElementById('beatPeek');
    return { hidden: el.hidden, src: el.querySelector('img').getAttribute('src') };
  });
  check('hover shows the peek', peek.hidden === false, JSON.stringify(peek.hidden));
  check('the peek points at the beat still', peek.src?.endsWith('out/ref/beats/beat01.png'), peek.src);

  await page.mouse.move(5, 5);
  await page.waitForTimeout(300);
  check('leaving hides it', await page.evaluate(() => document.getElementById('beatPeek').hidden), 'hidden again');
  check('no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await browser.close();
} finally {
  await new Promise((resolve) => {
    close();
    resolve();
  });
  fs.rmSync(tmp, { recursive: true, force: true });
}
finish();
