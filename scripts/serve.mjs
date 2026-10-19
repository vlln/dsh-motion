// Tiny static server: the spike has no bundler yet, and file:// blocks ES modules.
// One file, no deps; the production build will inline everything into one HTML.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

export function startServer(port = 0) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
      const rel = url === '/' ? 'index.html' : url.replace(/^\/+/, '');
      const file = path.resolve(ROOT, rel);

      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404).end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
        res.end(buf);
      });
    });

    server.listen(port, '127.0.0.1', () => {
      const { port: bindPort } = server.address();
      resolve({ server, origin: `http://127.0.0.1:${bindPort}`, close: () => server.close() });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { origin } = await startServer(Number(process.env.PORT ?? 4173));
  console.log(`preview → ${origin}/preview.html`);
  console.log('ctrl-c to stop');
}
