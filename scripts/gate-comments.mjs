#!/usr/bin/env node
// Comment gate: a pin exists only after its sentence reached the conversation.
//   - standalone panel has no comment surface at all (nobody would read it)
//   - the API refuses a pin that was never sent
//   - a sent pin keeps its anchor, lists with a crop, and resolves
//   - the reply channel is gone: the agent answers in the chat

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';
import { listSnapshots } from '../src/snapshots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const { check, finish } = createGate();

const timelinePath = path.join(ROOT, 'timeline.json');
const timelineBefore = fs.readFileSync(timelinePath, 'utf8');
const snapsBefore = new Set(listSnapshots(ROOT).map((s) => s.id));
fs.rmSync(path.join(ROOT, 'out/comments.json'), { force: true });
fs.rmSync(path.join(ROOT, 'out/comments'), { recursive: true, force: true });

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[page error]', e.message));

await page.goto(`${origin}/preview.html`);
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
await page.evaluate(() => window.__PREVIEW__.setTime(3.2));

// --- no session, no comment surface ---
const surface = await page.evaluate(() => {
  return {
    list: Boolean(document.querySelector('.threads')),
    hasSubmit: Boolean(document.querySelector('#popSubmit')),
  };
});
// Standing alone there is no conversation to send to, and the list lives on the
// 批注 page now — the rail has no separate comment section any more.
const popoverHidden = await page.isHidden('#popover');
check('standalone opens no note card', surface.list === false && popoverHidden, JSON.stringify({ ...surface, popoverHidden }));

const box = await page.evaluate(() => window.__PREVIEW__.boxRect());
const toClient = (x, y) => ({ x: box.left + (x / 1920) * box.width, y: box.top + (y / 1080) * box.height });
const p0 = toClient(150, 235);
const p1 = toClient(720, 335);
await page.mouse.move(p0.x, p0.y);
await page.mouse.down();
await page.mouse.move(p1.x, p1.y, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(150);
check('dragging starts no comment box', (await page.isHidden('#popover')) === true);

// --- a pin needs a send ---
const refused = await page.evaluate(async () => {
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ anchor: { t: 3.2, rect: { x: 150, y: 235, w: 570, h: 100 } }, text: 'x' }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
});
check('a pin that was never sent is refused', refused.status === 400 && /sentAt/.test(refused.body.error ?? ''), refused.body.error ?? String(refused.status));

// --- a sent pin keeps its anchor ---
const created = await page.evaluate(async () => {
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'th_gate1',
      anchor: { t: 3.2, rect: { x: 150, y: 235, w: 570, h: 100 } },
      text: '把标题改成更短的说法',
      sentAt: new Date().toISOString(),
    }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
});
const th = created.body.thread ?? {};
check('a sent pin is stored', created.status === 201 && th.id === 'th_gate1', `${created.status} ${th.id ?? ''}`);
check('the anchor keeps time and rect', Math.abs((th.anchor?.t ?? 0) - 3.2) < 0.05 && th.anchor?.rect?.w === 570, JSON.stringify(th.anchor ?? null));

await page.reload();
await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
await page.click('#tweaksToggle'); // the rail starts closed
await page.locator('.rail-tab[data-tab="comments"]').click();
await page.waitForTimeout(400);
const listedText = await page.textContent('#allComments');
check('the pin is listed on the 批注 page', (await page.locator('.comment-row').count()) === 1 && listedText.includes('th') === false, (await page.locator('.comment-row').count()) + ' rows');
await page.screenshot({ path: path.join(ROOT, 'out/ui-comments.png') });

// --- tool contract: list with crops ---
const listOut = execFileSync('node', ['scripts/comments.mjs', 'list', '--json', '--crops'], { cwd: ROOT, encoding: 'utf8' });
const listed = JSON.parse(listOut).threads;
check('the tool lists the pin', listed.length === 1 && listed[0].id === 'th_gate1');
const cropPath = listed[0].crop;
check('the tool produced a crop', Boolean(cropPath) && fs.existsSync(path.join(ROOT, cropPath)), cropPath ?? 'none');

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
check('the text edit changes the frame', sha(before) !== sha(after), `${sha(before).slice(0, 8)} -> ${sha(after).slice(0, 8)}`);

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
check('the tool rejects an unknown slot', rejected);

// --- the agent closes the pin; replies live in the conversation ---
execFileSync('node', ['scripts/comments.mjs', 'resolve', '--id', th.id], { cwd: ROOT, encoding: 'utf8' });
const stored = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/comments.json'), 'utf8')).threads[0];
check('the thread resolves', stored.status === 'resolved', stored.status);

let replyGone = false;
try {
  execFileSync('node', ['scripts/comments.mjs', 'reply', '--id', th.id, '--text', 'x'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
} catch {
  replyGone = true;
}
check('the reply channel is gone', replyGone, replyGone ? 'reply removed' : 'reply still exits 0');

await browser.close();
close();
fs.writeFileSync(timelinePath, timelineBefore);
finish();
