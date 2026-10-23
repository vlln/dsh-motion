#!/usr/bin/env node
// Manual-verification host.
//
// The home is STABLE: it survives restarts, so the sessions you open here are
// still there next time. It is not the shared `~/.dsh` (the main GUI keeps
// writing that one, and two writers on one home corrupt sessions), and it is
// not a throwaway either.
//
//   npm run dev:host                       → ~/.dsh-motion (persistent)
//   DSH_MOTION_HOME=/path npm run dev:host → any home you name
//
// This deliberately ignores an inherited DSH_HOME: a shell started inside the
// main session exports it, and reusing ~/.dsh while that GUI is running means
// two writers on one session log. To see the main GUI's sessions here, stop
// that GUI first and pass DSH_MOTION_HOME=~/.dsh.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootWeb, install, linkSdk } from './lib/dsh.mjs';

const SHARED = path.join(os.homedir(), '.dsh');
const HOME = process.env.DSH_MOTION_HOME
  ? path.resolve(process.env.DSH_MOTION_HOME)
  : path.join(os.homedir(), '.dsh-motion');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const firstRun = !fs.existsSync(path.join(HOME, 'sessions'));
fs.mkdirSync(HOME, { recursive: true });
console.log(`home ${HOME}${firstRun ? ' (created)' : ' (reused)'}`);

// Credentials are copied once; a later run never overwrites them.
for (const f of ['.env', '.credentials.yaml']) {
  const target = path.join(HOME, f);
  const src = path.join(SHARED, f);
  if (!fs.existsSync(src) || fs.existsSync(target)) continue;
  fs.copyFileSync(src, target);
  fs.chmodSync(target, 0o600);
}
if (fs.existsSync(path.join(SHARED, 'llm-deepseek')) && !fs.existsSync(path.join(HOME, 'llm-deepseek'))) {
  fs.cpSync(path.join(SHARED, 'llm-deepseek'), path.join(HOME, 'llm-deepseek'), { recursive: true });
}

linkSdk(ROOT);
install('web', ROOT, HOME);
const boot = await bootWeb(HOME);

console.log(`\nmanual verification\n  url   ${boot.url}\n  home  ${HOME}\n`);
console.log('ask the agent for an animation; the film appears in the right column by itself.');
console.log('sessions opened here persist across restarts.');

const shutdown = () => {
  boot.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
