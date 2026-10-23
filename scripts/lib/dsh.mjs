// Throwaway DSH_HOME helpers: seed credentials, install the plugin, boot the web
// profile on a random port, run a headless task. Everything is deleted by callers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';

const SHARED = path.join(os.homedir(), '.dsh');

export function seedHome({ credentials = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-'));
  if (credentials) {
    for (const f of ['.env', '.credentials.yaml']) {
      const src = path.join(SHARED, f);
      if (!fs.existsSync(src)) continue;
      fs.copyFileSync(src, path.join(home, f));
      fs.chmodSync(path.join(home, f), 0o600);
    }
    const llm = path.join(SHARED, 'llm-deepseek');
    if (fs.existsSync(llm)) fs.cpSync(llm, path.join(home, 'llm-deepseek'), { recursive: true });
  }
  return home;
}

export const hasCredentials = () =>
  fs.existsSync(path.join(SHARED, '.env')) && fs.existsSync(path.join(SHARED, '.credentials.yaml'));

export function linkSdk(root) {
  execFileSync('node', ['scripts/dev-link.mjs'], { cwd: root, encoding: 'utf8' });
}

export function install(profile, pkg, home) {
  return execFileSync('dsh', ['plugin', '--profile', profile, 'add', pkg], {
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
  });
}

export function bootWeb(home, { timeout = 25000, patch } = {}) {
  return new Promise((resolve, reject) => {
    // An extra patch layer keeps a throwaway HOME from reaching the human's
    // real workspace (the default workspace lives under the OS Documents dir).
    let overlay = null;
    if (patch) {
      overlay = path.join(home, 'gate-patch.yml');
      const lines = [];
      for (const entry of patch) {
        lines.push(`- id: ${entry.id}`);
        for (const [key, value] of Object.entries(entry.config ?? {})) lines.push(`  config:\n    ${key}: ${value}`);
      }
      fs.writeFileSync(overlay, `${lines.join('\n')}\n`);
    }
    // Launcher options must precede the profile name; after it, they reach the
    // web app's own parser and are rejected.
    const args = [...(overlay ? ['--patch', overlay] : []), '--profile', 'web', '--no-open', '--port', '0'];
    const child = spawn('dsh', args, {
      env: { ...process.env, DSH_HOME: home },
    });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      const m = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=([\w-]+)/.exec(out);
      if (m) {
        resolve({
          origin: `http://127.0.0.1:${m[1]}`,
          token: m[2],
          url: `http://127.0.0.1:${m[1]}/?token=${m[2]}`,
          child,
          log: () => out,
          stop: () => child.kill(),
        });
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    setTimeout(() => reject(new Error(`web did not print a URL:\n${out.slice(-800)}`)), timeout);
  });
}

export function runHeadless(home, prompt, timeout = 300000) {
  const r = spawnSync('dsh', ['headless', prompt], {
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
    timeout,
  });
  return `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
}


/**
 * Clear the host's first-run overlays. A fresh profile can raise more than one
 * (preview notice, then get-started), and a mask over the page eats every click.
 * @param page - Playwright page on the host UI.
 */
export async function dismissOverlays(page) {
  for (let i = 0; i < 6; i++) {
    const dialog = page.getByRole('dialog').last();
    if (!(await dialog.isVisible().catch(() => false))) return;
    // Exact names only: the sign-in panel has a "Continue in your browser"
    // button, and clicking it opens a flow no gate wants.
    const cont = dialog.getByRole('button', { name: /^(continue|get started|ok)$/i }).first();
    if (await cont.isVisible().catch(() => false)) {
      await cont.click().catch(() => {});
      await page.waitForTimeout(400);
      continue;
    }
    const close = dialog.getByRole('button', { name: /^(close|cancel)$/i }).first();
    if (await close.isVisible().catch(() => false)) {
      await close.click().catch(() => {});
    } else {
      await page.keyboard.press('Escape').catch(() => {});
    }
    await page.waitForTimeout(400);
  }
}
