#!/usr/bin/env node
// Medium gate: a material pass has to actually change the picture, and it has to
// change it the same way twice. Two halves:
//   1. the stroke planner is pure, so it can be checked without a browser;
//   2. a real render through the real pipeline, compared on edge density —
//      because "it ran" is not the same as "it painted".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { planStrokes } from '../src/medium.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(ROOT, 'bin/dsh-motion.mjs');
const { check, finish } = createGate();
const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

// --- 1. the planner ---------------------------------------------------------
const W = 320;
const H = 180;
const data = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const ground = y > H * 0.6;
    data[i] = ground ? 200 : 40;
    data[i + 1] = ground ? 170 : 60;
    data[i + 2] = ground ? 90 : 110;
    data[i + 3] = 255;
  }
}
const plan = (kind, opts = {}) => planStrokes({ w: W, h: H, data }, { kind, seed: 7, ...opts });

const kinds = ['broken', 'charcoal', 'silk', 'print'];
const plans = Object.fromEntries(kinds.map((k) => [k, plan(k)]));

check('every channel plans strokes', kinds.every((k) => plans[k].length > 20), kinds.map((k) => `${k}:${plans[k].length}`).join(' '));
check(
  'the same input plans the same strokes',
  kinds.every((k) => JSON.stringify(plan(k)) === JSON.stringify(plans[k])),
  'byte-identical',
);
const signatures = new Set(kinds.map((k) => JSON.stringify(plans[k].slice(0, 40))));
check('the channels are not the same pass twice', signatures.size === kinds.length, `${signatures.size} distinct`);

const dense = plan('broken', { density: 2 });
check('density buys more strokes', dense.length > plans.broken.length * 1.8, `${plans.broken.length} → ${dense.length}`);

// A halftone is a lattice: the dot count is the screen, not a scatter.
const step = Math.max(3, Math.round(6));
const lattice = Math.ceil(W / step) * Math.ceil(H / step);
check(
  'print lays dots on a screen',
  Math.abs(plans.print.length - lattice) / lattice < 0.15,
  `${plans.print.length} vs ${lattice} cells`,
);

// Coverage: rasterise the stroke boxes into a coarse grid and count the cells.
const coverage = (strokes) => {
  const grid = new Uint8Array(64 * 36);
  for (const s of strokes) {
    // a stroke is long as well as wide: the box has to follow its angle
    const rx = s.kind === 'print' ? s.r : Math.abs(Math.cos(s.a)) * s.len * 0.5 + s.wid * 0.5;
    const ry = s.kind === 'print' ? s.r : Math.abs(Math.sin(s.a)) * s.len * 0.5 + s.wid * 0.5;
    const x0 = Math.max(0, Math.floor(((s.x - rx) / W) * 64));
    const x1 = Math.min(63, Math.ceil(((s.x + rx) / W) * 64));
    const y0 = Math.max(0, Math.floor(((s.y - ry) / H) * 36));
    const y1 = Math.min(35, Math.ceil(((s.y + ry) / H) * 36));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * 64 + x] = 1;
  }
  return grid.reduce((a, b) => a + b, 0) / grid.length;
};
for (const k of kinds) {
  check(`${k} covers the surface`, coverage(plans[k]) > 0.6, `${Math.round(coverage(plans[k]) * 100)}%`);
}

const bad = Object.values(plans).flat().filter((s) => !s.color.every((c) => c >= 0 && c <= 255));
check('no stroke carries an out-of-range colour', bad.length === 0, bad.length ? `${bad.length} bad` : 'none');

// --- 2. through the real renderer -------------------------------------------
/** Edge-map brightness: 0 is a flat fill, 20+ is a painted surface. */
const edgeDensity = (file) => {
  // metadata=print writes to the log, so stderr is the measurement.
  const res = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-i', file, '-vf', 'edgedetect=low=0.05:high=0.15,signalstats,metadata=print', '-frames:v', '1', '-f', 'null', '-'],
    { encoding: 'utf8' },
  );
  const hit = /lavfi\.signalstats\.YAVG=([0-9.]+)/.exec(String(res.stderr ?? ''));
  return Number(hit?.[1] ?? 0);
};

/**
 * Build a two-halves test film for one channel: the same picture drawn plainly on
 * the left and passed through the medium on the right. Everything after this is
 * a comparison, never an absolute.
 */
function buildFilm(dir, channel, { strokes = false } = {}) {
  const film = path.join(dir, 'motion');
  fs.mkdirSync(path.join(film, 'scenes'), { recursive: true });
  fs.writeFileSync(
    path.join(film, 'timeline.json'),
    JSON.stringify({
      width: 640,
      height: 360,
      fps: 12,
      duration: 2,
      palettes: { main: { bg: '#101820', fg: '#f0ead8', accent: '#e0a040', muted: '#8899aa', grid: '#22303a', panel: '#0c1218' } },
      texts: {},
      values: {},
      overrides: {},
      scenes: [{ id: 'pass', name: 'pass', start: 0, length: 2, palette: 'main', speed: 1 }],
    }),
  );
  fs.writeFileSync(
    path.join(film, 'scenes/pass.mjs'),
    `export const id = 'pass';
export const slots = {};
export const textUsage = {};
let ctx;
let painted = null;
let plain = null;
export function mount(context) {
  ctx = context;
  const base = document.createElement('canvas');
  base.width = 640; base.height = 360;
  const g = base.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 360);
  sky.addColorStop(0, '#20396b'); sky.addColorStop(1, '#c68a52');
  g.fillStyle = sky; g.fillRect(0, 0, 640, 360);
  g.fillStyle = '#c79a45'; g.fillRect(0, 240, 640, 120);
  g.fillStyle = '#3d5a45';
  g.beginPath(); g.moveTo(0, 230); g.quadraticCurveTo(320, 150, 640, 230); g.lineTo(640, 360); g.lineTo(0, 360); g.fill();
  // Busy enough that "softening" is measurable: a wash of one colour proves
  // nothing, a picture with detail in it does.
  for (let i = 0; i < 90; i++) {
    const x = (i * 61) % 620;
    const y = 30 + ((i * 37) % 300);
    g.fillStyle = i % 3 === 0 ? '#e8d9b0' : i % 3 === 1 ? '#7b3a2a' : '#22303a';
    g.fillRect(x, y, 6 + (i % 5) * 3, 4 + (i % 4) * 2);
  }
  const paintedMode = ${strokes ? 'true' : 'false'};
  painted = paintedMode
    ? ctx.paint.strokes(base, { cell: 10, len: 18, width: 5, seed: 3, t: 0, boil: 0 })
    : ctx.medium.${channel}(base, { density: 1, seed: 4 });
  plain = base;
}
export function render(t) {
  const g = ctx.canvas.getContext('2d');
  // left: the shapes as drawn. right: the same shapes after the material pass.
  g.drawImage(plain, 0, 0, 320, 360, 0, 0, 320, 360);
  g.drawImage(painted, 320, 0, 320, 360, 320, 0, 320, 360);
  void t;
}
`,
  );

  const run = (dir, out) =>
    execFileSync(process.execPath, [BIN, 'render', '--stills', '1', '--cols', '1', '--out', out], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

  run(dir, 'out/a.png');
  run(dir, 'out/b.png');
  const a = path.join(film, 'out/a-frames/00.png');
  const b = path.join(film, 'out/b-frames/00.png');
  return { film, a, b };
}

/** Edge density of each half: the plain one and the passed-through one. */
const halves = (file) => {
  const left = path.join(path.dirname(file), 'left.png');
  const right = path.join(path.dirname(file), 'right.png');
  for (const [out, x] of [[left, 0], [right, 320]]) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-vf', `crop=320:360:${x}:0`, out]);
  }
  return { left: edgeDensity(left), right: edgeDensity(right) };
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-medium-'));
try {
  // A hard channel: it must put edges *into* the picture.
  const hard = buildFilm(path.join(tmp, 'hard'), 'broken');
  check('a scene using a medium renders', fs.existsSync(hard.a), 'out/a-frames/00.png');
  check('the same scene renders byte-identically', sha(hard.a) === sha(hard.b), sha(hard.a).slice(0, 12));
  const h = halves(hard.a);
  check(
    'a hard channel puts edges into the picture',
    h.right > h.left * 1.5 && h.right > 1,
    `plain ${h.left.toFixed(2)} → broken ${h.right.toFixed(2)}`,
  );

  // The stroke layer: the same picture, repainted per frame as brush marks.
  const brush = buildFilm(path.join(tmp, 'brush'), 'broken', {
    strokes: true,
  });
  const br = halves(brush.a);
  check(
    'the stroke layer puts marks on the whole frame',
    br.right > br.left * 1.5 && br.right > 1,
    `plain ${br.left.toFixed(2)} → strokes ${br.right.toFixed(2)}`,
  );

  // A soft channel: fog has no edge, so it must take edges *out*.
  const soft = buildFilm(path.join(tmp, 'soft'), 'mist');
  const s = halves(soft.a);
  check(
    'a soft channel takes edges out of the picture',
    s.right < s.left * 0.75,
    `plain ${s.left.toFixed(2)} → mist ${s.right.toFixed(2)}`,
  );
  check(
    'a soft channel softens rather than erases',
    s.right > s.left * 0.05,
    `mist keeps ${Math.round((s.right / Math.max(0.01, s.left)) * 100)}% of the edges`,
  );
  check(
    'soft and hard are not the same pass',
    Math.abs(s.right - h.right) > 1,
    `mist ${s.right.toFixed(2)} vs broken ${h.right.toFixed(2)}`,
  );
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

finish();
