#!/usr/bin/env node
// Plugin gate (M4): the package installs into a throwaway DSH_HOME, appears in the
// composed profile, and the web profile boots without load errors.
// A clean log is only evidence after a negative control — see gate-plugin-negative.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-home-'));
const env = { ...process.env, DSH_HOME: home };

try {
  const add = execFileSync('dsh', ['plugin', '--profile', 'web', 'add', ROOT], { env, encoding: 'utf8' });
  check('installs into a throwaway profile', add.includes('@vlln/dsh-motion'), add.trim().split('\n').at(-1));

  const dump = execFileSync('dsh', ['--profile', 'web', '--dump-config'], { env, encoding: 'utf8' });
  check('composed profile contains the bundle row', dump.includes("name: '@vlln/dsh-motion'"));

  const boot = await new Promise((resolve) => {
    const child = spawn('dsh', ['--profile', 'web', '--no-open', '--port', '0'], { env });
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (/http:\/\/127\.0\.0\.1:\d+/.test(out)) {
        setTimeout(() => {
          child.kill();
          resolve(out);
        }, 1200);
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    setTimeout(() => {
      child.kill();
      resolve(out);
    }, 20000);
  });

  check('web profile boots', /http:\/\/127\.0\.0\.1:\d+/.test(boot));
  check('no load errors', !/plugin tree failed|did not activate|skipping profile bundle|Error:/i.test(boot), boot.split('\n').filter(Boolean).slice(-1)[0] ?? '');
} finally {
  fs.rmSync(home, { recursive: true, force: true });
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
