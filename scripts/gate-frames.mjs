#!/usr/bin/env node
// Frames gate: reading a reference video must produce frames, a sheet and cuts —
// inside the film, with no extra state outside it.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/dsh-motion.mjs');
const { check, finish } = createGate();

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-frames-'));
try {
  execFileSync(process.execPath, [BIN, 'init', '--title', 'gate'], { cwd: tmp });
  check('init made a film', fs.existsSync(path.join(tmp, 'motion/timeline.json')));

  // Two solid seconds with a hard cut at 1.0s.
  execFileSync(
    'ffmpeg',
    [
      '-v', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=red:s=320x240:d=1',
      '-f', 'lavfi', '-i', 'color=c=blue:s=320x240:d=1',
      '-filter_complex', '[0:v][1:v]concat=n=2:v=1',
      '-pix_fmt', 'yuv420p', 'clip.mp4',
    ],
    { cwd: tmp },
  );

  // --- reference: the one door to a video. Template, frames, sheet, cuts, brief.
  const ref = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-ref-'));
  try {
    fs.copyFileSync(path.join(tmp, 'clip.mp4'), path.join(ref, 'clip.mp4'));
    const out = execFileSync(process.execPath, [BIN, 'reference', 'clip.mp4', '--template', 'kinetic'], {
      cwd: ref,
      encoding: 'utf8',
    });
    check('reference starts a film', fs.existsSync(path.join(ref, 'motion/timeline.json')), out.split('\n')[0]);
    const timeline = JSON.parse(fs.readFileSync(path.join(ref, 'motion/timeline.json'), 'utf8'));
    check('the film uses the chosen template', timeline.scenes[0]?.id === 'kinetic', timeline.scenes[0]?.id);

    const brief = JSON.parse(fs.readFileSync(path.join(ref, 'motion/out/ref/brief.json'), 'utf8'));
    check('the brief records the cut', brief.reference.cuts.some((c) => Math.abs(c - 1) < 0.2), brief.reference.cuts.join(', '));
    check('the brief names the next steps', Array.isArray(brief.next) && brief.next.length >= 3, String(brief.next?.length));

    const ok = execFileSync(process.execPath, [BIN, 'check', '--fast'], { cwd: ref, encoding: 'utf8' });
    check('the new film passes check', /ok · 1 scene/.test(ok), ok.trim().split('\n').pop());

    // --- storyboard: cuts become a shot list, and --write rebuilds the timeline
    execFileSync(process.execPath, [BIN, 'reference', '--shots', '--write'], { cwd: ref, encoding: 'utf8' });
    const story = JSON.parse(fs.readFileSync(path.join(ref, 'motion/out/ref/storyboard.json'), 'utf8'));
    check('the storyboard has a beat', story.beats.length >= 1, String(story.beats.length));
    check('beats carry a start and a length', story.beats.every((b) => typeof b.start === 'number' && b.length > 0), JSON.stringify(story.beats[0]));

    const rebuilt = JSON.parse(fs.readFileSync(path.join(ref, 'motion/timeline.json'), 'utf8'));
    check('the timeline was rebuilt from beats', rebuilt.scenes.length === story.beats.length, String(rebuilt.scenes.length));
    check(
      'each beat has its own scene id',
      new Set(rebuilt.scenes.map((s) => s.id)).size === rebuilt.scenes.length,
      rebuilt.scenes.map((s) => s.id).join(','),
    );
    const after = execFileSync(process.execPath, [BIN, 'check', '--fast'], { cwd: ref, encoding: 'utf8' });
    check('the rebuilt film passes check', /ok ·/.test(after), after.trim().split('\n').pop());

    const still = path.join(ref, 'motion/out/ref/beats/beat01.png');
    check('each beat got a still', fs.existsSync(still), 'out/ref/beats/beat01.png');
    const story2 = JSON.parse(fs.readFileSync(path.join(ref, 'motion/out/ref/storyboard.json'), 'utf8'));
    check('the storyboard links the still', story2.beats[0]?.still === 'out/ref/beats/beat01.png', story2.beats[0]?.still);
  } finally {
    fs.rmSync(ref, { recursive: true, force: true });
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
finish();
