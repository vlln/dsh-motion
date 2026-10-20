#!/usr/bin/env node
// Build the self-contained panel bundle (three inlined) and its HTML shell.
// The shell is preview.html with the import map removed and asset paths rewritten.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIB = path.join(ROOT, 'lib');
fs.mkdirSync(LIB, { recursive: true });

const result = await build({
  entryPoints: [path.join(ROOT, 'src/preview.mjs')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  splitting: true,           // the WebGL scene becomes a lazy chunk
  outdir: LIB,
  entryNames: 'app',
  chunkNames: 'chunks/[name]',
  legalComments: 'none',
  logLevel: 'warning',
});

const html = fs
  .readFileSync(path.join(ROOT, 'preview.html'), 'utf8')
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace('./src/preview.css', './app.css')
  .replace('./src/preview.mjs', './app.js');

fs.writeFileSync(path.join(LIB, 'app.html'), html);
fs.copyFileSync(path.join(ROOT, 'src/preview.css'), path.join(LIB, 'app.css'));

const size = fs.statSync(path.join(LIB, 'app.js')).size;
const chunks = fs.existsSync(path.join(LIB, 'chunks'))
  ? fs.readdirSync(path.join(LIB, 'chunks')).map((f) => {
      const bytes = fs.statSync(path.join(LIB, 'chunks', f)).size;
      return `${f} ${(bytes / 1024).toFixed(0)} KiB`;
    })
  : [];
console.log(`client → app.js ${(size / 1024).toFixed(0)} KiB${chunks.length ? ` + ${chunks.join(', ')}` : ''}`);
