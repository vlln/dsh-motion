#!/usr/bin/env node
// Mux: silent video + audio -> final. Video is copied, never re-encoded.
//   node scripts/mux.mjs --silent out/x-silent.mp4 --audio out/bed.wav --out out/x.mp4
//
// The film's length is decided by the picture, never by the track: a 30s cue on
// a 60s film used to cut the film to 30s. `fit` says what happens instead —
// trim (play it once, silence after), loop (repeat it until the film ends).

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};

export function mux({ silent, audio, out, start = 0, targetLufs = -14, fadeOut = 0.5, duration = null, fit = 'trim' }) {
  return new Promise((resolve, reject) => {
    const filters = [`loudnorm=I=${targetLufs}:TP=-1:LRA=11`, 'afade=t=in:st=0:d=0.25', `afade=t=out:st=${Math.max(0, fadeOut)}:d=0.5`];
    // Always give the output a full-length audio stream: a 2s track on an 8s
    // film should leave silence, not a 2s audio track that some players drop.
    if (fit !== 'loop') filters.push('apad');
    const args = [
      '-loglevel', 'error', '-y',
      '-i', silent,
      ...(fit === 'loop' ? ['-stream_loop', '-1'] : []),
      ...(start > 0 ? ['-ss', String(start)] : []),
      '-i', audio,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-af', filters.join(','),
      // With a known film length the picture wins; -shortest would let a short
      // track decide how long the film is.
      ...(duration ? ['-t', String(duration)] : ['-shortest']),
      '-movflags', '+faststart',
      out,
    ];
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? resolve(out) : reject(new Error(err.slice(-800)))));
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const silent = opt('silent');
  const audio = opt('audio');
  const out = opt('out');
  if (!silent || !audio || !out) {
    console.error('usage: mux.mjs --silent s.mp4 --audio a.wav --out out.mp4');
    process.exit(1);
  }
  const duration = Number(opt('duration', 15));
  await mux({
    silent: path.resolve(ROOT, silent),
    audio: path.resolve(ROOT, audio),
    out: path.resolve(ROOT, out),
    start: Number(opt('start', 0)),
    targetLufs: Number(opt('lufs', -14)),
    fadeOut: duration - 0.5,
    duration,
    fit: opt('fit', 'trim'),
  });
  console.log(`muxed → ${out}`);
}
