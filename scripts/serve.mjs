// Tiny static server + comment API for the preview.
// The plugin build will replace this with the host's own server/tool surface.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addThread, list, reply, resolve } from '../src/comments.mjs';

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

const readBody = (req) =>
  new Promise((resolveBody, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => {
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

const json = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

async function api(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/comments') {
      return json(res, 200, { threads: list(ROOT) });
    }
    if (req.method === 'POST' && url.pathname === '/api/comments') {
      const body = await readBody(req);
      return json(res, 201, addThread(ROOT, body));
    }
    if (req.method === 'POST' && url.pathname === '/api/comments/reply') {
      const { id, text } = await readBody(req);
      return json(res, 200, reply(ROOT, id, text));
    }
    if (req.method === 'POST' && url.pathname === '/api/comments/resolve') {
      const { id } = await readBody(req);
      return json(res, 200, resolve(ROOT, id));
    }
    return json(res, 404, { error: 'unknown api route' });
  } catch (err) {
    return json(res, 400, { error: err.message });
  }
}

export function startServer(port = 0) {
  return new Promise((resolvePromise) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) return api(req, res, url);

      const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
      const file = path.resolve(ROOT, decodeURIComponent(rel));

      if (req.method !== 'GET' || !file.startsWith(ROOT)) {
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
      resolvePromise({ server, origin: `http://127.0.0.1:${bindPort}`, close: () => server.close() });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { origin } = await startServer(Number(process.env.PORT ?? 4173));
  console.log(`preview → ${origin}/preview.html`);
  console.log('ctrl-c to stop');
}
