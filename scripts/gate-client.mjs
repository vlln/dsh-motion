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

  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 20000 });
  const chipCount = await page.locator('.chip').count();
  check('panel renders the scene strip', chipCount === 3, `${chipCount} chips`);
  const dur = await page.evaluate(() => window.__PREVIEW__.duration);
  check('panel knows the timeline duration', Math.abs(dur - 19) < 0.01, `${dur}s`);

  await page.click('[data-scene="cold-war"]');
  await page.waitForTimeout(120);
  const t = await page.evaluate(() => window.__PREVIEW__.time());
  check('panel scene strip seeks', t >= 8 && t < 15, `${t.toFixed(2)}s`);
  await page.screenshot({ path: path.join(ROOT, 'out/ui-panel-dsh.png') });

  // (b) the launcher inside the real UI
  await page.goto(boot.url);
  await page.waitForSelector('[data-dshm-root] .dshm-btn', { timeout: 30000 });
  check('launcher mounts in the real UI', true);

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

  try {
    await page.locator('[data-dshm-root] .dshm-btn').click({ timeout: 3000 });
  } catch {
    // still covered by an onboarding mask: dispatch directly, the handler is what we test
    await page.evaluate(() => document.querySelector('[data-dshm-root] .dshm-btn')?.click());
  }
  await page.waitForSelector('[data-dshm-panel]:not([hidden])', { timeout: 5000 });
  check('panel opens', true);

  const frame = page.frameLocator('iframe[title="dsh-motion preview"]');
  await frame.locator('#tc').waitFor({ timeout: 20000 });
  const frameTc = await frame.locator('#tc').textContent();
  check('iframe preview is live', /^0:0\d\.\d\d$/.test(frameTc ?? ''), frameTc ?? '');
  await page.screenshot({ path: path.join(ROOT, 'out/ui-launcher.png') });
} finally {
  await browser?.close();
  boot?.stop();
  fs.rmSync(home, { recursive: true, force: true });
}

finish();
