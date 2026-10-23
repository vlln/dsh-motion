#!/usr/bin/env node
// Client-half gate: install into a throwaway DSH_HOME, boot web, then verify
// (a) the panel route serves a working preview and (b) the launcher mounts in the
// real UI and opens the panel in an iframe.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { bootWeb, install, linkSdk, seedHome } from './lib/dsh.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

const home = seedHome();
let boot;
let browser;
try {
  linkSdk(ROOT);
  install('web', ROOT, home);
  boot = await bootWeb(home);

  browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));

  // (a) the panel route on its own
  const appRes = await page.goto(`${boot.origin}/plugins/dsh-motion/app`);
  check('panel route serves HTML', appRes?.status() === 200, String(appRes?.status()));
  const jsRes = await page.request.get(`${boot.origin}/plugins/dsh-motion/app.js`);
  check('panel bundle served', jsRes.status() === 200 && (jsRes.headers()['content-type'] ?? '').includes('javascript'));

  // code splitting: three must live in the lazy chunk, not in the entry bundle
  const appJs = await jsRes.text();
  check('entry bundle excludes three', !appJs.includes('WebGLRenderer'), `${(appJs.length / 1024).toFixed(0)} KiB`);
  const chunkRes = await page.request.get(`${boot.origin}/plugins/dsh-motion/chunks/orbit.js`);
  const chunkJs = chunkRes.status() === 200 ? await chunkRes.text() : '';
  check('3D chunk contains three', chunkJs.includes('WebGLRenderer'), `${(chunkJs.length / 1024).toFixed(0)} KiB`);

  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 20000 });
  const chipCount = await page.locator('.chip').count();
  check('panel renders the scene strip', chipCount === 3, `${chipCount} chips`);
  const dur = await page.evaluate(() => window.__PREVIEW__.duration);
  check('panel knows the timeline duration', Math.abs(dur - 19) < 0.01, `${dur}s`);

  // the write path the panel uses must exist on this origin too, not just in dev
  const paramsRes = await page.request.get(`${boot.origin}/plugins/dsh-motion/api/params`);
  const paramsJson = paramsRes.status() === 200 ? await paramsRes.json() : null;
  check(
    'params route served by the plugin',
    paramsJson?.scenes?.length === 2 && paramsJson.scenes[0].knobs.length === 6,
    `${paramsRes.status()} · ${paramsJson?.scenes?.length ?? 0} scenes`,
  );

  await page.click('[data-scene="cold-war"]');
  await page.waitForTimeout(120);
  const t = await page.evaluate(() => window.__PREVIEW__.time());
  check('panel scene strip seeks', t >= 8 && t < 15, `${t.toFixed(2)}s`);
  await page.screenshot({ path: path.join(ROOT, 'out/ui-panel-dsh.png') });

  // (b) the film column inside the real UI. There is no "open the app" entry:
  // the panel is a column beside the conversation, never a replacement for it.
  await page.goto(boot.url);

  // dismiss first-run dialogs (fresh profile shows "Preview Notice" then "Get started")
  for (let i = 0; i < 3; i++) {
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
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }

  const openRail = page.getByRole('button', { name: 'Open right sidebar' });
  if (await openRail.isVisible().catch(() => false)) await openRail.click();
  await page.getByText('正在编辑的片子').click({ timeout: 10000 });
  const tabFrame = page.frameLocator('iframe[title="dsh-motion tab"]');
  await tabFrame.locator('#tc').waitFor({ timeout: 20000 });

  const tabSrc = (await page.locator('iframe[title="dsh-motion tab"]').getAttribute('src')) ?? '';
  check('the preview tab opens from the guide', /embed=tab/.test(tabSrc), tabSrc || 'missing');
  check('the tab carries the session it belongs to', /session=[0-9a-zA-Z_-]{6,}/.test(tabSrc), tabSrc);

  const tabTc = await tabFrame.locator('#tc').textContent();
  check('the preview tab renders the film', /^0:0\d\.\d\d$/.test(tabTc ?? ''), tabTc ?? '');
  const tabPanel = await tabFrame.locator('.panel').isVisible();
  check('the narrow tab stacks rather than clipping the panel', tabPanel, 'panel visible under the film');

  // The conversation must still be there, and the panel must agree about whose
  // session it is showing — otherwise its comments would land somewhere else.
  const composer = await page.locator('[contenteditable="true"]').first().isVisible();
  check('the conversation stays beside the film', composer, 'composer visible');
  const sessionSeen = await tabFrame.locator('body').evaluate(() => window.__PREVIEW__.session());
  const sessionInUrl = new URL(tabSrc, boot.origin).searchParams.get('session') ?? '';
  check('the panel knows its session', sessionSeen !== '' && sessionSeen === sessionInUrl, `${sessionSeen} vs ${sessionInUrl}`);

  await page.screenshot({ path: path.join(ROOT, 'out/ui-tab-dsh.png') });

  const mediaRes = await page.request.get(`${boot.origin}/plugins/dsh-motion/out/media/index.json`);
  check('media route served by the plugin', mediaRes.status() === 200, String(mediaRes.status()));

  // 403 from our guard, or 404 if the client normalised the dots away first:
  // either way the file must not be served.
  const legacy = await page.request.get(`${boot.origin}/plugins/dsh-motion/timeline.json`);
  check('a timeline file is served by name', legacy.status() === 200, String(legacy.status()));
  const stray = await page.request.get(`${boot.origin}/plugins/dsh-motion/timeline-hack.json`);
  check('only timeline-shaped names are served', stray.status() === 404 || stray.status() === 403, String(stray.status()));

  const escape = await page.request.get(`${boot.origin}/plugins/dsh-motion/out/%2e%2e/lib/index.mjs`);
  check('prefix route never serves outside its base', escape.status() !== 200, String(escape.status()));

  // relative URLs inside the iframe must land on /plugins/dsh-motion/*, not the host root
  const inFrame = await tabFrame
    .locator('body')
    .evaluate(async () => {
      const res = await fetch('./api/history');
      const body = await res.json().catch(() => ({}));
      return { status: res.status, path: new URL('./api/history', location.href).pathname, ok: Array.isArray(body.snapshots) };
    });
  check(
    'panel API resolves inside the iframe',
    inFrame.status === 200 && inFrame.ok && inFrame.path === '/plugins/dsh-motion/api/history',
    `${inFrame.status} ${inFrame.path}`,
  );
} finally {
  await browser?.close();
  boot?.stop();
  fs.rmSync(home, { recursive: true, force: true });
}

finish();
