#!/usr/bin/env node
// Find a free image for a shot, and record where it came from.
//
//   node find-asset.mjs "modern living room interior" --n 6
//   node find-asset.mjs "modern living room interior" --get 2 --name interior
//
// Source: Wikimedia Commons (no key, licence in the file metadata). Anything it
// downloads lands in motion/assets/plates/ with a CREDITS.md line, because a
// film that ships has to say where its pictures came from.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i === -1 ? d : argv[i + 1];
};
const has = (k) => argv.includes(`--${k}`);
const query = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!query) {
  console.error('usage: find-asset.mjs "<what the shot needs>" [--n 5] [--get N] [--name slug] [--min-width 1400]');
  process.exit(1);
}

const UA = 'dsh-motion-asset-finder/1.0 (local render pipeline)';
const api = 'https://commons.wikimedia.org/w/api.php';

async function search(q, limit) {
  const url =
    `${api}?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}` +
    `&gsrnamespace=6&gsrlimit=${limit}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1920`;
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`commons said ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data?.query?.pages ?? {});
  return pages
    .map((p) => {
      const info = p.imageinfo?.[0] ?? {};
      const meta = info.extmetadata ?? {};
      const pick = (k) => String(meta[k]?.value ?? '').replace(/<[^>]+>/g, '').trim();
      return {
        title: p.title.replace(/^File:/, ''),
        width: info.width ?? 0,
        height: info.height ?? 0,
        url: info.thumburl || info.url,
        page: info.descriptionurl,
        license: pick('LicenseShortName') || 'unknown',
        artist: pick('Artist').slice(0, 60),
      };
    })
    .filter((r) => r.url)
    .sort((a, b) => b.width * b.height - a.width * a.height);
}

const limit = Number(opt('n', 6));
const minWidth = Number(opt('min-width', 1400));
const found = (await search(query, limit * 2)).filter((r) => r.width >= minWidth).slice(0, limit);
if (!found.length) {
  console.log(`nothing over ${minWidth}px for "${query}" — try broader words, or draw the shot instead`);
  process.exit(2);
}

if (has('get')) {
  const index = Number(opt('get', 1));
  const hit = found[index - 1];
  if (!hit) {
    console.error(`--get ${index}: only ${found.length} result(s)`);
    process.exit(1);
  }
  const name = (opt('name', '') || hit.title.replace(/\.[a-z]+$/i, ''))
    .replace(/[^a-z0-9-]+/gi, '-')
    .toLowerCase()
    .slice(0, 40);
  const dir = path.resolve('motion/assets/plates');
  fs.mkdirSync(dir, { recursive: true });
  const ext = (path.extname(new URL(hit.url).pathname) || '.jpg').toLowerCase();
  const file = path.join(dir, `${name}${ext}`);
  const res = await fetch(hit.url, { headers: { 'user-agent': UA } });
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  const credits = path.join(dir, 'CREDITS.md');
  const header = fs.existsSync(credits) ? '' : '# Plate credits\n\n| File | Title | Licence | Source |\n|---|---|---|---|\n';
  fs.appendFileSync(credits, `${header}| ${path.basename(file)} | ${hit.title} | ${hit.license} | ${hit.page} |\n`);
  console.log(`saved  ${path.relative(process.cwd(), file)}`);
  console.log(`credit ${hit.title} · ${hit.license} · ${hit.page}`);
  process.exit(0);
}

found.forEach((hit, i) => {
  console.log(`${String(i + 1).padStart(2)}  ${hit.width}x${hit.height}  ${hit.license.padEnd(14)} ${hit.title.slice(0, 56)}`);
});
console.log('\npick one: --get <n> --name <slug>   (saves to motion/assets/plates/ and appends CREDITS.md)');
