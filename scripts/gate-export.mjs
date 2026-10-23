#!/usr/bin/env node
// Export gate: the panel must be able to produce a file, not just preview one.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { startServer } from './serve.mjs';
import { exportProject } from '../src/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

const probe = (file) => {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height,nb_frames', '-of', 'json', path.join(ROOT, file)], { encoding: 'utf8' });
  const s = JSON.parse(out).streams[0];
  return { width: s.width, height: s.height, frames: Number(s.nb_frames) };
};

// 4s at 60fps = 240 frames: short enough for a gate, long enough to be real.
const out = await exportProject(ROOT, { format: 'mp4', fps: 60, file: 'fixtures/timeline-values.json' });
check('export writes a file', fs.existsSync(path.join(ROOT, out.path)) && out.bytes > 10_000, `${out.path} · ${(out.bytes / 1e6).toFixed(1)} MB`);

const info = probe(out.path);
check('the file has the timeline size', info.width === 1920 && info.height === 1080, `${info.width}x${info.height}`);
check('the file has one frame per step', info.frames === 240, `${info.frames} frames`);
check('export reports its own cost', out.ms > 0 && out.duration === 4, `${out.ms}ms · ${out.duration}s`);

// --- the HTTP path the panel uses ---
const { origin, close } = await startServer();
try {
  const res = await fetch(`${origin}/api/export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ format: 'mp4', fps: 30, timeline: './fixtures/timeline-values.json' }),
  });
  const body = await res.json();
  check('the panel endpoint exports too', res.status === 200 && fs.existsSync(path.join(ROOT, body.path)), body.error ?? body.path);

  const bad = await fetch(`${origin}/api/export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ format: 'webm', timeline: './fixtures/timeline-values.json' }),
  });
  check('an unknown format is refused', bad.status === 400, String((await bad.json()).error));

  const escape = await fetch(`${origin}/api/export`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ format: 'mp4', timeline: '../outside.json' }),
  });
  check('a timeline outside the package is refused', escape.status === 400, String((await escape.json()).error));

  for (const file of [out.path, body.path]) fs.rmSync(path.join(ROOT, file), { force: true });
} finally {
  close();
}

finish();
