#!/usr/bin/env node
// Fonts gate: four roles, no downloads, and a hard failure for anything else.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { FONTS, FONT_KEYS, fontStack } from '../src/fonts.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/dsh-motion.mjs');
const { check, finish } = createGate();

check('four roles are registered', FONT_KEYS.length === 4, FONT_KEYS.join(', '));
check(
  'each role names a stack and a use',
  FONT_KEYS.every((key) => FONTS[key].stack && FONTS[key].note),
  FONT_KEYS.join(', '),
);
check(
  'no role asks for a downloaded webfont',
  FONT_KEYS.every((key) => !/url\(|\.woff|\.ttf/i.test(FONTS[key].stack)),
  'no url()/woff/ttf in stacks',
);
check('a stack resolves from a role', fontStack('display').includes('Helvetica'), fontStack('display'));

let refused = '';
try {
  fontStack('comic');
} catch (error) {
  refused = error.message;
}
check('an unknown role is refused with the list', /use one of: sans, display, serif, mono/.test(refused), refused);

const out = execFileSync(process.execPath, [BIN, 'fonts'], { encoding: 'utf8' });
check('the cli prints every role', FONT_KEYS.every((key) => out.includes(key)), out.split('\n')[0]);

const skill = fs.readFileSync(path.join(ROOT, 'skills/dsh-motion/SKILL.md'), 'utf8');
check('the skill teaches the roles', FONT_KEYS.every((key) => skill.includes(key)), 'sans/display/serif/mono');
check('the skill forbids downloading fonts', /不要下载字体|不要安装字体/.test(skill), 'no downloads');

finish();
