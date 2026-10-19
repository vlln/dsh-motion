#!/usr/bin/env node
// Client-half gate: install into a throwaway DSH_HOME, boot web, then verify
// (a) the panel route serves a working preview and (b) the launcher mounts in the
// real UI and opens the panel in an iframe.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  for (const dir of fs.existsSync(base) ? fs.readdirSync(base).filter((d) => d.startsWith('chromium-')) : []) {
    for (const arch of ['chrome-mac', 'chrome-mac-arm64']) {
      for (const app of ['Chromium', 'Google Chrome for Testing']) {
        const p = path.join(base, dir, arch, `${app}.app`, 'Contents', 'MacOS', app);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-client-'));
const env = { ...process.env, DSH_HOME: home };
let child;

try {
  execFileSync('node', ['scripts/dev-link.mjs'], { cwd: ROOT, encoding: 'utf8' });
  execFileSync('dsh', ['plugin', '--profile', 'web', 'add', ROOT], { env, encoding: 'utf8' });

  const url = await new Promise((resolve, reject) => {
    child = spawn('dsh', ['--profile', 'web', '--no-open', '--port', '0'], { env });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      const m = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=([\w-]+)/.exec(out);
      if (m) resolve({ origin: `http://127.0.0.1:${m[1]}`, token: m[2] });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    setTimeout(() => reject(new Error(`web did not print a URL:\n${out.slice(-800)}`)), 25000);
  });

  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));

  // (a) the panel route on its own
  const appRes = await page.goto(`${url.origin}/plugins/dsh-motion/app`);
  check('panel route serves HTML', appRes?.status() === 200, String(appRes?.status()));
  const jsRes = await page.request.get(`${url.origin}/plugins/dsh-motion/app.js`);
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
  await page.goto(`${url.origin}/?token=${url.token}`);
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
    const closed = await page.evaluate(() => {
      const visible = [...document.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      const x = visible.find(
        (b) => /^(×|✕|x)$/i.test((b.textContent ?? '').trim()) || /close/i.test(b.getAttribute('aria-label') ?? ''),
      );
      if (!x) return false;
      x.click();
      return true;
    });
    await page.waitForTimeout(400);
    if (!closed) break;
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

  await browser.close();
} finally {
  child?.kill();
  fs.rmSync(home, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
