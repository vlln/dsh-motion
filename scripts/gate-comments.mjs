#!/usr/bin/env node
// Comment loop gate:
//   drag a box -> write a note -> send to Claude -> tool returns anchor + crop
//   -> agent edits the text -> the frame changes -> reply + resolve

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const { check, finish } = createGate();


const timelinePath = path.join(ROOT, 'timeline.json');
const timelineBefore = fs.readFileSync(timelinePath, 'utf8');
fs.rmSync(path.join(ROOT, 'out/comments.json'), { force: true });
fs.rmSync(path.join(ROOT, 'out/comments'), { recursive: true, force: true });

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page error]', e.message));

await page.goto(`${origin}/preview.html`);
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
await page.evaluate(() => window.__PREVIEW__.setTime(3.2));

// --- drag a box over the title ---
const box = await page.evaluate(() => window.__PREVIEW__.boxRect());
const W = 1920;
const H = 1080;
const toClient = (x, y) => ({ x: box.left + (x / W) * box.width, y: box.top + (y / H) * box.height });
const p0 = toClient(150, 235);
const p1 = toClient(720, 335);
await page.mouse.move(p0.x, p0.y);
await page.mouse.down();
await page.mouse.move((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, { steps: 6 });
await page.mouse.move(p1.x, p1.y, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(120);

check('drag opens the comment popover', (await page.isVisible('#popover')) === true);
const popTitle = await page.textContent('#popT');
check('popover shows time and size', /0:03/.test(popTitle) && /×/.test(popTitle), popTitle);

await page.fill('#popText', '把标题改成更短的说法');
await page.click('#popSubmit');
await page.waitForTimeout(400);

const threads = await page.evaluate(async () => (await (await fetch('/api/comments')).json()).threads);
check('comment stored', threads.length === 1, `${threads.length} thread(s)`);
const th = threads[0];
check('anchor has time', Math.abs(th.anchor.t - 3.2) < 0.05, `${th.anchor.t}`);
check('anchor has rect', th.anchor.rect && th.anchor.rect.w > 400 && th.anchor.rect.h > 60, JSON.stringify(th.anchor.rect));
check('thread is activated', th.activated === true);
check('thread listed in panel', (await page.textContent('#threadCount')) === '1');

await page.screenshot({ path: path.join(ROOT, 'out/ui-comments.png') });

// --- tool contract: list with crops ---
const listOut = execFileSync('node', ['scripts/comments.mjs', 'list', '--json', '--crops'], { cwd: ROOT, encoding: 'utf8' });
const listed = JSON.parse(listOut).threads;
check('tool lists the thread', listed.length === 1 && listed[0].id === th.id);
const cropPath = listed[0].crop;
check('tool produced a crop', Boolean(cropPath) && fs.existsSync(path.join(ROOT, cropPath)), cropPath ?? 'none');

// --- agent edits the text; the frame must change ---
await page.evaluate(() => window.__PREVIEW__.setTime(3.2));
const before = await page.screenshot();
execFileSync('node', ['scripts/texts.mjs', 'set', '--scene', 'first-peoples', '--slot', 'title', '--value', 'Edited via comment'], {
  cwd: ROOT,
  encoding: 'utf8',
});

await page.reload();
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
await page.evaluate(() => window.__PREVIEW__.setTime(3.2));
const after = await page.screenshot();
check('text edit changes the frame', sha(before) !== sha(after), `${sha(before).slice(0, 8)} -> ${sha(after).slice(0, 8)}`);

// invalid edit must be rejected by the tool
let rejected = false;
try {
  execFileSync('node', ['scripts/texts.mjs', 'set', '--scene', 'first-peoples', '--slot', 'nope', '--value', 'x'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
} catch {
  rejected = true;
}
check('tool rejects unknown slot', rejected);

// --- reply + resolve ---
execFileSync('node', ['scripts/comments.mjs', 'reply', '--id', th.id, '--text', '改好了，见当前帧'], { cwd: ROOT, encoding: 'utf8' });
execFileSync('node', ['scripts/comments.mjs', 'resolve', '--id', th.id], { cwd: ROOT, encoding: 'utf8' });
const stored = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/comments.json'), 'utf8')).threads[0];
check('reply appended', stored.messages.length === 2 && stored.messages[1].role === 'claude');
check('thread resolved', stored.status === 'resolved');

await browser.close();
close();
fs.writeFileSync(timelinePath, timelineBefore);  // the gate edits text; restore it

finish();
