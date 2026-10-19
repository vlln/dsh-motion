// Locate a Chromium binary once: CHROMIUM env > Playwright cache (mac layouts).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function findChromium() {
  if (process.env.CHROMIUM) return process.env.CHROMIUM;
  const base = path.join(os.homedir(), 'Library/Caches/ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  for (const dir of fs.readdirSync(base).filter((d) => d.startsWith('chromium-'))) {
    for (const arch of ['chrome-mac-arm64', 'chrome-mac']) {
      for (const app of ['Google Chrome for Testing', 'Chromium']) {
        const p = path.join(base, dir, arch, `${app}.app`, 'Contents', 'MacOS', app);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined;
}
