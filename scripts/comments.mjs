#!/usr/bin/env node
// Comment tool contract (stand-in for the plugin's motion_comments):
//   node scripts/comments.mjs list [--json] [--crops]
//   node scripts/comments.mjs resolve --id th_x

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { list, resolve } from '../src/comments.mjs';
import { startServer } from './serve.mjs';
import { findChromium } from './lib/chromium.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const has = (k) => argv.includes(`--${k}`);


async function makeCrops(threads) {
  const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, 'timeline.json'), 'utf8'));
  const targets = threads.filter((x) => x.anchor?.rect);
  if (!targets.length) return {};

  const { origin, close } = await startServer();
  const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(`${origin}/preview.html`);
  await page.waitForFunction(() => window.__PREVIEW__?.ready === true, { timeout: 30000 });

  const dir = path.join(ROOT, 'out/comments');
  fs.mkdirSync(dir, { recursive: true });
  const paths = {};

  for (const thread of targets) {
    await page.evaluate((t) => window.__PREVIEW__.setTime(t), thread.anchor.t);
    const box = await page.evaluate(() => window.__PREVIEW__.boxRect());
    const scale = box.width / timeline.width;
    const r = thread.anchor.rect;
    const pad = 0.2;
    const x = Math.max(0, box.left + (r.x - r.w * pad) * scale);
    const y = Math.max(0, box.top + (r.y - r.h * pad) * scale);
    const w = Math.min(box.left + box.width - x, r.w * (1 + pad * 2) * scale);
    const h = Math.min(box.top + box.height - y, r.h * (1 + pad * 2) * scale);
    const file = path.join(dir, `${thread.id}.png`);
    await page.screenshot({ path: file, clip: { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) } });
    paths[thread.id] = path.relative(ROOT, file);
  }

  await browser.close();
  close();
  return paths;
}

if (cmd === 'list') {
  const threads = has('open') ? list(ROOT, { onlyOpen: true }) : list(ROOT);
  const crops = has('crops') ? await makeCrops(threads) : {};
  const payload = threads.map((x) => ({
    id: x.id,
    t: x.anchor?.t,
    rect: x.anchor?.rect ?? null,
    elementId: x.anchor?.elementId ?? null,
    text: x.messages[0]?.text ?? '',
    messages: x.messages.length,
    activated: x.activated,
    status: x.status,
    crop: crops[x.id] ?? null,
  }));
  if (has('json')) console.log(JSON.stringify({ threads: payload }, null, 2));
  else {
    for (const x of payload) {
      console.log(`${x.id}  t=${x.t}s  ${x.status}${x.activated ? '' : ' (not sent)'}  ${x.crop ?? ''}`);
      console.log(`  ${x.text}`);
    }
    if (!payload.length) console.log('(no comments)');
  }
} else if (cmd === 'resolve') {
  const id = opt('id');
  if (!id) {
    console.error('usage: comments.mjs resolve --id th_x');
    process.exit(1);
  }
  console.log(JSON.stringify(resolve(ROOT, id), null, 2));
} else {
  console.error('usage: comments.mjs list|resolve');
  process.exit(1);
}
