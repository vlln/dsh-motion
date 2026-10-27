import { chromium } from 'playwright';
import { startServer } from './scripts/serve.mjs';
import { findChromium } from './scripts/lib/chromium.mjs';
try {
  const project = '/tmp/plat/examples/cold-start-2/motion';
  const { origin, close } = await startServer(0, { project });
  const b = await chromium.launch({ executablePath: findChromium() });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${origin}/preview.html`, { waitUntil: 'load' });
  await p.waitForTimeout(2500);
  const tabs = await p.locator('.rail-tab').count();
  await p.locator('.rail-tab').nth(1).click();
  await p.waitForTimeout(500);
  console.log(JSON.stringify(await p.evaluate(() => ({
    tabs: [...document.querySelectorAll('.rail-tab')].map((x) => x.textContent.trim()),
    tokens: [...document.querySelectorAll('.token-row')].map((r) => r.dataset.token),
    panels: [...document.querySelectorAll('.rail-panel')].map((x) => `${x.id}:${x.hidden ? 'h' : 'v'}`),
  }))));
  await b.close(); close();
} catch (e) { console.log('ERR', e.message.slice(0, 120)); }
