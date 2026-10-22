#!/usr/bin/env node
// Scale gate: 60fps is the default, and 2x supersampling must reach the same
// output size with at least as much detail (text is rasterised at capture
// resolution, so a 2x pass is the only way to keep glyph edges).

import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

const render = (supersample, out) => {
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts/capture.mjs'), '--video', '--no-audio', '--from', '3', '--to', '3.4', '--supersample', String(supersample), '--out', out],
    { cwd: ROOT, stdio: 'pipe' },
  );
};

const probe = (file) => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,nb_frames,r_frame_rate', '-of', 'json', path.join(ROOT, file)], { encoding: 'utf8' });
  const stream = JSON.parse(out).streams[0];
  return { width: stream.width, height: stream.height, frames: Number(stream.nb_frames), rate: stream.r_frame_rate };
};

/** Mean luminance of an edge-detected frame: a proxy for how much detail survived. */
const edgeEnergy = (file) => {
  // metadata=print writes to stderr, so both streams have to be read.
  const run = spawnSync(
    'ffmpeg',
    ['-ss', '0.1', '-i', path.join(ROOT, file), '-frames:v', '1', '-vf', 'edgedetect,signalstats,metadata=print', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const values = [...`${run.stdout}\n${run.stderr}`.matchAll(/YAVG=([0-9.]+)/g)].map((m) => Number(m[1]));
  if (!values.length) throw new Error(`no YAVG for ${file}`);
  return values[0];
};

render(1, 'out/scale-1.mp4');
render(2, 'out/scale-2.mp4');

const one = probe('out/scale-1.mp4');
const two = probe('out/scale-2.mp4');

check('60fps is the default', one.rate === '60/1' && one.frames === 24, `${one.rate} · ${one.frames} frames`);
check('supersampled output keeps the target size', two.width === 1920 && two.height === 1080, `${two.width}x${two.height}`);
check('supersampling does not change the frame count', two.frames === one.frames, `${two.frames} vs ${one.frames}`);

const e1 = edgeEnergy('out/scale-1.mp4');
const e2 = edgeEnergy('out/scale-2.mp4');
check('2x supersampling keeps at least as much detail', e2 >= e1 * 0.999, `${e1.toFixed(3)} → ${e2.toFixed(3)}`);

// The clamp is deliberate: the kernel caps dpr at 2, so asking for 3 must not
// silently produce a 4x canvas that then gets scaled down again.
render(3, 'out/scale-3.mp4');
const three = probe('out/scale-3.mp4');
check('supersample is clamped to 2', three.width === 1920 && three.height === 1080 && three.frames === 24, `${three.width}x${three.height} · ${three.frames}`);

finish();
