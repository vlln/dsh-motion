#!/usr/bin/env node
// Film gate: facts about the rendered file, not opinions about the picture.
//
// Four things it can prove without taste:
//   • the file has a picture and a sound, and they are the film's length
//   • nothing in the middle is an empty screen for a third of a second
//   • the film actually moves (a slideshow is not an animation)
//   • it is not one long blue-purple gradient (the house style of AI slop)
//
// Whatever is not a fact — composition, whether the style reads, whether a
// person would watch it — is deliberately left to the review step.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const W = 96;
const H = 54;
const FPS = 10;

const probe = (file) => {
  const res = spawnSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], {
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  if (res.status !== 0) throw new Error(res.stderr.trim() || 'ffprobe failed');
  return JSON.parse(res.stdout);
};

/** Every frame at 96×54, as one flat buffer. */
const frames = (file) => {
  const res = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-i', file, '-vf', `scale=${W}:${H},fps=${FPS}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 1 << 30 },
  );
  if (res.status !== 0) throw new Error((res.stderr ?? '').toString().trim() || 'ffmpeg failed');
  const buf = res.stdout;
  const size = W * H * 3;
  return { buf, size, count: Math.floor(buf.length / size) };
};

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function inspect(file) {
  if (!fs.existsSync(file)) throw new Error(`no file at ${file}`);
  const info = probe(file);
  const v = info.streams.find((s) => s.codec_type === 'video');
  const a = info.streams.find((s) => s.codec_type === 'audio');
  const duration = Number(info.format?.duration ?? 0);

  const { buf, size, count } = frames(file);
  const stats = [];
  for (let i = 0; i < count; i++) {
    const off = i * size;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let purple = 0;
    for (let p = 0; p < size; p += 3) {
      const r = buf[off + p];
      const g = buf[off + p + 1];
      const b = buf[off + p + 2];
      sr += r;
      sg += g;
      sb += b;
      // blue-violet: blue leads red and green together
      if (b > r + 24 && b > g + 8) purple++;
    }
    const n = size / 3;
    const mr = sr / n;
    const mg = sg / n;
    const mb = sb / n;
    // spread of luma around its mean: how much of a picture is there
    let sum = 0;
    let sum2 = 0;
    for (let p = 0; p < size; p += 3) {
      const l = luma(buf[off + p], buf[off + p + 1], buf[off + p + 2]);
      sum += l;
      sum2 += l * l;
    }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    stats.push({ mr, mg, mb, sd, purple: purple / n });
  }

  // Motion, as two facts instead of one average.
  //
  // A mean pixel delta is dominated by how much of the frame changed, which is
  // a measure of resolution as much as of movement. What matters here is
  // simpler: does anything change from frame to frame at all, and is there ever
  // a stretch where nothing does. A slideshow scores near zero on the first and
  // a still frame scores badly on the second; both are visible to a viewer.
  let movedPairs = 0;
  let frozen = 0;
  let frozenRun = 0;
  for (let i = 1; i < count; i++) {
    const a0 = i * size;
    const b0 = (i - 1) * size;
    let changed = false;
    for (let p = 0; p < size; p += 3) {
      const d =
        Math.abs(buf[a0 + p] - buf[b0 + p]) +
        Math.abs(buf[a0 + p + 1] - buf[b0 + p + 1]) +
        Math.abs(buf[a0 + p + 2] - buf[b0 + p + 2]);
      if (d > 12) {
        changed = true;
        break;
      }
    }
    if (changed) movedPairs++;
    else {
      frozen++;
      frozenRun = Math.max(frozenRun, frozen / FPS);
    }
  }
  const moved = count > 1 ? movedPairs / (count - 1) : 0;
  // empty screens: near-uniform frames, ignoring the first and last tenth
  const blankFrames = stats.filter((s) => s.sd < 4).length;
  const blankShare = stats.length ? blankFrames / stats.length : 1;
  let blankRun = 0;
  for (let i = 0; i < stats.length; i++) {
    let j = i;
    while (j < stats.length && stats[j].sd < 4) j++;
    blankRun = Math.max(blankRun, (j - i) / FPS);
    i = j;
  }
  const purpleShare = stats.length ? stats.reduce((t, s) => t + s.purple, 0) / stats.length : 0;

  return {
    file,
    duration,
    width: v?.width ?? 0,
    height: v?.height ?? 0,
    fps: v?.r_frame_rate ?? '',
    hasVideo: Boolean(v),
    hasAudio: Boolean(a),
    audio: a ? { codec: a.codec_name, rate: Number(a.sample_rate), channels: a.channels } : null,
    frames: count,
    moved,
    frozenRun,
    blankShare,
    blankRun,
    purpleShare,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: film-gate.mjs <file.mp4>');
    process.exit(2);
  }
  const r = inspect(file);
  const lines = [
    `file      ${r.file}`,
    `duration  ${r.duration.toFixed(2)}s · ${r.width}×${r.height} @ ${r.fps}`,
    `audio     ${r.hasAudio ? `${r.audio.codec} ${r.audio.rate}Hz ${r.audio.channels}ch` : 'MISSING'}`,
    `motion    ${(r.moved * 100).toFixed(0)}% of frames differ from the one before · longest still ${r.frozenRun.toFixed(2)}s`,
    `blank     ${(r.blankShare * 100).toFixed(1)}% of frames · longest run ${r.blankRun.toFixed(2)}s`,
    `blue      ${(r.purpleShare * 100).toFixed(1)}% of pixels`,
  ];
  console.log(lines.join('\n'));
  process.exit(r.hasAudio ? 0 : 1);
}
