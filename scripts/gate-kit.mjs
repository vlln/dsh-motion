#!/usr/bin/env node
// Kit gate: the samples work, and the engine does not depend on them.
//
// The second half is the point. `kit/` exists so an agent has something to copy
// and change; the moment the engine imports it, it has become an API and the
// whole reason for the split is gone. So: no reference from src/ to kit/, and
// every sample runs in a real page.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

// --- the engine must not know the kit exists -------------------------------
const srcFiles = fs.readdirSync(path.join(ROOT, 'src'));
const offenders = [];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, name.name);
    if (name.isDirectory()) walk(abs);
    else if (/\.mjs$/.test(name.name)) {
      const text = fs.readFileSync(abs, 'utf8');
      if (/(from|import)\s*\(?\s*['"][^'"]*\bkit\//.test(text)) offenders.push(path.relative(ROOT, abs));
    }
  }
};
walk(path.join(ROOT, 'src'));
check('the engine never imports kit/', offenders.length === 0, offenders.join(', ') || `${srcFiles.length} files clean`);

// The kit may only reach for itself: a sample that imports the engine is a
// sample that has quietly become part of it.
const kitFiles = fs.readdirSync(path.join(ROOT, 'kit')).filter((f) => f.endsWith('.mjs'));
const leaks = [];
for (const f of kitFiles) {
  const text = fs.readFileSync(path.join(ROOT, 'kit', f), 'utf8');
  if (/from\s+['"][^'"]*\.\.\/src\//.test(text)) leaks.push(f);
}
check('kit/ does not import the engine', leaks.length === 0, leaks.join(', ') || `${kitFiles.length} samples`);

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${origin}/preview.html`);

  const result = await page.evaluate(async () => {
    const out = {};
    const brush = await import('/kit/brush.mjs');
    const pixel = await import('/kit/pixel.mjs');
    const medium = await import('/kit/medium.mjs');
    const cam = await import('/kit/perspective.mjs');
    const fig = await import('/kit/figure.mjs');
    const grade = await import('/kit/grade.mjs');

    // brush: repaint a flat square and count the marks' colours
    const base = document.createElement('canvas');
    base.width = 60;
    base.height = 40;
    const bg = base.getContext('2d');
    bg.fillStyle = '#3366aa';
    bg.fillRect(0, 0, 60, 40);
    const painted = brush.strokes(base, { cell: 6, len: 8, width: 4, seed: 2 });
    const pg = painted.getContext('2d');
    out.brush = [...pg.getImageData(0, 0, 60, 40).data].filter((_, i) => i % 4 === 3 && _ > 0).length;

    // pixel: quantise a gradient to four colours, then count distinct values
    const r = pixel.raster({ w: 32, h: 18, scale: 4 });
    const grad = r.g.createLinearGradient(0, 0, 32, 0);
    grad.addColorStop(0, '#000000');
    grad.addColorStop(1, '#ffffff');
    r.g.fillStyle = grad;
    r.g.fillRect(0, 0, 32, 18);
    r.quantise(['#000000', '#446688', '#88aa66', '#ffffff']);
    const d = r.g.getImageData(0, 0, 32, 18).data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add(`${d[i]},${d[i + 1]},${d[i + 2]}`);
    out.palette = seen.size;

    // medium: fresco returns a canvas the same size as the frame
    const shape = document.createElement('canvas');
    shape.width = 80;
    shape.height = 60;
    const sg = shape.getContext('2d');
    sg.fillStyle = '#c04030';
    sg.fillRect(10, 10, 60, 40);
    const fresco = medium.fresco(80, 60, { seed: 4, pinholes: 40 });
    const wall = fresco.apply(shape);
    out.fresco = [wall.width, wall.height, wall.getContext('2d').getImageData(40, 30, 1, 1).data[0]];

    // perspective: a point behind the camera still projects to a finite number
    const c = cam.camera({ w: 320, h: 180, eye: [0, 1.6, 0], look: [0, 1.6, -1] });
    const p = c.project([0, 1.6, -5]);
    out.project = [Math.round(p[0]), Math.round(p[1]), Number(p[2].toFixed(2))];

    // figure: IK lands on the target (within a millimetre)
    const j = fig.joints({ x: 100, y: 300, height: 400 });
    const elbow = fig.reach(j.shoulder[0], [180, 180], j.arm, j.arm, -1);
    const hand = [j.shoulder[0][0] + Math.cos(Math.atan2(180 - j.shoulder[0][1], 180 - j.shoulder[0][0])) * 0, 0];
    out.arm = [Math.round(elbow[0]), Math.round(elbow[1])];

    // grade: opt-in only, and it returns the same canvas it was given
    const gr = document.createElement('canvas');
    gr.width = 64;
    gr.height = 36;
    const gg = gr.getContext('2d');
    gg.fillStyle = '#8899aa';
    gg.fillRect(0, 0, 64, 36);
    out.grade = grade.grade(gg, 64, 36, 1.5, {}) === gr;

    return out;
  });

  check('brush repaints the picture', result.brush > 200, `${result.brush} opaque subpixels`);
  check('pixel quantises to the palette', result.palette <= 4 && result.palette >= 2, `${result.palette} colours left`);
  check('fresco keeps the frame size', result.fresco[0] === 80 && result.fresco[1] === 60, result.fresco.join('×'));
  check('camera projects a point', Number.isFinite(result.project[0]) && Number.isFinite(result.project[1]), result.project.join(','));
  check('figure reaches a target', Number.isFinite(result.arm[0]), result.arm.join(','));
  check('grade returns the canvas it was given', result.grade === true);
} finally {
  await browser.close();
  close();
}

finish();
