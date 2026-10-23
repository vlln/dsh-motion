// dsh-motion Node half: tools that drive the render kernel in this package.
// The browser half lives in client/ and is loaded through dsh.client.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { commentsHandlers } from '../src/comments-http.mjs';
import { list, reply, resolve } from '../src/comments.mjs';
import { paramsHandlers } from '../src/params-http.mjs';
import { describeProject, history, restoreProject, setProjectParam, writeTimeline } from '../src/project.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMELINE = path.join(PKG_ROOT, 'timeline.json');

export const name = 'dsh-motion';
export const inject = ['tools'];

function runScript(script, args = []) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      process.execPath,
      [path.join(PKG_ROOT, 'scripts', script), ...args],
      { cwd: PKG_ROOT, maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) reject(new Error((stderr || stdout || err.message).trim()));
        else resolvePromise(stdout.trim());
      },
    );
  });
}

const runFfmpeg = (args) =>
  new Promise((resolvePromise, reject) => {
    execFile('ffmpeg', args, { cwd: PKG_ROOT }, (err) => (err ? reject(new Error(err.message)) : resolvePromise()));
  });

const readTimeline = () => JSON.parse(fs.readFileSync(TIMELINE, 'utf8'));

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
};

const sendFile = (res, file, type) => {
  try {
    const buf = fs.readFileSync(file);
    res.writeHead(200, { 'content-type': type });
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

const readBody = (req) =>
  new Promise((resolvePromise, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('body too large'));
    });
    req.on('end', () => {
      if (!raw) return resolvePromise({});
      try {
        resolvePromise(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

const text = (value) => ({ schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] });

export function apply(ctx) {
  ctx.effect(() => {
    const disposers = [];

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_info',
          description:
            'Inspect the motion project: duration, fps, scenes and their start/length, text slots and palette tokens. Use before editing or rendering.',
          parameters: {},
          output: text('JSON'),
          execute: async () => {
            const timeline = readTimeline();
            const beatsFile = path.join(PKG_ROOT, 'out/beats.json');
            const beats = fs.existsSync(beatsFile) ? JSON.parse(fs.readFileSync(beatsFile, 'utf8')) : null;
            return JSON.stringify(
              {
                duration: timeline.duration,
                fps: timeline.fps,
                scenes: timeline.scenes,
                palettes: Object.keys(timeline.palettes ?? {}),
                beats: beats ? { bpm: beats.bpm, drop: beats.drop, count: beats.beats.length } : null,
              },
              null,
              2,
            );
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_texts',
          description:
            'Read or write a scene text slot (e.g. title, subtitle). Writing updates timeline.json, validates it, and takes effect on the next rendered frame without recompiling the scene.',
          parameters: {
            action: { type: 'string', required: true, description: 'get | set' },
            scene: { type: 'string', required: true },
            slot: { type: 'string', required: true },
            value: { type: 'string' },
          },
          output: text('value'),
          execute: async ({ action, scene, slot, value }) => {
            if (action === 'get') return runScript('texts.mjs', ['get', '--scene', scene, '--slot', slot]);
            if (action !== 'set') throw new Error('action must be get or set');
            if (value === undefined) throw new Error('set needs value');
            return runScript('texts.mjs', ['set', '--scene', scene, '--slot', slot, '--value', value]);
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_palette',
          description:
            'Change one color token. Without scene/element it edits the shared palette; with scene (and optionally element) it writes an override so a single element can differ (e.g. "make this bright red").',
          parameters: {
            token: { type: 'string', required: true, description: 'bg | fg | accent | muted | grid | panel' },
            value: { type: 'string', required: true, description: '#rrggbb' },
            palette: { type: 'string', description: 'palette name, default main' },
            scene: { type: 'string', description: 'write an override for this scene' },
            element: { type: 'string', description: 'override for one element of that scene' },
          },
          output: text('changed'),
          execute: async ({ token, value, palette, scene, element }) => {
            if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`not a hex color: ${value}`);
            const timeline = readTimeline();
            if (scene) {
              const key = element ? `${scene}/${element}` : scene;
              timeline.overrides ??= {};
              timeline.overrides[key] = { ...(timeline.overrides[key] ?? {}), [token]: value };
              await writeTimeline(PKG_ROOT, timeline, `palette-${key}`);
              return `override ${key}.${token} = ${value}`;
            }
            const name = palette ?? 'main';
            timeline.palettes ??= {};
            timeline.palettes[name] = { ...(timeline.palettes[name] ?? {}), [token]: value };
            await writeTimeline(PKG_ROOT, timeline, `palette-${name}`);
            return `${name}.${token} = ${value}`;
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_comments',
          description:
            'Work with viewer annotations anchored to {t, rect, elementId}. list returns open threads; reply and resolve act only on threads the viewer sent to Claude.',
          parameters: {
            action: { type: 'string', required: true, description: 'list | reply | resolve' },
            id: { type: 'string' },
            text: { type: 'string' },
          },
          output: text('JSON'),
          execute: async ({ action, id, text: body }) => {
            if (action === 'list') return JSON.stringify({ threads: list(PKG_ROOT) }, null, 2);
            if (action === 'reply') {
              if (!id || !body) throw new Error('reply needs id and text');
              return JSON.stringify(reply(PKG_ROOT, id, body), null, 2);
            }
            if (action === 'resolve') {
              if (!id) throw new Error('resolve needs id');
              return JSON.stringify(resolve(PKG_ROOT, id), null, 2);
            }
            throw new Error('action must be list, reply or resolve');
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_params',
          description:
            'Read or set a scene parameter (a numeric knob the scene declares, e.g. axisY, cardW, enter). Setting validates the range, snapshots the previous timeline.json and writes; the panel sees the same file.',
          parameters: {
            action: { type: 'string', required: true, description: 'list | set' },
            scene: { type: 'string', description: 'scene id (set)' },
            key: { type: 'string', description: 'param key (set)' },
            value: { type: 'number', description: 'new value (set)' },
          },
          output: text('JSON'),
          execute: async ({ action, scene, key, value }) => {
            if (action === 'list') return JSON.stringify({ scenes: await describeProject(PKG_ROOT) }, null, 2);
            if (action !== 'set') throw new Error('action must be list or set');
            if (!scene || !key || value === undefined) throw new Error('set needs scene, key and value');
            const out = await setProjectParam(PKG_ROOT, scene, key, Number(value));
            return JSON.stringify({ scene, key, value: out.value, snapshot: out.snapshot?.id ?? null }, null, 2);
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_history',
          description:
            'List timeline snapshots (newest first) or restore one. Every write from the panel or from a tool keeps the previous timeline.json here, so "put it back" needs no manual undo.',
          parameters: {
            action: { type: 'string', required: true, description: 'list | restore' },
            id: { type: 'string', description: 'snapshot id (restore)' },
          },
          output: text('JSON'),
          execute: async ({ action, id }) => {
            if (action === 'list') return JSON.stringify({ snapshots: history(PKG_ROOT) }, null, 2);
            if (action !== 'restore') throw new Error('action must be list or restore');
            if (!id) throw new Error('restore needs id');
            const timeline = await restoreProject(PKG_ROOT, id);
            return JSON.stringify({ restored: id, scenes: timeline.scenes.map((s) => s.id) }, null, 2);
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_reference',
          description:
            'Read a reference video (local file) and return the structure of it, not adjectives: duration, cut points, a motion curve, the dominant colours, and one summary per segment. Use it before writing a scene when the user says "like this video".',
          parameters: {
            path: { type: 'string', required: true, description: 'local video file (mp4 / mov / webm)' },
            out: { type: 'string', description: 'output JSON, default out/reference.json' },
            cutThreshold: { type: 'number', description: 'frame-difference cut threshold 0..1, default 0.12' },
          },
          output: text('JSON'),
          execute: async ({ path: file, out, cutThreshold }) => {
            if (!file) throw new Error('path is required');
            return runScript('reference.mjs', [
              file,
              '--out', out ?? 'out/reference.json',
              ...(cutThreshold ? ['--cut', String(cutThreshold)] : []),
            ]);
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_render',
          description:
            'Render the timeline with the local kernel. mode=stills writes a contact sheet (fast, for review); mode=video renders MP4 (with audio when timeline.audio is set). Requires node, ffmpeg and Playwright chromium on the host.',
          parameters: {
            mode: { type: 'string', required: true, description: 'stills | video' },
            out: { type: 'string', description: 'output path, default out/sheet.png or out/demo.mp4' },
            stills: { type: 'string', description: 'comma separated seconds for stills mode' },
            cols: { type: 'number', description: 'contact sheet columns, default 3' },
            fps: { type: 'number', description: 'video fps, default timeline fps' },
            supersample: { type: 'number', description: '1 = normal, 2 = render at 2x then downscale (sharper text)' },
          },
          output: text('path'),
          execute: async ({ mode, out, stills, cols, fps, supersample }) => {
            if (mode === 'stills') {
              const times = stills ?? '0,3,6,9,12';
              return runScript('capture.mjs', [
                '--stills', times,
                '--cols', String(cols ?? 3),
                '--out', out ?? 'out/sheet.png',
              ]);
            }
            if (mode === 'video') {
              return runScript('capture.mjs', [
                '--video',
                ...(fps ? ['--fps', String(fps)] : []),
                ...(supersample ? ['--supersample', String(supersample)] : []),
                '--out', out ?? 'out/demo.mp4',
              ]);
            }
            throw new Error('mode must be stills or video');
          },
        }),
      ),
    );



    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_export',
          description:
            'Export the final file: format=mp4 (H.264 + audio when the timeline has an audio track) or format=gif (15 fps, no audio). GIF is transcoded from the rendered video.',
          parameters: {
            format: { type: 'string', required: true, description: 'mp4 | gif' },
            out: { type: 'string' },
            fps: { type: 'number' },
            supersample: { type: 'number', description: '1 = normal, 2 = 2x render then downscale' },
          },
          output: text('path'),
          execute: async ({ format, out, fps, supersample }) => {
            const fpsArgs = [...(fps ? ['--fps', String(fps)] : []), ...(supersample ? ['--supersample', String(supersample)] : [])];
            if (format === 'mp4') {
              return runScript('capture.mjs', ['--video', ...fpsArgs, '--out', out ?? 'out/export.mp4']);
            }
            if (format === 'gif') {
              const src = 'out/export-src.mp4';
              await runScript('capture.mjs', ['--video', '--no-audio', ...fpsArgs, '--out', src]);
              const gif = out ?? 'out/export.gif';
              await runFfmpeg([
                '-loglevel', 'error', '-y',
                '-i', path.join(PKG_ROOT, src),
                '-vf', 'fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
                '-loop', '0',
                path.join(PKG_ROOT, gif),
              ]);
              fs.rmSync(path.join(PKG_ROOT, src), { force: true });
              return gif;
            }
            throw new Error('format must be mp4 or gif');
          },
        }),
      ),
    );

    // --- panel routes (client half loads these in an iframe) ---
    const API = commentsHandlers(PKG_ROOT);
    const PARAMS = paramsHandlers(PKG_ROOT);
    const chunkDir = path.join(PKG_ROOT, 'lib/chunks');
    const chunkRoutes = fs.existsSync(chunkDir)
      ? fs
          .readdirSync(chunkDir)
          .filter((f) => f.endsWith('.js'))
          .map((f) => [`/chunks/${f}`, (req, res) => sendFile(res, path.join(chunkDir, f), 'text/javascript; charset=utf-8')])
      : [];
    const routes = [
      ['/app', (req, res) => sendFile(res, path.join(PKG_ROOT, 'lib/app.html'), 'text/html; charset=utf-8')],
      ['/app.js', (req, res) => sendFile(res, path.join(PKG_ROOT, 'lib/app.js'), 'text/javascript; charset=utf-8')],
      ['/app.css', (req, res) => sendFile(res, path.join(PKG_ROOT, 'lib/app.css'), 'text/css; charset=utf-8')],
      ['/timeline.json', (req, res) => sendFile(res, TIMELINE, 'application/json; charset=utf-8')],
      ['/out/beats.json', (req, res) => sendFile(res, path.join(PKG_ROOT, 'out/beats.json'), 'application/json; charset=utf-8')],
      ['/api/comments', (req, res) => ((req.method ?? 'GET').toUpperCase() === 'POST' ? API.create(req, res) : API.list(req, res))],
      ['/api/comments/reply', (req, res) => API.reply(req, res)],
      ['/api/comments/resolve', (req, res) => API.resolve(req, res)],
      ['/api/params', (req, res) => ((req.method ?? 'GET').toUpperCase() === 'POST' ? PARAMS.set(req, res) : PARAMS.get(req, res))],
      ['/api/texts', (req, res) => PARAMS.text(req, res)],
      ['/api/values', (req, res) => PARAMS.value(req, res)],
      ['/api/assets', (req, res) => PARAMS.asset(req, res)],
      ['/api/assets/rebake', (req, res) => PARAMS.rebake(req, res)],
      ['/api/history', (req, res) => ((req.method ?? 'GET').toUpperCase() === 'POST' ? PARAMS.restore(req, res) : PARAMS.history(req, res))],
      ['/api/history/restore', (req, res) => PARAMS.restore(req, res)],
      ...chunkRoutes,
    ];

    // Media and clips live in directories, so they need prefix routes. The guard
    // resolves the path and refuses anything that escapes its base.
    const staticUnder = (base) => (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const rel = decodeURIComponent(url.pathname.slice(`${WEB}${base}`.length)).replace(/^\/+/, '');
      const root = path.join(PKG_ROOT, base.replace(/^\//, ''));
      const file = path.resolve(root, rel);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('forbidden');
        return;
      }
      sendFile(res, file, TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
    };
    const prefixes = [
      ['/assets', staticUnder('/assets')],
      ['/out', staticUnder('/out')],
    ];

    // Optional: only the web profile has webServer. Injecting it strictly would
    // keep the tools pending in headless profiles, so routes live in a sub-scope.
    ctx.inject(['webServer'], (web) => {
      const served = [
        ...routes.map(([suffix, handler]) => web.webServer.register({ kind: 'exact', path: `${WEB}${suffix}`, handler })),
        ...prefixes.map(([suffix, handler]) => web.webServer.register({ kind: 'prefix', path: `${WEB}${suffix}`, handler })),
      ];
      web.effect(() => () => served.forEach((dispose) => dispose()), 'dsh-motion: panel routes');
    });

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, 'dsh-motion: tools');
}
