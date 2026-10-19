#!/usr/bin/env node
// Plugin gate (M4): install into a throwaway DSH_HOME, appear in the composed
// profile, and boot the web profile without load errors.
// A clean log is only evidence after the negative control in gate-tools.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { install, linkSdk, seedHome, bootWeb } from './lib/dsh.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

const home = seedHome();
try {
  linkSdk(ROOT);
  const add = install('web', ROOT, home);
  check('installs into a throwaway profile', add.includes('@vlln/dsh-motion'), add.trim().split('\n').at(-1));

  const dump = execFileSync('dsh', ['--profile', 'web', '--dump-config'], {
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
  });
  check('composed profile contains the bundle row', dump.includes("name: '@vlln/dsh-motion'"));

  const boot = await bootWeb(home).catch((err) => ({ error: err.message }));
  check('web profile boots', Boolean(boot.origin), boot.error ?? boot.origin);
  if (boot.origin) {
    const log = boot.log();
    check(
      'no load errors',
      !/plugin tree failed|did not activate|skipping profile bundle|Error:/i.test(log),
      log.split('\n').filter(Boolean).slice(-1)[0] ?? '',
    );
    boot.stop();
  }
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}

finish();
