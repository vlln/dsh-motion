#!/usr/bin/env node
// M5 gate: a REAL model session must call motion_info, and a deliberately broken
// inject must fail loudly. Requires local credentials; skips (exit 0) without them.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hasCredentials, install, linkSdk, runHeadless, seedHome } from './lib/dsh.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

if (!hasCredentials()) {
  console.log('SKIP  no local credentials (~/.dsh/.env or .credentials.yaml)');
  process.exit(0);
}

let homeA;
let homeB;
let broken;
try {
  // ---- positive: a real session calls the tool ----
  homeA = seedHome({ credentials: true });
  linkSdk(ROOT);
  install('headless', ROOT, homeA);
  const answer = runHeadless(
    homeA,
    'Call the motion_info tool exactly once, then print its complete output verbatim. Do not call any other tool.',
  );
  check('session calls motion_info', answer.includes('"first-peoples"'), answer.split('\n').filter(Boolean)[0] ?? '');
  check('tool returns the real timeline', answer.includes('"duration": 19') && answer.includes('"orbit"'));

  // ---- negative: broken inject must be loud ----
  broken = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-broken-'));
  fs.cpSync(ROOT, broken, {
    recursive: true,
    filter: (src) => !/[\\/](node_modules|out|\.git)([\\/]|$)/.test(src),
  });
  const entry = path.join(broken, 'lib/index.mjs');
  fs.writeFileSync(
    entry,
    fs.readFileSync(entry, 'utf8').replace("export const inject = ['tools'];", "export const inject = ['tools', 'noSuchService'];"),
  );
  linkSdk(broken);

  homeB = seedHome({ credentials: true });
  install('headless', broken, homeB);
  const brokenAnswer = runHeadless(homeB, 'Say ok');
  check(
    'broken inject is reported',
    /did not activate/.test(brokenAnswer),
    brokenAnswer.split('\n').find((l) => /did not activate/.test(l)) ?? '',
  );
  check('broken inject names the service', /noSuchService/.test(brokenAnswer));
} finally {
  if (homeA) fs.rmSync(homeA, { recursive: true, force: true });
  if (homeB) fs.rmSync(homeB, { recursive: true, force: true });
  if (broken) fs.rmSync(broken, { recursive: true, force: true });
}

finish();
