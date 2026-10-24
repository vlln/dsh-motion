#!/usr/bin/env node
// Audio gate: stream layout, duration, loudness, beat detection.
// Checks the produced file, not the intent.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { renderSheet, toWav, KINDS, sheetFor } from '../src/audio.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'out/demo.mp4');
const { check, finish } = createGate();

const probe = JSON.parse(
  execFileSync('ffprobe', [
    '-v', 'error', '-print_format', 'json',
    '-show_format', '-show_streams', file,
  ]).toString(),
);

const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');

check('video stream present', Boolean(v), v ? `${v.codec_name} ${v.width}x${v.height}` : 'missing');
check('audio stream present', Boolean(a), a ? `${a.codec_name} ${a.sample_rate}Hz ${a.channels}ch` : 'missing');
check('audio is aac 48k stereo', Boolean(a && a.codec_name === 'aac' && a.sample_rate === '48000' && a.channels === 2));

const loud = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'ebur128', '-f', 'null', '-'], {
  encoding: 'utf8',
}).stderr;
// ebur128 prints a running I: line every 100 ms; the summary is the last one.
const all = [...loud.matchAll(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/g)];
const lufs = all.length ? Number(all[all.length - 1][1]) : NaN;
check('integrated loudness ≈ -14 LUFS', Math.abs(lufs - -14) <= 1.5, `${lufs} LUFS`);

const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const expected = timeline.duration;
check('duration matches timeline', Math.abs(Number(probe.format.duration) - expected) < 0.2, `${probe.format.duration}s vs ${expected}s`);
const beats = JSON.parse(fs.readFileSync(path.join(ROOT, 'out/beats.json'), 'utf8'));
check('tempo detected ≈ 120', Math.abs(beats.bpm - 120) <= 3, `${beats.bpm} BPM`);
const expectedBeats = Math.round((beats.bpm / 60) * timeline.duration);
check('beat count plausible', Math.abs(beats.beats.length - expectedBeats) <= 2, `${beats.beats.length} vs ~${expectedBeats}`);
check('wave.png exists', fs.existsSync(path.join(ROOT, 'out/wave.png')));

// --- the route a film actually uses: audio.json -> make-audio.mjs -> timeline ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-audio-'));
try {
  const film = path.join(tmp, 'motion');
  fs.mkdirSync(film, { recursive: true });
  const sheet = {
    layers: [
      { kind: 'rain' },
      { kind: 'pad', bpm: 50 },
      { kind: 'bell', at: 1.5, freq: 660 },
    ],
  };
  fs.writeFileSync(path.join(film, 'timeline.json'), JSON.stringify({ duration: 3, scenes: [] }));
  fs.writeFileSync(path.join(film, 'audio.json'), JSON.stringify(sheet));

  const run = spawnSync(process.execPath, [path.join(ROOT, 'skills/dsh-motion/scripts/make-audio.mjs'), '--write'], {
    cwd: tmp,
    env: { ...process.env, DSH_MOTION_PROJECT: film },
    encoding: 'utf8',
  });
  check('make-audio runs on a film', run.status === 0, (run.stderr || run.stdout || '').trim().split('\n')[0]);

  const wav = path.join(film, 'assets/audio/bed.wav');
  check('it writes the score where the timeline can find it', fs.existsSync(wav), 'assets/audio/bed.wav');
  const written = JSON.parse(fs.readFileSync(path.join(film, 'timeline.json'), 'utf8'));
  check('it wires timeline.audio', written.audio?.src === 'assets/audio/bed.wav', JSON.stringify(written.audio ?? null));
  check('it writes the beat grid when the sheet has a tempo', written.beats?.bpm === 50, JSON.stringify(written.beats?.bpm ?? null));
  check('it draws the waveform the agent has to look at', fs.existsSync(path.join(film, 'out/audio/wave.png')));

  const info = JSON.parse(
    execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_entries', 'stream=sample_rate,channels:format=duration', wav]).toString(),
  );
  check('the score is 48k stereo', info.streams?.[0]?.sample_rate === '48000' && info.streams?.[0]?.channels === 2);
  check('the score is as long as the film', Math.abs(Number(info.format?.duration) - 3) < 0.01, info.format?.duration);

  // Same sheet, same file: a re-cut score has to land on the same frames.
  const a = toWav(renderSheet(sheetFor(sheet, 3)));
  const b = toWav(renderSheet(sheetFor(sheet, 3)));
  check('the same sheet renders the same bytes', Buffer.compare(a, b) === 0, `${a.length} bytes`);

  let bad = '';
  try {
    renderSheet({ length: 1, layers: [{ kind: 'thunder' }] });
  } catch (err) {
    bad = err.message;
  }
  check('an unknown kind names the ones that exist', bad.includes('thunder') && bad.includes('rain'), bad.slice(0, 60));
  let drift = '';
  try {
    sheetFor({ length: 5, layers: [{ kind: 'rain' }] }, 3);
  } catch (err) {
    drift = err.message;
  }
  check('a sheet that disagrees with the cut is refused', Boolean(drift), drift.slice(0, 50));
  check('the kind list is the documented one', Object.keys(KINDS).length >= 8, Object.keys(KINDS).join(','));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
