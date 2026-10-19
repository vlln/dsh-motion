#!/usr/bin/env node
// Deterministic music bed: 120 BPM, 15 s, stereo 44.1k.
// No samples, no licenses — every sound is synthesized here.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SR = 44100;
const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
const DUR = Number(process.argv[2] ?? timeline.duration ?? 15);
const BPM = 120;
const BEAT = 60 / BPM;
const N = Math.round(SR * DUR);

const out = Buffer.alloc(44 + N * 4);
const L = new Float32Array(N);
const R = new Float32Array(N);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(42);

// pad: Am chord, slow swell, gain lifts after the 8 s "drop"
const pad = [110.0, 138.59, 164.81, 220.0];
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const lift = t >= 8 ? 1.35 : 1;
  const env = Math.min(1, t / 1.2) * (0.75 + 0.25 * Math.sin(2 * Math.PI * 0.07 * t)) * lift;
  let s = 0;
  for (const [k, f] of pad.entries()) {
    s += Math.sin(2 * Math.PI * f * t + k * 1.7) * (0.16 / (k + 1));
    s += Math.sin(2 * Math.PI * f * 1.005 * t) * 0.05;
  }
  L[i] += s * env * 0.9;
  R[i] += s * env * 0.9;
}

// kick on every beat
for (let b = 0; b * BEAT < DUR; b++) {
  const start = Math.round(b * BEAT * SR);
  const len = Math.round(0.16 * SR);
  for (let j = 0; j < len && start + j < N; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 26);
    const f = 48 + 90 * Math.exp(-t * 30);
    const s = Math.sin(2 * Math.PI * f * t) * env * 0.55;
    L[start + j] += s;
    R[start + j] += s;
  }
}

// hats on off-beats
for (let b = 0; b * BEAT + BEAT / 2 < DUR; b++) {
  const start = Math.round((b * BEAT + BEAT / 2) * SR);
  const len = Math.round(0.05 * SR);
  let prev = 0;
  for (let j = 0; j < len && start + j < N; j++) {
    const n = rand() * 2 - 1;
    const hp = n - prev;
    prev = n;
    const env = Math.exp(-(j / SR) * 90);
    L[start + j] += hp * env * 0.10;
    R[start + j] += hp * env * 0.13;
  }
}

// riser before the drop at 8 s
for (let i = Math.round(7.2 * SR); i < Math.round(8.0 * SR); i++) {
  const t = (i / SR - 7.2) / 0.8;
  const n = rand() * 2 - 1;
  const s = n * t * t * 0.10;
  L[i] += s;
  R[i] += s;
}

// impact on the drop at 8 s: noise burst + low thump, so the downbeat is detectable
{
  const start = Math.round(8.0 * SR);
  const len = Math.round(0.5 * SR);
  for (let j = 0; j < len && start + j < N; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 7);
    const n = (rand() * 2 - 1) * env * 0.45;
    const thump = Math.sin(2 * Math.PI * 58 * t) * env * 0.5;
    L[start + j] += n + thump;
    R[start + j] += n + thump;
  }
}

// master: soft clip + normalize to 0.7 peak
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 1.1);
  R[i] = Math.tanh(R[i] * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = 0.7 / (peak || 1);

function writeWav() {
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + N * 4, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(SR, 24);
  out.writeUInt32LE(SR * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) {
    out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(L[i] * gain * 32767))), 44 + i * 4);
    out.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(R[i] * gain * 32767))), 46 + i * 4);
  }
  const dest = path.join(ROOT, 'out', 'bed.wav');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  console.log(`bed → ${path.relative(ROOT, dest)}  ${DUR}s ${BPM}BPM`);
}

writeWav();
