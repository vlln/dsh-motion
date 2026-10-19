#!/usr/bin/env node
// Beat analysis: onset envelope -> tempo -> beat grid -> bars + drop.
// Pure JS, no deps. Output is what the timeline stores under `beats`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readWav(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('not a wav');
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      fmt = {
        channels: buf.readUInt16LE(off + 10),
        rate: buf.readUInt32LE(off + 12),
        bits: buf.readUInt16LE(off + 22),
      };
    } else if (id === 'data') {
      data = buf.subarray(off + 8, off + 8 + size);
    }
    off += 8 + size + (size % 2);
  }
  if (!fmt || !data) throw new Error('missing fmt/data');

  const bytes = fmt.bits / 8;
  const frames = Math.floor(data.length / (bytes * fmt.channels));
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const o = (i * fmt.channels + c) * bytes;
      s += bytes === 2 ? data.readInt16LE(o) / 32768 : data.readFloatLE(o);
    }
    mono[i] = s / fmt.channels;
  }
  return { rate: fmt.rate, mono, duration: frames / fmt.rate };
}

export function analyse({ rate, mono, duration }) {
  const hop = 512;
  const win = 1024;
  const frames = Math.floor((mono.length - win) / hop);
  const env = new Float32Array(frames);

  let prev = 0;
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const o = f * hop;
    for (let i = 0; i < win; i++) e += mono[o + i] * mono[o + i];
    const rms = Math.sqrt(e / win);
    const flux = Math.max(0, rms - prev); // onset strength
    env[f] = flux;
    prev = rms * 0.86 + prev * 0.14;
  }

  // smooth
  const sm = new Float32Array(frames);
  for (let i = 1; i < frames - 1; i++) sm[i] = (env[i - 1] + 2 * env[i] + env[i + 1]) / 4;

  // autocorrelation over plausible beat periods
  const fps = rate / hop;
  let best = { bpm: 0, score: -1 };
  for (let bpm = 70; bpm <= 170; bpm += 0.5) {
    const lag = Math.round((60 / bpm) * fps);
    let score = 0;
    for (let i = 0; i + lag < frames; i++) score += sm[i] * sm[i + lag];
    if (score > best.score) best = { bpm, score };
  }

  // phase: offset with the strongest onset energy on the grid
  const period = (60 / best.bpm) * fps;
  let phase = 0;
  let phaseScore = -1;
  for (let p = 0; p < Math.round(period); p++) {
    let s = 0;
    for (let k = 0; ; k++) {
      const idx = Math.round(p + k * period);
      if (idx >= frames) break;
      s += sm[idx];
    }
    if (s > phaseScore) {
      phaseScore = s;
      phase = p;
    }
  }

  const beats = [];
  for (let k = 0; ; k++) {
    const t = (phase + k * period) / fps;
    if (t > duration) break;
    beats.push(Number(t.toFixed(3)));
  }

  // drop: biggest energy jump after the first third
  let drop = null;
  let maxJump = 0;
  const from = Math.floor(frames / 3);
  for (let i = from; i < frames - 1; i++) {
    const jump = sm[i + 1] - sm[i];
    if (jump > maxJump) {
      maxJump = jump;
      drop = i / fps;
    }
  }

  return {
    bpm: Number(best.bpm.toFixed(1)),
    beats,
    bars: beats.filter((_, i) => i % 4 === 0),
    drop: drop === null ? null : Number(drop.toFixed(2)),
    duration: Number(duration.toFixed(3)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const src = process.argv[2] ?? path.join(ROOT, 'out/bed.wav');
  const dest = process.argv[3] ?? path.join(ROOT, 'out/beats.json');
  const result = analyse(readWav(src));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(result, null, 2));
  console.log(`bpm=${result.bpm}  beats=${result.beats.length}  drop=${result.drop}s  → ${path.relative(ROOT, dest)}`);
}
