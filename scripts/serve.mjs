// Tiny static server + panel API for the preview.
//
// One server, two roots: the package supplies the code (preview.html, src/,
// node_modules/), the project supplies the film (timeline.json, scenes/,
// assets/, out/). A file found in the project wins, so a film can carry its own
// scene modules next to the page that renders them.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commentsHandlers } from '../src/comments-http.mjs';
import { createFilmFromTemplate, listTemplates } from '../src/film.mjs';
import { paramsHandlers } from '../src/params-http.mjs';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
};

const json = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const post = (req) => (req.method ?? 'GET').toUpperCase() === 'POST';

function api(req, res, url, project) {
  const API = commentsHandlers(project);
  const PARAMS = paramsHandlers(project);
  const write = post(req);
  if (url.pathname === '/api/comments') return write ? API.create(req, res) : API.list(req, res);
  if (write && url.pathname === '/api/comments/resolve') return API.resolve(req, res);
  if (url.pathname === '/api/params') return write ? PARAMS.set(req, res) : PARAMS.get(req, res);
  if (write && url.pathname === '/api/texts') return PARAMS.text(req, res);
  if (write && url.pathname === '/api/values') return PARAMS.value(req, res);
  if (write && url.pathname === '/api/assets') return PARAMS.asset(req, res);
  if (write && url.pathname === '/api/assets/rebake') return PARAMS.rebake(req, res);
  if (write && url.pathname === '/api/scene') return PARAMS.scene(req, res);
  if (write && url.pathname === '/api/palette') return PARAMS.palette(req, res);
  if (url.pathname === '/api/versions') return PARAMS.versions(req, res);
  if (write && url.pathname === '/api/versions/use') return PARAMS['versions/use'](req, res);
  if (write && url.pathname === '/api/export') return PARAMS.export(req, res);
  if (!write && url.pathname === '/api/revision') return PARAMS.revision(req, res);
  if (url.pathname === '/api/history') return write ? PARAMS.restore(req, res) : PARAMS.history(req, res);
  if (write && url.pathname === '/api/history/restore') return PARAMS.restore(req, res);
  if (url.pathname === '/api/projects') return write ? PARAMS.create(req, res) : PARAMS.projects(req, res);
  if (!write && url.pathname === '/api/templates') return json(res, 200, { templates: listTemplates() });
  if (write && url.pathname === '/api/template') {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      try {
        const { id } = JSON.parse(raw || '{}');
        const film = createFilmFromTemplate(path.dirname(project), id);
        json(res, 200, { ok: true, template: id, scenes: film.film.scenes?.length ?? 0 });
      } catch (err) {
        json(res, 400, { error: err.message });
      }
    });
    return;
  }
  return json(res, 404, { error: 'unknown api route' });
}

/** Resolve a request path under one root, refusing anything that escapes it. */
function under(root, rel) {
  const file = path.resolve(root, rel);
  return file === root || file.startsWith(root + path.sep) ? file : null;
}

/**
 * Start the preview server.
 * @param {number} port - 0 binds a free port.
 * @param {{ project?: string }} options - the film directory; defaults to the
 *   package so `npm run preview` keeps showing the example film.
 */
export function startServer(port = 0, { project = process.env.DSH_MOTION_PROJECT || PKG } = {}) {
  const film = path.resolve(project);
  return new Promise((resolvePromise) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) return api(req, res, url, film);

      const rel = nameOf(url.pathname);
      const fromProject = under(film, rel);
      const fromPackage = under(PKG, rel);
      if (req.method !== 'GET' || !fromProject || !fromPackage) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const file = fromProject && fs.existsSync(fromProject) ? fromProject : fromPackage;
      fs.readFile(file, (err, buf) => {
        if (err) {
          res.writeHead(404).end('not found');
          return;
        }
        res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
        res.end(buf);
      });
    });

    server.listen(port, '127.0.0.1', () => {
      const { port: bindPort } = server.address();
      resolvePromise({ server, origin: `http://127.0.0.1:${bindPort}`, project: film, close: () => server.close() });
    });
  });
}

function nameOf(pathname) {
  const raw = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  return decodeURIComponent(raw);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { origin, project } = await startServer(Number(process.env.PORT ?? 4173));
  console.log(`preview → ${origin}/preview.html`);
  console.log(`project → ${project}`);
  console.log('ctrl-c to stop');
}
