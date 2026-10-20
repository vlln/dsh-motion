#!/usr/bin/env node
// Reference gate: the ingester must recover structure we put there on purpose.
// Fixtures are synthesised with ffmpeg — 2s navy | 2s gold | 2s navy with a moving
// white box — so the ground truth is known because we authored it. A static clip
// is the negative control: no cuts, no motion.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { loadTools } from './lib/surface.mjs';
import { linkSdk } from './lib/dsh.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out');
const MOVING = path.join(OUT, 'ref-a.mp4');
const STATIC = path.join(OUT, 'ref-b.mp4');
const SOFT = path.join(OUT, 'ref-c.mp4');
const { check, finish } = createGate();

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { cwd: ROOT });
}

// Always regenerate: a stale fixture from an older recipe would quietly test the
// wrong thing (this gate did exactly that once).
function ensureFixtures() {
  fs.mkdirSync(OUT, { recursive: true });
  {
    ffmpeg([
      '-f', 'lavfi', '-i', 'color=c=0x0b1426:s=320x180:r=24:d=2',
      '-f', 'lavfi', '-i', 'color=c=0xe0b040:s=320x180:r=24:d=2',
      '-f', 'lavfi', '-i', 'color=c=0x0b1426:s=320x180:r=24:d=2',
      '-f', 'lavfi', '-i', 'color=c=white:s=60x60:r=24:d=2',
      '-filter_complex',
      "[2:v][3:v]overlay=x='mod(t*240\\,260)':y=60:shortest=1[v2];[0:v][1:v][v2]concat=n=3:v=1:a=0,format=yuv420p[v]",
      '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', 'out/ref-a.mp4',
    ]);
  }
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x0b1426:s=320x180:r=24:d=3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', 'out/ref-b.mp4']);
  // a scene swap on an unchanged background: too small for a hard cut, far louder
  // than the quiet shot it leaves — the way this house style cuts.
  ffmpeg([
    '-f', 'lavfi', '-i', 'color=c=0x0b1426:s=320x180:r=24:d=4',
    '-f', 'lavfi', '-i', 'color=c=white:s=80x20:r=24:d=4',
    '-filter_complex', "[0:v][1:v]overlay=x=100:y=80:enable='gte(t,2)'[v]",
    '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', 'out/ref-c.mp4',
  ]);
}

const analyze = (file, out) =>
  JSON.parse(
    execFileSync(process.execPath, [path.join(ROOT, 'scripts/reference.mjs'), file, '--out', out], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    }),
  );

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const near = (hex, expect, tol = 12) => {
  const a = rgb(hex);
  const b = rgb(expect);
  return a.every((v, i) => Math.abs(v - b[i]) <= tol);
};

ensureFixtures();

// --- the authored structure comes back ---
const ref = analyze('out/ref-a.mp4', 'out/reference-gate.json');
check('duration', Math.abs(ref.duration - 6) < 0.1, `${ref.duration}s`);
check(
  'cuts land on the two joins',
  ref.cuts.length === 2 && Math.abs(ref.cuts[0].t - 2) < 0.2 && Math.abs(ref.cuts[1].t - 4) < 0.2,
  ref.cuts.map((c) => `${c.t}s`).join(', ') || 'none',
);
check('cut scores clear the threshold', ref.cuts.every((c) => c.score > 0.3), ref.cuts.map((c) => c.score).join(', '));
check(
  'three segments with the right boundaries',
  ref.segments.length === 3 && Math.abs(ref.segments[1].start - 2) < 0.05 && Math.abs(ref.segments[2].length - 2) < 0.05,
  ref.segments.map((s) => `${s.start}+${s.length}`).join(' | '),
);

// --- colour ---
check('segment 1 is the navy plate', near(ref.segments[0].colors[0], '#0b1426'), ref.segments[0].colors[0]);
check('segment 2 is the gold plate', near(ref.segments[1].colors[0], '#e0b040'), ref.segments[1].colors[0]);
check(
  'the dominant colour is the one that covers most of the clip',
  near(ref.palette[0].hex, '#0b1426') && ref.palette[0].share > 0.5,
  `${ref.palette[0].hex} ${(ref.palette[0].share * 100).toFixed(0)}%`,
);

// --- motion separated from cuts ---
check(
  'motion separates the moving segment from the static ones',
  ref.segments[2].motion > 0.02 && ref.segments[0].motion < 0.005,
  `seg1 ${ref.segments[0].motion} · seg3 ${ref.segments[2].motion}`,
);
check(
  'the curve keeps the peaks and the floor',
  ref.motion.curve.length >= 8 && ref.motion.max > 0.4 && ref.motion.mean < 0.1,
  `${ref.motion.curve.length} windows · max ${ref.motion.max} · mean ${ref.motion.mean}`,
);

// --- negative control: a static clip has no structure to find ---
const still = analyze('out/ref-b.mp4', 'out/reference-static.json');
check(
  'a static clip reports no cuts and no motion',
  still.cuts.length === 0 && still.motion.mean < 0.005,
  `${still.cuts.length} cuts · mean ${still.motion.mean}`,
);

// --- soft cut: structure without a big pixel jump ---
const soft = analyze('out/ref-c.mp4', 'out/reference-soft.json');
check(
  'a scene swap on an unchanged background is found as a soft cut',
  soft.cuts.length === 1 && soft.cuts[0].kind === 'soft' && Math.abs(soft.cuts[0].t - 2) < 0.2,
  soft.cuts.map((c) => `${c.t}s ${c.kind}`).join(', ') || 'none',
);
check(
  'the soft cut is not promoted to hard',
  soft.cuts.every((c) => c.score < 0.12),
  soft.cuts.map((c) => c.score).join(', ') || 'none',
);

// --- determinism: two runs, identical bytes ---
analyze('out/ref-a.mp4', 'out/reference-det1.json');
analyze('out/ref-a.mp4', 'out/reference-det2.json');
const one = fs.readFileSync(path.join(OUT, 'reference-det1.json'), 'utf8');
const two = fs.readFileSync(path.join(OUT, 'reference-det2.json'), 'utf8');
check('two runs produce identical JSON', one === two, `${one.length} bytes`);

// --- the tool returns what the CLI returns ---
try {
  linkSdk(ROOT);
} catch {
  /* offline: a missing link surfaces when the entry imports dsh-tools */
}
const surface = await loadTools(ROOT);
const toolRaw = await surface.tools.get('motion_reference').execute({
  path: 'out/ref-a.mp4',
  out: 'out/reference-tool.json',
});
const toolJson = JSON.parse(toolRaw);
check(
  'motion_reference returns the same analysis',
  toolJson.duration === ref.duration && toolJson.cuts.length === 2 && toolJson.segments.length === 3,
  `tool: ${toolJson.cuts.length} cuts`,
);
surface.dispose();

// --- negative: a path that is not there fails loudly ---
let code = 0;
let stderr = '';
try {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/reference.mjs'), 'out/definitely-missing.mp4'], {
    cwd: ROOT,
    stdio: 'pipe',
  });
} catch (err) {
  code = err.status ?? 1;
  stderr = String(err.stderr ?? '');
}
check('a missing file exits non-zero and says so', code !== 0 && /no such file/.test(stderr), `${code} · ${stderr.trim()}`);

finish();
