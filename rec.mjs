import fs from 'node:fs';
import { chromium } from 'playwright';
import { startServer } from './scripts/serve.mjs';
import { findChromium } from './scripts/lib/chromium.mjs';
try {
  const project = '/tmp/plat/examples/cold-start-2/motion';
  const { origin, close } = await startServer(0, { project });
  const dir = '/tmp/rec';
  fs.rmSync(dir, { recursive: true, force: true });
  const b = await chromium.launch({ executablePath: findChromium() });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, recordVideo: { dir, size: { width: 1280, height: 800 } } });
  const p = await ctx.newPage();
  await p.goto(`${origin}/preview.html`, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  console.log('play:', await p.evaluate(() => !!document.getElementById('play')));
  await p.evaluate(() => document.getElementById('play').click());
  await p.waitForTimeout(9000);
  await ctx.close(); await b.close(); close();
  console.log(fs.readdirSync(dir));
} catch (e) {
  console.log('FAILED:', e.message.slice(0, 300));
}
