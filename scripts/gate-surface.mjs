#!/usr/bin/env node
// Surface gate: the plugin's whole agent-facing surface is a skill and a
// command — no tools. This drives the real Cordis entry with a fake context and
// checks that, plus the two artefacts the surface is made of.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { linkSdk } from './lib/dsh.mjs';
import { loadTools } from './lib/surface.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

try {
  linkSdk(ROOT);
} catch {
  /* offline: a missing link surfaces on import */
}

const { tools, routes, dispose } = await loadTools(ROOT);

// --- no tool surface ---
check('the plugin registers no tools', tools.size === 0, [...tools.keys()].join(', ') || 'none');

// --- the film is mounted per session ---
const paths = routes.map((r) => r.path);
check('the session mount is registered', paths.includes('/plugins/dsh-motion/p'), paths.join(', ') || 'none');
check('no package-root app route is left', !paths.includes('/plugins/dsh-motion/app'));

dispose();

// --- the skill is the manual, and complete enough to work from ---
const skillFile = path.join(ROOT, 'skills/dsh-motion/SKILL.md');
check('the skill file exists', fs.existsSync(skillFile), skillFile);
const skill = fs.existsSync(skillFile) ? fs.readFileSync(skillFile, 'utf8') : '';
const front = /^---\n([\s\S]*?)\n---\n/.exec(skill);
check('the skill has frontmatter', Boolean(front), front ? 'parsed' : 'missing');
check('the skill is named dsh-motion', /name:\s*dsh-motion/.test(front?.[1] ?? ''), front?.[1]?.split('\n')[0] ?? '');
check('the skill routes on animation work', /description:/.test(front?.[1] ?? '') && /动画/.test(front?.[1] ?? ''));
for (const command of ['dsh-motion init', 'dsh-motion check', 'dsh-motion render', 'dsh-motion reference']) {
  check(`the skill teaches \`${command}\``, skill.includes(command), command);
}
check('the skill states the determinism rule', /不读时钟/.test(skill) && /同一个 `t`/.test(skill));
check('the skill documents the scene contract', /export const id/.test(skill) && /export function render/.test(skill));

// --- the command exists and answers ---
const bin = path.join(ROOT, 'bin/dsh-motion.mjs');
check('the cli exists', fs.existsSync(bin), bin);
const mode = fs.statSync(bin).mode;
check('the cli is executable', (mode & 0o111) !== 0, mode.toString(8));

const run = spawnSync(process.execPath, [bin], { encoding: 'utf8' });
const usage = `${run.stdout ?? ''}${run.stderr ?? ''}`;
check('the cli prints usage without a film', ['init', 'reference', 'check', 'render', 'version'].every((c) => usage.includes(c)), usage.split('\n')[0] ?? '');

// --- the manual must not name a command that no longer exists ---
// The CLI was cut to five verbs once; the skill kept teaching `template` and
// `fonts` for weeks. A retired verb is worse than no manual: it fails at the
// moment the agent is least able to tell why.
const named = [...new Set([...skill.matchAll(/dsh-motion ([a-z][a-z-]*)/g)].map((m) => m[1]))];
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-surface-'));
try {
  for (const verb of named) {
    const probe = spawnSync(process.execPath, [bin, verb], { cwd: scratch, encoding: 'utf8' });
    const out = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
    check(`\`dsh-motion ${verb}\` runs`, !out.includes('usage: dsh-motion <init|'), verb);
  }
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
check(
  'the package declares the command',
  pkg.bin?.['dsh-motion'] === './bin/dsh-motion.mjs',
  JSON.stringify(pkg.bin ?? null),
);

finish();
