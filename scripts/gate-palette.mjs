#!/usr/bin/env node
// Palette gate: the ruler that measures a reference frame must actually measure.
//
// The Egyptian card's biggest single score jump (+18) came from sampling the
// reference's colours instead of picking them, so this tool is load-bearing:
// if it drifts, every film that trusts it drifts too.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'scripts/palette-from.mjs');
const { check, finish } = createGate();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-palette-'));
const run = (file, args = []) =>
  execFileSync(process.execPath, [BIN, file, ...args], { encoding: 'utf8', cwd: ROOT });

try {
  // Two halves, known colours: the tool must find both and nothing else.
  const two = path.join(tmp, 'two.png');
  execFileSync('ffmpeg', [
    '-v', 'error', '-y',
    '-f', 'lavfi', '-i', 'color=c=0x274f87:s=200x200:d=1',
    '-f', 'lavfi', '-i', 'color=c=0xd2bf93:s=200x200:d=1',
    '-filter_complex', '[0][1]hstack',
    '-frames:v', '1', two,
  ]);

  const out = run(two, ['--colors', '2']);
  const rows = out.split('\n').filter((l) => /^ {2}#[0-9a-f]{6}\s+\d/.test(l));
  check('it reports one row per colour asked for', rows.length === 2, `${rows.length} rows`);
  const hexes = rows.map((r) => r.trim().split(/\s+/)[0]);
  const near = (a, b, tol = 10) => {
    const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [p(a), p(b)];
    return x.every((v, i) => Math.abs(v - y[i]) <= tol);
  };
  check(
    'it finds the colours that are there',
    near(hexes[0], '#274f87') || near(hexes[1], '#274f87'),
    hexes.join(' '),
  );
  check(
    'and the other one too',
    near(hexes[0], '#d2bf93') || near(hexes[1], '#d2bf93'),
    hexes.join(' '),
  );
  check('shares add up to the whole frame', Math.abs(rows.reduce((t, r) => t + parseFloat(r.trim().split(/\s+/)[1]), 0) - 100) < 0.5, rows.map((r) => r.trim().split(/\s+/)[1]).join(' + '));

  // Same file twice: a ruler that wobbles is not a ruler.
  check('two runs agree', run(two, ['--colors', '2']) === out);

  // The swatch is optional but must not lie about succeeding.
  const swatch = path.join(tmp, 'swatch.png');
  const withSwatch = run(two, ['--colors', '2', '--out', swatch]);
  check('it writes the swatch it says it wrote', fs.existsSync(swatch) && /swatch:/.test(withSwatch));
  check('the swatch is an image', fs.statSync(swatch).size > 100, `${fs.statSync(swatch).size} bytes`);

  // A flat frame is one colour, not a crash.
  const flat = path.join(tmp, 'flat.png');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x808080:s=64x64:d=1', '-frames:v', '1', flat]);
  const one = run(flat, ['--colors', '4']);
  check('a flat frame reports one colour, not four', one.split('\n').filter((l) => /^ {2}#[0-9a-f]{6}\s+\d/.test(l)).length === 1, one.split('\n').filter((l) => /^ {2}#[0-9a-f]{6}\s+\d/.test(l)).join(' | '));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
