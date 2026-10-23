#!/usr/bin/env node
// Conversation-card gate: a REAL agent turn in the web UI must turn a render
// into something you watch — the card inline, and the preview tab already open.
// Requires local credentials; skips (exit 0) without them.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootWeb, dismissOverlays, hasCredentials, install, linkSdk, seedHome } from './lib/dsh.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

if (!hasCredentials()) {
  console.log('SKIP  no local credentials (~/.dsh/.env or .credentials.yaml)');
  process.exit(0);
}

const home = seedHome({ credentials: true });
// The agent must write its film into a workspace of its own, never the human's.
const docs = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-docs-'));
const workspace = path.join(docs, 'deepseek-harness', 'default-workspace');
let boot;
let browser;
try {
  linkSdk(ROOT);
  install('web', ROOT, home);
  boot = await bootWeb(home, { patch: [{ id: 'workspace-controller', config: { documentsDirectory: docs } }] });

  browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => {
    if (/dsh-motion|error/i.test(m.text())) console.log(`[console:${m.type()}]`, m.text().slice(0, 300));
  });

  await page.goto(boot.url);
  for (let i = 0; i < 4; i++) {
    const cont = page.getByRole('button', { name: /continue/i });
    if (await cont.isVisible().catch(() => false)) {
      await cont.click();
      await page.waitForTimeout(400);
      continue;
    }
    const dialog = page.getByRole('dialog');
    if (await dialog.count()) {
      const close = dialog.locator('button').first();
      if (await close.isVisible().catch(() => false)) {
        await close.click();
        await page.waitForTimeout(400);
        continue;
      }
    }
    break;
  }

  // First run can raise a second overlay after the first one closes; the
  // composer is unusable while a mask covers it.
  for (let i = 0; i < 6; i++) {
    const mask = page.locator('[class*="mask"]').first();
    if (!(await mask.isVisible().catch(() => false))) break;
    const cont = page.getByRole('button', { name: /continue|get started|ok/i }).last();
    if (await cont.isVisible().catch(() => false)) await cont.click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ROOT, 'out/card-debug.png') });

  // Start from the conversation, the way a user would. The composer is a rich
  // editor, not a textarea; `textbox` would match the sidebar's session search.
  const composer = page.locator('[contenteditable="true"]').first();
  await composer.click();
  await page.keyboard.type(
    "Call motion_project with action=create and title='Gate film'. Then call motion_render once with mode=stills and stills=0,3. Then reply with only the file path it returns.",
  );
  await page.keyboard.press('Enter');

  // The card is the tool call's own face; it appears when the call starts and
  // swaps to the film when the result lands.
  await page.locator('[data-dshm-card]').first().waitFor({ timeout: 120000 });
  check('a render shows up in the conversation', true, 'data-dshm-card');

  // The tab opens itself on completion — the "made it, look" moment.
  const tab = page.locator('iframe[title="dsh-motion tab"]').first();
  await tab.waitFor({ timeout: 120000 });
  const tabSrc = (await tab.getAttribute('src')) ?? '';
  check('the preview tab opens without being asked', true, tabSrc);
  const session = /\/p\/([^/]+)\//.exec(tabSrc)?.[1] ?? '';

  // The settled tool group folds, so the card is attached but not on screen;
  // its iframe must still be the real film.
  const cardFrame = page.frameLocator('iframe[title="dsh-motion card"]').first();
  await cardFrame.locator('#tc').waitFor({ state: 'attached', timeout: 60000 });
  const tc = await cardFrame.locator('#tc').textContent();
  check('the card renders the film itself', /^\d:\d\d\.\d\d$/.test(tc ?? ''), tc ?? '');

  const header = await page.locator('[data-dshm-card]').first().innerText();
  check('the card reports the film it belongs to', /已渲染|渲染中|渲染失败/.test(header), header.split('\n')[0] ?? '');

  // --- the comment channel: a pin in the panel becomes a message in the chat ---
  const tabFrame = page.frameLocator('iframe[title="dsh-motion tab"]').first();
  await tabFrame.locator('#tc').waitFor({ timeout: 30000 });
  const said = await tabFrame.locator('body').evaluate(async () => {
    const out = await window.__PREVIEW__.comment({
      t: 3.2,
      rect: { x: 200, y: 240, w: 560, h: 96 },
      text: '把标题再改短一点',
    });
    return { ok: out.sent.ok, reason: out.sent.reason ?? null, id: out.thread.id };
  });
  check('a comment is delivered to the session', said.ok === true, said.reason ?? said.id);

  // The words must land in the conversation itself, not in a panel store. A busy
  // agent may hold the message in its queue first, so wait for the page text —
  // the panel lives in an iframe and does not contribute to it.
  const landed = await page
    .waitForFunction(() => document.body.innerText.includes('把标题再改短一点'), null, { timeout: 90000 })
    .then(() => true)
    .catch(() => false);
  const bodyText = await page.evaluate(() => document.body.innerText);
  check('the comment appears as a message in the conversation', landed, landed ? 'found in chat' : bodyText.slice(-300).replace(/\n/g, ' '));
  check('the message is marked as a comment', /\[批注\]/.test(bodyText), 'found [批注]');

  // And the pin must record that it was spoken, so it is never shown as a draft.
  const pins = await (await page.request.get(`${boot.origin}/plugins/dsh-motion/p/${session}/api/comments`)).json();
  const pin = (pins.threads ?? []).find((thread) => thread.id === said.id);
  check('the pin is marked sent', Boolean(pin?.sentAt), pin?.sentAt ?? 'missing');

  await page.screenshot({ path: path.join(ROOT, 'out/ui-card-dsh.png') });
  // The film belongs to the workspace the agent was working in.
  const film = path.join(workspace, 'motion', 'timeline.json');
  check('the film was created inside the workspace', fs.existsSync(film), film);
  const scene = path.join(workspace, 'motion', 'scenes', 'blank.mjs');
  check('the starter scene is the workspace\'s own copy', fs.existsSync(scene), scene);
} finally {
  await browser?.close();
  boot?.stop();
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(docs, { recursive: true, force: true });
}

finish();
