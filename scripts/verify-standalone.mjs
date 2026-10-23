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
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootWeb, install, linkSdk } from './lib/dsh.mjs';

const SHARED = path.join(os.homedir(), '.dsh');
const HOME = process.env.DSH_MOTION_HOME
  ? path.resolve(process.env.DSH_MOTION_HOME)
  : path.join(os.homedir(), '.dsh-motion');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Structurally refuse the shared home: this host is its own process with its
// own persistent home, and never a second writer on the main one.
const MAIN = path.join(os.homedir(), '.dsh');
if (path.resolve(HOME) === path.resolve(MAIN)) {
  console.error('refusing to run on ~/.dsh: this host must use a private home.');
  console.error('pick another DSH_MOTION_HOME; the main GUI keeps its own.');
  process.exit(1);
}

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

// One stable port per plugin installation, chosen once and remembered. The
// only fixed point it must avoid is the main GUI (3080). `DSH_MOTION_PORT=0`
// forces a fresh pick.
const PORT_FILE = path.join(HOME, 'web-port');
const freePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

let port;
if (process.env.DSH_MOTION_PORT === '0') {
  port = await freePort();
} else if (process.env.DSH_MOTION_PORT) {
  port = Number(process.env.DSH_MOTION_PORT);
} else if (fs.existsSync(PORT_FILE)) {
  port = Number(fs.readFileSync(PORT_FILE, 'utf8').trim());
} else {
  port = await freePort();
  while (port === 3080) port = await freePort();
}
// A busy port usually means the previous instance is still alive; say so
// instead of silently moving to another port and breaking the promise.
const free = await new Promise((resolve) => {
  const probe = net.createServer();
  probe.once('error', () => resolve(false));
  probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
});
if (!free) {
  console.error(`port ${port} is busy — an older instance may still be running:`);
  console.error(`  lsof -nP -iTCP:${port} -sTCP:LISTEN`);
  console.error('stop it, or run with DSH_MOTION_PORT=0 to pick a new stable port.');
  process.exit(1);
}

fs.writeFileSync(PORT_FILE, String(port));

const boot = await bootWeb(HOME, { port });

console.log(`\nmanual verification\n  url   ${boot.url}\n  home  ${HOME}\n  port  ${port} (stable; DSH_MOTION_PORT=0 to re-pick)\n`);
console.log('ask the agent for an animation; the film appears in the right column by itself.');
console.log('sessions opened here persist across restarts.');

const shutdown = () => {
  boot.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
