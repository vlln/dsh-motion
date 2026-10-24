#!/usr/bin/env node
// Look gate: the numbers have to separate a painted frame from a flat one, and
// the side-by-side has to appear when a reference exists. The numbers are a
// proxy — the side-by-side is the instrument — but a proxy that cannot tell
// colour from material is worse than none.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/dsh-motion.mjs');
const LOOK = path.join(ROOT, 'scripts/look.mjs');
const { check, finish } = createGate();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-look-'));
const lookAt = (film, file) =>
  JSON.parse(
    execFileSync(process.execPath, [LOOK, '--file', file, '--json'], {
      env: { ...process.env, DSH_MOTION_PROJECT: film },
      encoding: 'utf8',
    }),
  );

try {
  // A frame that is one colour and nothing else.
  const flatPng = path.join(tmp, 'flat.png');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=0x224466:s=640x360', '-frames:v', '1', flatPng]);
  const flat = lookAt(path.join(tmp, 'motion'), flatPng);
  check('a single-colour frame reads as empty', flat.empty === true, JSON.stringify(flat.mine));
  check('a single-colour frame has no material', flat.mine.texture < 1, String(flat.mine.texture));

  // A real film with a real picture in it, rendered through the pipeline.
  execFileSync(process.execPath, [BIN, 'init', '--template', 'plate'], { cwd: tmp, encoding: 'utf8' });
  const film = path.join(tmp, 'motion');
  execFileSync(process.execPath, [BIN, 'render', '--stills', '4', '--cols', '1', '--out', 'out/look/shot.png'], {
    cwd: tmp,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const shot = path.join(film, 'out/look/shot-frames/00.png');
  check('the plate film renders a frame to look at', fs.existsSync(shot), 'out/look/shot-frames/00.png');

  const painted = lookAt(film, shot);
  check('a painted frame does not read as empty', painted.empty === false, JSON.stringify(painted.mine));
  check(
    'solid area separates colour from material by > 30 points',
    flat.mine.flatness - painted.mine.flatness > 0.3,
    `${flat.mine.flatness} vs ${painted.mine.flatness}`,
  );
  check(
    'texture separates them by an order of magnitude',
    painted.mine.texture > flat.mine.texture * 5,
    `${flat.mine.texture} vs ${painted.mine.texture}`,
  );

  // With a reference in out/ref, the report must carry the comparison and a
  // side-by-side, because that is what lets an agent see instead of guess.
  const ref = path.join(film, 'out/ref');
  fs.mkdirSync(ref, { recursive: true });
  fs.copyFileSync(shot, path.join(ref, 'f001.jpg'));
  fs.writeFileSync(
    path.join(ref, 'index.json'),
    `${JSON.stringify({ source: 'shot', duration: 8, fps: 2, frames: 1, sheet: 'out/ref/sheet.jpg', cuts: [] }, null, 2)}\n`,
  );
  const withRef = JSON.parse(
    execFileSync(process.execPath, [LOOK, '--reuse', '--json'], {
      env: { ...process.env, DSH_MOTION_PROJECT: film },
      encoding: 'utf8',
    }),
  );
  check('the report measures the reference too', typeof withRef.reference?.texture === 'number', JSON.stringify(withRef.reference?.texture));
  check('the report carries a colour distance', typeof withRef.reference?.colourDistance === 'number', String(withRef.reference?.colourDistance));
  check('a side-by-side is written', fs.existsSync(path.join(film, 'out/look/vs-ref.jpg')), 'out/look/vs-ref.jpg');
  check('the report is on disk', fs.existsSync(path.join(film, 'out/look/report.json')));

  // --strict only fails on the extreme, because taste must stay arguable.
  const strictFlat = spawnSync(process.execPath, [LOOK, '--file', flatPng, '--strict'], {
    env: { ...process.env, DSH_MOTION_PROJECT: film },
    encoding: 'utf8',
  });
  check('--strict refuses an empty frame', strictFlat.status === 1, String(strictFlat.status));
  const strictPainted = spawnSync(process.execPath, [LOOK, '--reuse', '--strict'], {
    env: { ...process.env, DSH_MOTION_PROJECT: film },
    encoding: 'utf8',
  });
  check('--strict allows a painted one', strictPainted.status === 0, String(strictPainted.status));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
