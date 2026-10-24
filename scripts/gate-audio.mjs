#!/usr/bin/env node
// Audio gate: stream layout, duration, loudness, beat detection.
// Checks the produced file, not the intent.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { renderSheet, toWav, KINDS, sheetFor, noteHz, parseChord, VOICE_NAMES, beatGrid } from '../src/audio.mjs';
import { mux } from './mux.mjs';

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

  // A typo in a score has to fail in `check`, not 60 seconds into a render.
  for (const [what, mutate, needle] of [
    ['voice', (x) => (x.layers[0].sections[0].voice = 'cello'), 'cello'],
    ['chord', (x) => (x.layers[0].chords = ['Dmaj9sus']), 'maj9sus'],
    ['key', (x) => (x.layers[0].key = 'H3'), 'H3'],
    ['section length', (x) => (x.layers[0].sections[0].eighths = 0), 'eighths'],
  ]) {
    const broken = { length: 8, layers: [{ kind: 'score', bpm: 120, key: 'D3', chords: ['Dm'], motif: [0, 3, 7], sections: [{ eighths: 4, voice: 'harp' }] }] };
    mutate(broken);
    let message = '';
    try {
      sheetFor(broken, 8);
    } catch (err) {
      message = err.message;
    }
    check(`a bad ${what} is refused before render`, message.includes(needle), message.slice(0, 60));
  }

  // --- a score: the note written is the note sounded -------------------------
  check('A4 is 440 Hz', Math.abs(noteHz('A4') - 440) < 0.01, noteHz('A4').toFixed(2));
  check('Dm is a minor triad', JSON.stringify(parseChord('Dm').semis) === '[0,3,7]', parseChord('Dm').semis.join(','));

  const score = {
    length: 8,
    layers: [
      { kind: 'score', bpm: 120, key: 'D3', chords: ['Dm', 'Bb'], motif: [0, 3, 7], sections: [
        { eighths: 8, voice: 'harp' },
        { eighths: 8, voice: 'flute' },
      ] },
    ],
  };
  const rendered = renderSheet(score);
  // Goertzel: how much of the signal sits at one frequency.
  const at = (buf, freq, from, to) => {
    const sr = rendered.sampleRate;
    const coeff = 2 * Math.cos((2 * Math.PI * freq) / sr);
    let q1 = 0;
    let q2 = 0;
    for (let i = from; i < to; i++) {
      const q0 = coeff * q1 - q2 + buf[i];
      q2 = q1;
      q1 = q0;
    }
    return Math.sqrt(Math.max(0, q1 * q1 + q2 * q2 - coeff * q1 * q2)) / (to - from);
  };
  const loudestMidi = (from, to) => {
    let best = { midi: 0, mag: 0 };
    for (let midi = 36; midi < 96; midi++) {
      const mag = at(rendered.left, 440 * 2 ** ((midi - 69) / 12), from, to);
      if (mag > best.mag) best = { midi, mag };
    }
    return best.midi;
  };
  const eighth = 60 / 120 / 2;
  check('section one sounds its chord root (D3)', loudestMidi(Math.round(0.02 * 48000), Math.round(0.14 * 48000)) === 50, 'midi 50 = D3');
  const second = Math.round((8 * eighth + 0.02) * 48000);
  // Bb is four semitones under D: the score transposes down, not up an octave.
  check('section two transposes to Bb2', loudestMidi(second, second + Math.round(0.12 * 48000)) === 46, 'midi 46 = Bb2');
  check('the score publishes its grid', beatGrid(score)?.bpm === 120, JSON.stringify(beatGrid(score)?.bpm));
  check('every voice is a real one', VOICE_NAMES.every((v) => typeof v === 'string') && VOICE_NAMES.includes('harp'), VOICE_NAMES.join(','));

  let badChord = '';
  try {
    renderSheet({ length: 1, layers: [{ kind: 'score', chords: ['Dmaj9sus'] }] });
  } catch (err) {
    badChord = err.message;
  }
  check('an unknown chord names the qualities that exist', badChord.includes('Dmaj9sus') && badChord.includes('m7'), badChord.slice(0, 70));

  // --- a track someone brought: the picture decides the length, not the track ---
  // This is the bug the fit rules exist for: a 1s cue used to cut a 2s film to 1s.
  const clip = path.join(tmp, 'clip');
  fs.mkdirSync(clip, { recursive: true });
  const silent = path.join(clip, 'silent.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=160x90:d=2', '-pix_fmt', 'yuv420p', silent]);
  const tone = path.join(clip, 'tone.wav');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ac', '2', '-ar', '48000', tone]);

  const probeMux = (file) =>
    JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_entries', 'format=duration', '-show_entries', 'stream=codec_type,duration', file]).toString());
  const levelAt = (file, at) => {
    const log = spawnSync('ffmpeg', ['-hide_banner', '-ss', String(at), '-t', '0.5', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
    const hit = /mean_volume:\s*(-?[0-9.]+) dB/.exec(log);
    return hit ? Number(hit[1]) : -Infinity;
  };

  for (const [fit, repeats] of [['trim', false], ['loop', true]]) {
    const out = path.join(clip, `${fit}.mp4`);
    await mux({ silent, audio: tone, out, duration: 2, fit, targetLufs: -20, fadeOut: 1.5 });
    const info = probeMux(out);
    const audio = info.streams.find((x) => x.codec_type === 'audio');
    check(`fit ${fit}: the film keeps its length`, Math.abs(Number(info.format.duration) - 2) < 0.06, info.format.duration);
    check(`fit ${fit}: the audio stream is as long as the film`, Math.abs(Number(audio?.duration) - 2) < 0.08, audio?.duration);
    const late = levelAt(out, 1.4);
    check(`fit ${fit}: ${repeats ? 'the cue repeats' : 'the rest is silence'}`, repeats ? late > -45 : late < -60, `${late} dB at 1.4s`);
  }

  // --- --use: a file someone brought becomes the score, and is copied inside ---
  const brought = path.join(tmp, 'brought.wav');
  fs.copyFileSync(tone, brought);
  const film2 = path.join(tmp, 'film2');
  fs.mkdirSync(film2, { recursive: true });
  fs.writeFileSync(path.join(film2, 'timeline.json'), JSON.stringify({ duration: 2, scenes: [] }));
  const adopt = spawnSync(
    process.execPath,
    [path.join(ROOT, 'skills/dsh-motion/scripts/make-audio.mjs'), '--use', brought, '--loop', '--write'],
    { cwd: tmp, env: { ...process.env, DSH_MOTION_PROJECT: film2 }, encoding: 'utf8' },
  );
  check('--use adopts a track', adopt.status === 0, (adopt.stderr || adopt.stdout || '').trim().split('\n')[0]);
  const adopted = JSON.parse(fs.readFileSync(path.join(film2, 'timeline.json'), 'utf8'));
  check('--use copies the file into the film', fs.existsSync(path.join(film2, 'assets/audio/brought.wav')), adopted.audio?.src);
  check('--use records a path the film can serve', adopted.audio?.src === 'assets/audio/brought.wav', adopted.audio?.src);
  check('--use records the fit', adopted.audio?.fit === 'loop', adopted.audio?.fit);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
