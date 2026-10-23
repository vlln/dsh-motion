// Tiny static server + comment API for the preview.
// The plugin build will replace this with the host's own server/tool surface.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commentsHandlers } from '../src/comments-http.mjs';
import { paramsHandlers } from '../src/params-http.mjs';

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

const json = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const API = commentsHandlers(ROOT);
const PARAMS = paramsHandlers(ROOT);

async function api(req, res, url) {
  const post = (req.method ?? 'GET').toUpperCase() === 'POST';
  if (url.pathname === '/api/comments') return post ? API.create(req, res) : API.list(req, res);
  if (post && url.pathname === '/api/comments/reply') return API.reply(req, res);
  if (post && url.pathname === '/api/comments/resolve') return API.resolve(req, res);
  if (url.pathname === '/api/params') return post ? PARAMS.set(req, res) : PARAMS.get(req, res);
  if (post && url.pathname === '/api/texts') return PARAMS.text(req, res);
  if (post && url.pathname === '/api/values') return PARAMS.value(req, res);
  if (post && url.pathname === '/api/assets') return PARAMS.asset(req, res);
  if (post && url.pathname === '/api/assets/rebake') return PARAMS.rebake(req, res);
  if (post && url.pathname === '/api/scene') return PARAMS.scene(req, res);
  if (post && url.pathname === '/api/export') return PARAMS.export(req, res);
  if (!post && url.pathname === '/api/projects') return PARAMS.projects(req, res);
  if (post && url.pathname === '/api/projects') return PARAMS.create(req, res);
  if (url.pathname === '/api/history') return post ? PARAMS.restore(req, res) : PARAMS.history(req, res);
  if (post && url.pathname === '/api/history/restore') return PARAMS.restore(req, res);
  return json(res, 404, { error: 'unknown api route' });
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
