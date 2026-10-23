#!/usr/bin/env node
// Client-half gate: install into a throwaway DSH_HOME, put a film in a
// throwaway workspace, boot web there, and verify the panel mounts that film —
// not the package's example, and not some other session's.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootWeb, dismissOverlays, install, linkSdk, seedHome } from './lib/dsh.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';
import { createFilm } from '../src/film.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

// A workspace of its own: the film must never land in this repository, and
// never in the human's real Documents/deepseek-harness workspace.
const docs = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-docs-'));
const workspace = path.join(docs, 'deepseek-harness', 'default-workspace');
createFilm(workspace, { title: 'Gate film', length: 6 });

const home = seedHome();
let boot;
let browser;
try {
  linkSdk(ROOT);
  install('web', ROOT, home);
  boot = await bootWeb(home, { patch: [{ id: 'workspace-controller', config: { documentsDirectory: docs } }] });

  browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));

  // The package root is not a project any more: there is nothing to show there.
  const legacy = await page.request.get(`${boot.origin}/plugins/dsh-motion/app`);
  check('the package root no longer serves a film', legacy.status() === 404, String(legacy.status()));

  await page.goto(boot.url);
  await page.waitForTimeout(1500);
  await dismissOverlays(page);
  await page.waitForTimeout(600);

  const openRail = page.getByRole('button', { name: 'Open right sidebar' });
  if (await openRail.isVisible().catch(() => false)) await openRail.click();
  await page.waitForTimeout(800);
  await page.getByText('正在编辑的片子').click({ timeout: 15000 });

  const tabFrame = page.frameLocator('iframe[title="dsh-motion tab"]');
  await tabFrame.locator('#tc').waitFor({ timeout: 20000 });
  const tabSrc = (await page.locator('iframe[title="dsh-motion tab"]').getAttribute('src')) ?? '';
  const match = /^\/plugins\/dsh-motion\/p\/([^/]+)\/app\?embed=tab$/.exec(tabSrc);
  check('the tab mounts under the session prefix', Boolean(match), tabSrc || 'missing');

  const session = match?.[1] ?? '';
  const chips = await tabFrame.locator('.chip').count();
  check('the panel shows the workspace film', chips === 1, `${chips} chips`);
  const dur = await tabFrame.locator('body').evaluate(() => window.__PREVIEW__.duration);
  check('the duration is the workspace film\'s', Math.abs(dur - 6) < 0.01, `${dur}s`);

  // The film's own files are what the panel reads.
  const timelineRes = await page.request.get(`${boot.origin}/plugins/dsh-motion/p/${session}/timeline.json`);
  const timeline = timelineRes.status() === 200 ? await timelineRes.json() : null;
  check(
    'the served timeline is the workspace one',
    timeline?.scenes?.[0]?.id === 'blank' && timeline?.duration === 6,
    `${timelineRes.status()} · ${timeline?.scenes?.[0]?.id ?? 'none'}`,
  );
  const sceneRes = await page.request.get(`${boot.origin}/plugins/dsh-motion/p/${session}/scenes/blank.mjs`);
  check(
    'the scene module is served from the workspace',
    sceneRes.status() === 200 && (sceneRes.headers()['content-type'] ?? '').includes('javascript'),
    String(sceneRes.status()),
  );

  // A write through the panel's API lands in the workspace timeline.
  const writeRes = await page.request.post(`${boot.origin}/plugins/dsh-motion/p/${session}/api/texts`, {
    data: { scene: 'blank', slot: 'title', value: 'Gate title' },
  });
  const after = await (await page.request.get(`${boot.origin}/plugins/dsh-motion/p/${session}/timeline.json`)).json();
  check(
    'a panel write lands in the workspace timeline',
    writeRes.status() === 200 && after?.texts?.blank?.title === 'Gate title',
    `${writeRes.status()} · ${after?.texts?.blank?.title ?? 'missing'}`,
  );

  // Traversal: the prefix resolves inside the film directory only.
  const escape = await page.request.get(`${boot.origin}/plugins/dsh-motion/p/${session}/..%2f..%2flib%2findex.mjs`);
  check('the film prefix never serves outside the film', escape.status() !== 200, String(escape.status()));

  // The conversation is still there beside the film.
  const composer = await page.locator('[contenteditable="true"]').first().isVisible();
  check('the conversation stays beside the film', composer, 'composer visible');

  // --- a comment travels panel → host → the session it belongs to ---
  // The panel cannot talk to a session; the client half relays it, and the
  // session is proven by the panel's own mount path.
  const said = await tabFrame.locator('body').evaluate(async () => {
    const out = await window.__PREVIEW__.comment({
      t: 1,
      rect: { x: 100, y: 100, w: 400, h: 200 },
      text: '门禁批注',
    });
    return { ok: out.sent.ok, reason: out.sent.reason ?? null };
  });
  check('a comment is delivered to the session', said.ok === true, said.reason ?? 'ok');
  const landed = await page
    .waitForFunction(() => document.body.innerText.includes('门禁批注'), null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check('the comment appears as a message in the conversation', landed, landed ? 'found' : 'missing');

  await page.screenshot({ path: path.join(ROOT, 'out/ui-tab-dsh.png') });
} finally {
  await browser?.close();
  boot?.stop();
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(docs, { recursive: true, force: true });
}

finish();
