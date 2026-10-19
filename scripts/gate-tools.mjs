#!/usr/bin/env node
// M5 gate: a REAL model session must call motion_info, and a deliberately broken
// inject must fail loudly. Requires local credentials; skips (exit 0) without them.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = path.join(os.homedir(), '.dsh');
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const creds = path.join(SHARED, '.credentials.yaml');
const envFile = path.join(SHARED, '.env');
if (!fs.existsSync(creds) || !fs.existsSync(envFile)) {
  console.log('SKIP  no local credentials (~/.dsh/.env or .credentials.yaml)');
  process.exit(0);
}

function seedHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-tools-'));
  for (const f of ['.env', '.credentials.yaml']) {
    fs.copyFileSync(path.join(SHARED, f), path.join(home, f));
    fs.chmodSync(path.join(home, f), 0o600);
  }
  const llm = path.join(SHARED, 'llm-deepseek');
  if (fs.existsSync(llm)) fs.cpSync(llm, path.join(home, 'llm-deepseek'), { recursive: true });
  return home;
}

const run = (args, env) => {
  const r = spawnSync('dsh', args, { env, encoding: 'utf8', timeout: 300000 });
  return `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
};

let homeA;
let homeB;
try {
  // ---- positive: a real session calls the tool ----
  homeA = seedHome();
  const envA = { ...process.env, DSH_HOME: homeA };
  execFileSync('node', ['scripts/dev-link.mjs'], { cwd: ROOT });
  execFileSync('dsh', ['plugin', '--profile', 'headless', 'add', ROOT], { env: envA, encoding: 'utf8' });
  const answer = run(
    ['headless', 'Call the motion_info tool exactly once, then print its complete output verbatim. Do not call any other tool.'],
    envA,
  );
  check('session calls motion_info', answer.includes('"first-peoples"'), answer.split('\n').filter(Boolean)[0] ?? '');
  check('tool returns the real timeline', answer.includes('"duration": 19') && answer.includes('"orbit"'));

  // ---- negative: broken inject must be loud ----
  const broken = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-broken-'));
  fs.cpSync(ROOT, broken, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|out|\.git)([\\/]|$)/.test(src),
  });
  const entry = path.join(broken, 'lib/index.mjs');
  fs.writeFileSync(entry, fs.readFileSync(entry, 'utf8').replace("export const inject = ['tools'];", "export const inject = ['tools', 'noSuchService'];"));
  execFileSync('node', ['scripts/dev-link.mjs'], { cwd: broken });

  homeB = seedHome();
  const envB = { ...process.env, DSH_HOME: homeB };
  execFileSync('dsh', ['plugin', '--profile', 'headless', 'add', broken], { env: envB, encoding: 'utf8' });
  const brokenAnswer = run(['headless', 'Say ok'], envB);
  check('broken inject is reported', /did not activate/.test(brokenAnswer), brokenAnswer.split('\n').find((l) => /did not activate/.test(l)) ?? '');
  check('broken inject names the service', /noSuchService/.test(brokenAnswer));

  fs.rmSync(broken, { recursive: true, force: true });
} finally {
  if (homeA) fs.rmSync(homeA, { recursive: true, force: true });
  if (homeB) fs.rmSync(homeB, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
