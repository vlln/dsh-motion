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

export function bootWeb(home, { timeout = 25000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('dsh', ['--profile', 'web', '--no-open', '--port', '0'], {
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
