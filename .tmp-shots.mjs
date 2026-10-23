import { chromium } from 'playwright';
import { findChromium } from './scripts/lib/chromium.mjs';
const url = process.argv[2];
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url);
await page.waitForTimeout(3000);
for (let i = 0; i < 3; i++) { const c = page.getByRole('button', { name: /continue/i }); if (await c.isVisible().catch(() => false)) { await c.click(); await page.waitForTimeout(400);} else break; }
await page.locator('[class*="panelRow"]').filter({ hasText: 'Motion' }).first().click();
await page.waitForTimeout(1800);
await page.screenshot({ path: 'out/ui-light.png' });
await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
await page.waitForTimeout(600);
await page.screenshot({ path: 'out/ui-dark.png' });
await page.evaluate(() => document.body.removeAttribute('data-ds-dark-theme'));
await browser.close();
