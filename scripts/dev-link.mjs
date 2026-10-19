#!/usr/bin/env node
// Local development only: symlink the SDK into this package's node_modules so the
// Cordis entry can import @deepseek-ai/dsh-tools when installed by path (npm install
// prunes extraneous links, so this is re-runnable). Never declared in package.json.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const aiRoot = path.join(globalRoot, '@deepseek-ai/dsh/node_modules/@deepseek-ai');

const wanted = ['dsh-tools', 'cordis'];
const target = path.join(ROOT, 'node_modules/@deepseek-ai');
fs.mkdirSync(target, { recursive: true });

for (const pkg of wanted) {
  const src = path.join(aiRoot, pkg);
  if (!fs.existsSync(src)) {
    console.log(`skip ${pkg} (not found in ${aiRoot})`);
    continue;
  }
  const dst = path.join(target, pkg);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.symlinkSync(src, dst, 'dir');
  console.log(`linked ${pkg}`);
}
