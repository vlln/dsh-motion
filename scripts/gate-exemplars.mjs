#!/usr/bin/env node
// Exemplar gate: a template is only a standard if it is readable, buildable and
// explained. Three of them, one per material — paint that is borrowed, print on
// paper, ink on silk — because an agent can only imitate what it can open.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/dsh-motion.mjs');
const { check, finish } = createGate();

const EXEMPLARS = ['plate', 'guide', 'tree'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-exemplars-'));
try {
  for (const id of EXEMPLARS) {
    const dir = path.join(tmp, id);
    fs.mkdirSync(dir, { recursive: true });

    const out = execFileSync(process.execPath, [BIN, 'init', '--template', id], { cwd: dir, encoding: 'utf8' });
    check(`${id}: the template builds`, fs.existsSync(path.join(dir, 'motion/timeline.json')), out.trim().split('\n')[0]);

    const checked = execFileSync(process.execPath, [BIN, 'check', '--fast'], { cwd: dir, encoding: 'utf8' });
    check(`${id}: it passes check`, /ok ·/.test(checked), checked.trim());

    const timeline = JSON.parse(fs.readFileSync(path.join(dir, 'motion/timeline.json'), 'utf8'));
    check(`${id}: it is a film, not a still`, timeline.duration >= 4, `${timeline.duration}s`);
    check(`${id}: it has a cover time`, typeof timeline.poster === 'number', String(timeline.poster));

    // Readable: either the template carries its scene, or it names a built-in.
    const own = fs.existsSync(path.join(dir, 'motion/scenes')) && fs.readdirSync(path.join(dir, 'motion/scenes')).some((f) => f.endsWith('.mjs'));
    const builtIn = fs.existsSync(path.join(ROOT, 'src/scenes', `${id}.mjs`));
    check(`${id}: its source can be opened`, own || builtIn, own ? 'scenes/…' : 'src/scenes/…');

    // Explained: the breakdown doc exists and is about this template.
    const doc = path.join(ROOT, 'docs/exemplars', `${id}.md`);
    check(`${id}: it has a breakdown`, fs.existsSync(doc), `docs/exemplars/${id}.md`);
    const text = fs.existsSync(doc) ? fs.readFileSync(doc, 'utf8') : '';
    check(`${id}: the breakdown names the template`, text.includes(`--template ${id}`), 'names it');
    check(`${id}: the breakdown says what to copy and what to change`, /## 抄什么/.test(text) && /## 换什么/.test(text), 'sections');
  }

  // No orphans: a breakdown for a template that no longer exists is worse than none.
  const docs = fs.readdirSync(path.join(ROOT, 'docs/exemplars')).filter((f) => f.endsWith('.md'));
  const templates = fs.readdirSync(path.join(ROOT, 'templates')).filter((d) => fs.existsSync(path.join(ROOT, 'templates', d, 'timeline.json')));
  check('every breakdown has a template', docs.every((f) => templates.includes(path.basename(f, '.md'))), docs.join(', '));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
