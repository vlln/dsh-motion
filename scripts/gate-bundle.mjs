#!/usr/bin/env node
// Bundle gate: the panel in dsh serves lib/, so a source edit that was never
// rebuilt ships old art to the user. This rebuilds into a temp dir and compares
// what a fresh build would produce with what is committed.
//
// It does not write to lib/ — it tells you to run `npm run build:client`.

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClient } from './build-client.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'lib');

const ok = [];
const bad = [];
const check = (name, pass, detail = '') => (pass ? ok : bad).push(`${name}${detail ? `  — ${detail}` : ''}`);

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function listing(dir) {
  const out = new Map();
  const walk = (base) => {
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      const full = path.join(base, entry.name);
      if (entry.isDirectory()) walk(path.join(base, entry.name));
      else out.set(path.relative(dir, full), sha(full));
    }
  };
  walk(dir);
  return out;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-bundle-'));
try {
  await buildClient({ outdir: tmp });
  const fresh = listing(tmp);
  const shipped = new Map();
  for (const rel of ['app.js', 'app.css', 'app.html']) {
    const file = path.join(LIB, rel);
    if (fs.existsSync(file)) shipped.set(rel, sha(file));
  }
  const chunkDir = path.join(LIB, 'chunks');
  if (fs.existsSync(chunkDir)) {
    for (const [rel, hash] of listing(chunkDir)) shipped.set(path.join('chunks', rel), hash);
  }

  check('a build can be produced', fresh.size > 0, `${fresh.size} files`);
  const missing = [...fresh.keys()].filter((k) => !shipped.has(k));
  const stale = [...fresh.keys()].filter((k) => shipped.has(k) && shipped.get(k) !== fresh.get(k));
  const extra = [...shipped.keys()].filter((k) => !fresh.has(k));

  check('the panel bundle is up to date', missing.length + stale.length + extra.length === 0,
    missing.length + stale.length + extra.length === 0
      ? `${fresh.size} files match`
      : `missing ${missing.length}, stale ${stale.length}, extra ${extra.length}`);

  check('the shell still points at the built bundle',
    fs.existsSync(path.join(LIB, 'app.html')) &&
      fs.readFileSync(path.join(LIB, 'app.html'), 'utf8').includes('./app.js'));

  check('no import map is shipped', !fs.readFileSync(path.join(LIB, 'app.html'), 'utf8').includes('importmap'));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

for (const line of ok) console.log(`PASS  ${line}`);
for (const line of bad) console.log(`FAIL  ${line}`);
console.log(`\n${done()}/${ok.length + bad.length} passed`);
if (bad.length) {
  console.log('run: npm run build:client');
  process.exit(1);
}

function done() {
  return ok.length;
}
