#!/usr/bin/env node

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootWeb, install, linkSdk } from './lib/dsh.mjs';

const HOME = path.join(os.tmpdir(), 'dsh-motion-manual');
const SHARED = path.join(os.homedir(), '.dsh');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

fs.rmSync(HOME, { recursive: true, force: true });
fs.mkdirSync(HOME, { recursive: true });

for (const f of ['.env', '.credentials.yaml']) {
  const src = path.join(SHARED, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(HOME, f));
    fs.chmodSync(path.join(HOME, f), 0o600);
  }
}
if (fs.existsSync(path.join(SHARED, 'llm-deepseek'))) {
  fs.cpSync(path.join(SHARED, 'llm-deepseek'), path.join(HOME, 'llm-deepseek'), { recursive: true });
}

linkSdk(ROOT);
install('web', ROOT, HOME);
const boot = await bootWeb(HOME);

console.log(`\nmanual verification\n  url   ${boot.url}\n  home  ${HOME}\n`);
console.log('open the page and ask the agent to render; the film lands in the right sidebar.');
console.log('the ◐ Motion entry in the left sidebar opens the full editor.');

const shutdown = () => {
  boot.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
