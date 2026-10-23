#!/usr/bin/env node
// Params gate: the panel must be a writer, not a viewer.
// Asserts the full loop — describe -> drag (the frame follows) -> release (file +
// snapshot) -> reload (persistence) -> reject bad values -> undo (file and frame
// go back). The gate restores timeline.json and removes its own snapshots.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';
import { createGate } from './lib/gate.mjs';
import { listSnapshots } from '../src/snapshots.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'timeline.json');
const SNAPS = path.join(ROOT, '.snapshots');
const before = fs.readFileSync(FILE, 'utf8');
const hadSnaps = fs.existsSync(SNAPS);
const snapsBefore = new Set(listSnapshots(ROOT).map((s) => s.id));

const { check, finish } = createGate();
const read = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));

// Start from the committed demo state (no stored knobs), whatever a previous
// run or a manual drag left behind. cleanup() puts the original bytes back.
const clean = JSON.parse(before);
delete clean.params;
fs.writeFileSync(FILE, `${JSON.stringify(clean, null, 2)}\n`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sum = ([r, g, b]) => r + g + b;

async function until(predicate, ms = 4000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await predicate()) return true;
    await sleep(50);
  }
  return false;
}

function cleanup() {
  fs.writeFileSync(FILE, before);
  for (const snap of listSnapshots(ROOT)) {
    if (snapsBefore.has(snap.id)) continue;
    fs.rmSync(path.join(SNAPS, `${snap.id}.json`), { force: true });
  }
  if (!hadSnaps) fs.rmSync(SNAPS, { recursive: true, force: true });
}

const { origin, close } = await startServer();
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });

try {
  // --- describe ---
  const api = await (await fetch(`${origin}/api/params`)).json();
  const scene = api.scenes.find((s) => s.id === 'first-peoples');
  const axis = scene?.knobs.find((k) => k.key === 'axisY');
  check(
    'API describes the knobs a scene declares',
    scene?.knobs.length === 6 && axis?.default === 0.68 && axis.min === 0.45,
    `${scene?.knobs.length} knobs · axisY ${axis?.min}..${axis?.max} default ${axis?.default}`,
  );

  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  await page.goto(`${origin}/preview.html`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await page.evaluate(() => window.__PREVIEW__.setTime(4));

  const px = (x, y) => page.evaluate(([px_, py_]) => window.__PREVIEW__.pixel(px_, py_), [x, y]);
  const knobValue = () =>
    page.evaluate(() => window.__PREVIEW__.params().knobs.find((k) => k.key === 'axisY')?.value ?? null);

  // The axis is a solid grid-coloured rule at H*axisY; 0.68*1080 = 734, 0.80*1080 = 864.
  const rowOld = 734;
  const rowNew = 864;
  const base = { old: sum(await px(1000, rowOld)), new: sum(await px(1000, rowNew)) };
  check('baseline: the axis is drawn at 0.68', base.old > base.new + 20, `${base.old} vs ${base.new}`);

  // --- drag: the frame follows the knob before anything is written ---
  await page.evaluate(() => {
    const input = document.querySelector('#knobList input[data-key="axisY"]');
    input.value = '0.8';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  // The repaint is a requestAnimationFrame away; a fixed sleep flakes under load.
  let dragged = { old: 0, new: 0 };
  const moved = await until(async () => {
    dragged = { old: sum(await px(1000, rowOld)), new: sum(await px(1000, rowNew)) };
    return dragged.new > dragged.old + 20 && dragged.new > base.new + 20;
  }, 4000);
  check('dragging moves the drawn axis (kernel, not just the DOM)', moved, `${dragged.old} / ${dragged.new}`);
  check('dragging does not write the file yet', read().params?.['first-peoples']?.axisY === undefined);
  await page.screenshot({ path: path.join(ROOT, 'out/ui-params.png') });

  // --- release: persist + keep the previous version ---
  await page.evaluate(() => {
    document.querySelector('#knobList input[data-key="axisY"]').dispatchEvent(new Event('change', { bubbles: true }));
  });
  const saved = await until(() => read().params?.['first-peoples']?.axisY === 0.8);
  check('releasing writes timeline.json', saved, JSON.stringify(read().params ?? {}));

  const created = listSnapshots(ROOT).filter((s) => !snapsBefore.has(s.id));
  check(
    'the previous file is kept as a snapshot',
    created.some((s) => s.reason === 'param-first-peoples-axisY'),
    created.map((s) => s.reason).join(', ') || 'none',
  );

  // --- reload: the panel reads the file, it does not remember the drag ---
  await page.reload();
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });
  await page.evaluate(() => window.__PREVIEW__.setTime(4));
  check('reload reads the persisted value', (await knobValue()) === 0.8, String(await knobValue()));

  // --- negative controls ---
  const post = (body) =>
    fetch(`${origin}/api/params`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  const countBefore = listSnapshots(ROOT).length;
  const bad = await post({ scene: 'first-peoples', key: 'axisY', value: 5 });
  const badBody = await bad.json();
  check('out-of-range value is rejected', bad.status === 400, `${bad.status} · ${badBody.error}`);

  const ghost = await post({ scene: 'first-peoples', key: 'nope', value: 1 });
  check('unknown knob is rejected', ghost.status === 400, String((await ghost.json()).error));

  check(
    'a rejected write leaves the file and the snapshots alone',
    read().params['first-peoples'].axisY === 0.8 && listSnapshots(ROOT).length === countBefore,
  );

  // --- undo: previous file back, and the frame with it ---
  await page.click('#undo');
  // the restored file has no stored knob: absent means "use the declared default"
  const axisNow = () => read().params?.['first-peoples']?.axisY ?? 0.68;
  const undone = await until(() => axisNow() === 0.68);
  check('undo restores the previous file', undone, String(axisNow()));

  await page.waitForTimeout(120);
  const restored = sum(await px(1000, rowOld));
  check('the frame follows the restore', Math.abs(restored - base.old) <= 2, `${restored} vs ${base.old}`);

  const preRestore = listSnapshots(ROOT).some((s) => s.reason === 'pre-restore' && !snapsBefore.has(s.id));
  check('undo keeps what it replaced (pre-restore snapshot)', preRestore);
} finally {
  await browser.close();
  close();
  cleanup();
}

finish();
