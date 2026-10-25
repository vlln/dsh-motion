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

  // --- reference: breakdown of a video, inside a film that already has a shot.
  // The agent writes the first scene by hand; the reference pass then splits it
  // across the reference's own beats.
  const sceneDir = path.join(tmp, 'motion/scenes');
  fs.writeFileSync(
    path.join(sceneDir, 'shot.mjs'),
    `export const id = "shot";
export const kind = "canvas2d";
export const slots = {};
let ctx;
export function mount(c) { ctx = c; }
export function render(t) {
  const c = ctx;
  const g = c.canvas.getContext("2d");
  g.fillStyle = c.color("bg");
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = c.color("accent");
  g.fillRect(0, 0, 40 + (t % 1) * 200, c.height);
}
`,
  );
  const film = JSON.parse(fs.readFileSync(path.join(tmp, 'motion/timeline.json'), 'utf8'));
  film.duration = 2;
  film.scenes = [{ id: 'shot', name: '参考', start: 0, length: 2, palette: 'main', speed: 1 }];
  fs.writeFileSync(path.join(tmp, 'motion/timeline.json'), `${JSON.stringify(film, null, 2)}\n`);

  const out = execFileSync(process.execPath, [BIN, 'reference', 'clip.mp4'], { cwd: tmp, encoding: 'utf8' });
  check('reference reads the clip into the film', fs.existsSync(path.join(tmp, 'motion/out/ref/index.json')), out.split('\n')[0]);

  const brief = JSON.parse(fs.readFileSync(path.join(tmp, 'motion/out/ref/brief.json'), 'utf8'));
  check('the brief records the cut', brief.reference.cuts.some((c) => Math.abs(c - 1) < 0.2), brief.reference.cuts.join(', '));
  check('the brief names the next steps', Array.isArray(brief.next) && brief.next.length >= 3, String(brief.next?.length));

  // --- storyboard: cuts become a shot table, and with a shot in the film the
  // film itself is rebuilt one scene per beat.
  execFileSync(process.execPath, [BIN, 'reference', '--shots', '--write'], { cwd: tmp, encoding: 'utf8' });
  const story = JSON.parse(fs.readFileSync(path.join(tmp, 'motion/out/ref/storyboard.json'), 'utf8'));
  check('the storyboard has a beat', story.beats.length >= 1, String(story.beats.length));
  check('beats carry a start and a length', story.beats.every((b) => typeof b.start === 'number' && b.length > 0), JSON.stringify(story.beats[0]));
  const table = fs.readFileSync(path.join(tmp, 'motion/out/ref/镜头表.md'), 'utf8');
  check('the breakdown writes a shot table', /\| 时间段 \|/.test(table) && table.split('\n').length > 6, `${table.split('\n').length} lines`);

  const rebuilt = JSON.parse(fs.readFileSync(path.join(tmp, 'motion/timeline.json'), 'utf8'));
  check('the timeline was rebuilt from beats', rebuilt.scenes.length === story.beats.length, String(rebuilt.scenes.length));
  check(
    'each beat has its own scene id',
    new Set(rebuilt.scenes.map((s) => s.id)).size === rebuilt.scenes.length,
    rebuilt.scenes.map((s) => s.id).join(','),
  );
  const after = execFileSync(process.execPath, [BIN, 'check', '--fast'], { cwd: tmp, encoding: 'utf8' });
  check('the rebuilt film passes check', /ok ·/.test(after), after.trim().split('\n').pop());

  const still = path.join(tmp, 'motion/out/ref/beats/beat01.png');
  check('each beat got a still', fs.existsSync(still), 'out/ref/beats/beat01.png');
  const story2 = JSON.parse(fs.readFileSync(path.join(tmp, 'motion/out/ref/storyboard.json'), 'utf8'));
  check('the storyboard links the still', story2.beats[0]?.still === 'out/ref/beats/beat01.png', story2.beats[0]?.still);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
finish();
