#!/usr/bin/env node
// Build the self-contained panel bundle (three inlined) and its HTML shell.
// The shell is preview.html with asset paths rewritten for the bundle.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'lib');

/**
 * Bundle src/preview.mjs (and its HTML/CSS shell) into a directory.
 * @param {{ outdir?: string, shell?: boolean }} opts
 */
export async function buildClient({ outdir = LIB, shell = true } = {}) {
  fs.mkdirSync(outdir, { recursive: true });

  // Hashed chunk names change on every edit; stale ones must not pile up.
  fs.rmSync(path.join(outdir, 'chunks'), { recursive: true, force: true });

  const result = await build({
  entryPoints: [path.join(ROOT, 'src/preview.mjs')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  splitting: true,           // the WebGL scene becomes a lazy chunk
    outdir,
    entryNames: 'app',
    chunkNames: 'chunks/[name]-[hash]',
    legalComments: 'none',
    logLevel: 'warning',
  });

  const html = fs
    .readFileSync(path.join(ROOT, 'preview.html'), 'utf8')
    .replace('./src/preview.css', './app.css')
    .replace('./src/preview.mjs', './app.js');

  fs.writeFileSync(path.join(outdir, 'app.html'), html);
  fs.copyFileSync(path.join(ROOT, 'src/preview.css'), path.join(outdir, 'app.css'));
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

async function main() {
await buildClient();

const size = fs.statSync(path.join(LIB, 'app.js')).size;
const chunks = fs.existsSync(path.join(LIB, 'chunks'))
  ? fs.readdirSync(path.join(LIB, 'chunks')).map((f) => {
      const bytes = fs.statSync(path.join(LIB, 'chunks', f)).size;
      return `${f} ${(bytes / 1024).toFixed(0)} KiB`;
    })
  : [];
console.log(`client → app.js ${(size / 1024).toFixed(0)} KiB${chunks.length ? ` + ${chunks.join(', ')}` : ''}`);
}
