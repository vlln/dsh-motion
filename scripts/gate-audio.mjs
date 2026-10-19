#!/usr/bin/env node
// Audio gate: stream layout, duration, loudness, beat detection.
// Checks the produced file, not the intent.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'out/demo.mp4');
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

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

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
