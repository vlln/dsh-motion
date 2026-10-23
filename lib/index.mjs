// dsh-motion Node half. It owns two things, and neither is a tool:
//
//   · the film's routes, mounted per session at /plugins/dsh-motion/p/<session>/
//     so the panel reads that workspace's motion/ directory;
//   · the skill that teaches the library, and the `dsh-motion` command on PATH.
//
// Creating and changing a film is the agent's own work: it writes files in its
// workspace and runs the command. The package supplies engine, manual and panel.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { commentsHandlers } from '../src/comments-http.mjs';
import { paramsHandlers } from '../src/params-http.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const name = 'dsh-motion';
// Nothing is required at mount time: the skill and the routes are optional
// consumers, each injected in its own sub-scope.
export const inject = [];

const WEB = '/plugins/dsh-motion';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
};

const sendFile = (res, file, type) => {
  try {
    const buf = fs.readFileSync(file);
    // The panel is edited in place while it is open; a cached bundle would hide
    // every change behind a refresh the user cannot tell from a stale page.
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
};

const sendJson = (res, code, data) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

/** The panel's write surface. The human uses it; the agent has the command. */
const apiFor = (project) => {
  const API = commentsHandlers(project);
  const PARAMS = paramsHandlers(project);
  const post = (req) => (req.method ?? 'GET').toUpperCase() === 'POST';
  return (pathname, req, res) => {
    const write = post(req);
    const p = pathname;
    if (p === '/api/comments') return write ? API.create(req, res) : API.list(req, res);
    if (write && p === '/api/comments/resolve') return API.resolve(req, res);
    if (p === '/api/params') return write ? PARAMS.set(req, res) : PARAMS.get(req, res);
    if (write && p === '/api/texts') return PARAMS.text(req, res);
    if (write && p === '/api/values') return PARAMS.value(req, res);
    if (write && p === '/api/assets') return PARAMS.asset(req, res);
    if (write && p === '/api/assets/rebake') return PARAMS.rebake(req, res);
    if (write && p === '/api/scene') return PARAMS.scene(req, res);
    if (write && p === '/api/export') return PARAMS.export(req, res);
    if (p === '/api/revision') return PARAMS.revision(req, res);
    if (p === '/api/history') return write ? PARAMS.restore(req, res) : PARAMS.history(req, res);
    if (p === '/api/history/restore') return PARAMS.restore(req, res);
    if (p === '/api/projects') return write ? PARAMS.create(req, res) : PARAMS.projects(req, res);
    if (p === '/api/render') {
      try {
        return sendJson(res, 200, JSON.parse(fs.readFileSync(path.join(project, 'out/render-state.json'), 'utf8')));
      } catch {
        return sendJson(res, 200, { status: 'idle' });
      }
    }
    return sendJson(res, 404, { error: 'unknown api route' });
  };
};

export function apply(ctx) {
  // The command the skill teaches: on this process's PATH, so `dsh-motion`
  // resolves in a shell without anyone learning where the package lives.
  ctx.effect(() => {
    const bin = path.join(PKG_ROOT, 'bin');
    const before = process.env.PATH ?? '';
    process.env.PATH = `${bin}${path.delimiter}${before}`;
    return () => {
      process.env.PATH = before;
    };
  }, 'dsh-motion: cli on PATH');

  // The manual. A skill is how the agent learns this library; there is no tool
  // surface to learn instead.
  ctx.inject(['skills'], (scope) => {
    scope.effect(() => {
      const file = path.join(PKG_ROOT, 'skills/dsh-motion/SKILL.md');
      const raw = fs.readFileSync(file, 'utf8');
      const body = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
      return scope.skills.register({
        name: 'dsh-motion',
        source: 'runtime',
        description:
          'Build or change an animation in this workspace: write motion/timeline.json and motion/scenes/*.mjs, then run dsh-motion.',
        whenToUse:
          'The user asks for an animation, a title sequence, an explainer or a data film, or asks to change the film under motion/.',
        content: body,
      });
    }, 'dsh-motion: skill');
  });

  let agents = null;
  ctx.inject(['agents'], (scope) => {
    agents = scope.agents;
  });

  const workspaceForSession = (sessionId) => {
    try {
      return agents?.get?.(sessionId)?.session?.header?.cwd ?? null;
    } catch {
      return null;
    }
  };

  // --- the film's own routes: /plugins/dsh-motion/p/<session>/... ---
  // Everything the panel loads is relative to that prefix, so the film's
  // timeline, scenes, assets and output all resolve inside the workspace.
  ctx.inject(['webServer'], (web) => {
    const pkgFile = (name, type) => (req, res) => sendFile(res, path.join(PKG_ROOT, 'lib', name), type);

    const mounted = (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const rest = decodeURIComponent(url.pathname.slice(`${WEB}/p/`.length));
      const slash = rest.indexOf('/');
      const sessionId = slash < 0 ? rest : rest.slice(0, slash);
      const sub = slash < 0 ? '' : rest.slice(slash + 1);

      const workspace = workspaceForSession(sessionId);
      if (!workspace) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('unknown session');
        return;
      }
      const project = path.join(workspace, 'motion');

      if (sub === 'app') return sendFile(res, path.join(PKG_ROOT, 'lib/app.html'), 'text/html; charset=utf-8');
      if (sub === 'app.js') return pkgFile('app.js', 'text/javascript; charset=utf-8')(req, res);
      if (sub === 'app.css') return pkgFile('app.css', 'text/css; charset=utf-8')(req, res);
      if (sub.startsWith('chunks/')) {
        const file = path.join(PKG_ROOT, 'lib/chunks', path.basename(sub));
        return sendFile(res, file, 'text/javascript; charset=utf-8');
      }
      if (sub.startsWith('api/')) return apiFor(project)(`/${sub}`, req, res);

      const file = path.resolve(project, sub);
      if (!file.startsWith(project + path.sep) && file !== project) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('forbidden');
        return;
      }
      return sendFile(res, file, TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
    };

    const served = [web.webServer.register({ kind: 'prefix', path: `${WEB}/p`, handler: mounted })];
    web.effect(() => () => served.forEach((dispose) => dispose()), 'dsh-motion: film routes');
  });
}
