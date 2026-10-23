// dsh-motion Node half: tools that drive the render kernel in this package.
// The browser half lives in client.js and is loaded through dsh.client.
//
// A film belongs to the SESSION, not to this package: everything lives in
// <session cwd>/motion/. The package supplies the kernel, the scripts and a
// starter scene; it never becomes anybody's project.

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { commentsHandlers } from '../src/comments-http.mjs';
import { list, resolve } from '../src/comments.mjs';
import { createFilm, describeFilm } from '../src/film.mjs';
import { paramsHandlers } from '../src/params-http.mjs';
import { describeProject, history, restoreProject, setProjectParam, writeTimeline } from '../src/project.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const name = 'dsh-motion';
export const inject = ['tools'];

/**
 * Where this call's film lives. The agent's session carries the workspace; the
 * fallback keeps context-less callers (the surface gate drives tools with no
 * execution context) pointed at the package, which is then just an example.
 */
const workspaceOf = (exec) => exec?.agent?.session?.header?.cwd ?? PKG_ROOT;

function filmOf(exec) {
  // No execution context means a gate or a script drove this call directly;
  // the package's own example film is the thing under test there.
  if (!exec?.agent) return PKG_ROOT;
  const dir = path.join(workspaceOf(exec), 'motion');
  if (!fs.existsSync(path.join(dir, 'timeline.json'))) {
    throw new Error(
      'this workspace has no film yet — call motion_project with action=create',
    );
  }
  return dir;
}

const filmEnv = (dir) => ({ ...process.env, DSH_MOTION_PROJECT: dir });

function runScript(script, args = [], project = PKG_ROOT) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      process.execPath,
      [path.join(PKG_ROOT, 'scripts', script), ...args],
      { cwd: PKG_ROOT, env: filmEnv(project), maxBuffer: 20 * 1024 * 1024 },
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

// One render at a time, described in a file the conversation card polls. A
// render is a child process, so this is the only place the panel learns that
// something is happening: the card asks, the tool writes.
const renderStateFile = (project) => path.join(project, 'out/render-state.json');

const writeRenderState = (project, state) => {
  try {
    const file = renderStateFile(project);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ ...state, at: Date.now() }));
  } catch {
    // A telemetry file nobody can read must never fail the render it describes.
  }
};

/**
 * Run a script that prints frame progress, and mirror that progress to disk.
 * capture.mjs writes `\r120/600 frames` to stdout; a child buffer would only
 * surface it at exit, which is exactly too late for a progress bar.
 */
function runCapture(args, kind, project) {
  return new Promise((resolvePromise, reject) => {
    writeRenderState(project, { status: 'rendering', kind, frame: 0, frames: 0, startedAt: Date.now() });
    const child = spawn(process.execPath, [path.join(PKG_ROOT, 'scripts/capture.mjs'), ...args], {
      cwd: PKG_ROOT,
      env: filmEnv(project),
    });
    let stdout = '';
    let stderr = '';
    let pending = '';
    let frame = 0;
    let frames = 0;
    let out = '';
    let lastWrite = 0;

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      pending += text.replace(/\r/g, '\n');
      let cut;
      while ((cut = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, cut).trim();
        pending = pending.slice(cut + 1);
        if (!line) continue;
        const progress = /(\d+)\/(\d+) frames/.exec(line);
        if (progress) {
          frame = Number(progress[1]);
          frames = Number(progress[2]);
        }
        const wrote = /(?:video|sheet|still) → (.+)$/.exec(line);
        if (wrote) out = wrote[1].trim();
        const now = Date.now();
        if (frames && now - lastWrite > 200) {
          lastWrite = now;
          writeRenderState(project, { status: 'rendering', kind, frame, frames, out });
        }
      }
    });
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        const error = (stderr || stdout || `capture exited ${code}`).trim();
        writeRenderState(project, { status: 'failed', kind, error: error.slice(-2000) });
        reject(new Error(error));
        return;
      }
      writeRenderState(project, { status: 'done', kind, frame: frames, frames, out });
      resolvePromise(out || stdout.trim());
    });
  });
}

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

const text = (value) => ({ schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] });

export function apply(ctx) {
  ctx.effect(() => {
    const disposers = [];

    // The session directory behind a route prefix. Resolved live: a session may
    // be created after this plugin mounts, and its cwd never moves.
    let agents = null;
    const workspaceForSession = (sessionId) => {
      try {
        const agent = agents?.get?.(sessionId);
        if (process.env.DSH_MOTION_DEBUG) {
          fs.appendFileSync('/tmp/dshm-mount.log', `${new Date().toISOString()} session=${sessionId} agents=${Boolean(agents)} agent=${Boolean(agent)} cwd=${agent?.session?.header?.cwd ?? ''}\n`);
        }
        return agent?.session?.header?.cwd ?? null;
      } catch (error) {
        if (process.env.DSH_MOTION_DEBUG) fs.appendFileSync('/tmp/dshm-mount.log', `ERR ${error.message}\n`);
        return null;
      }
    };

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_project',
          description:
            'Create or inspect the film for this session. Call create once when the user asks for an animation; it makes an empty film with one starter scene. Then write scenes with motion_scene.',
          parameters: {
            action: { type: 'string', required: true, description: 'create | info' },
            title: { type: 'string', description: 'first scene title (create)' },
            length: { type: 'number', description: 'first scene length in seconds, default 6 (create)' },
          },
          output: text('JSON'),
          execute: async ({ action, title, length }, exec) => {
            const workspace = workspaceOf(exec);
            if (action === 'create') {
              const made = createFilm(workspace, { title, length });
              return JSON.stringify(
                {
                  created: true,
                  scene: 'blank',
                  duration: made.film.duration,
                  next: 'call motion_scene with action=write to replace or add a scene',
                },
                null,
                2,
              );
            }
            if (action === 'info') return JSON.stringify(describeFilm(workspace), null, 2);
            throw new Error('action must be create or info');
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_scene',
          description:
            'List, read or write the scenes of the film. A scene is a module exporting id, slots and render(t). write checks that the module loads; pass add=true to also place it in the film as a new last scene.',
          parameters: {
            action: { type: 'string', required: true, description: 'list | read | write' },
            id: { type: 'string', description: 'scene id, lowercase slug (read/write)' },
            source: { type: 'string', description: 'complete module source (write)' },
            add: { type: 'boolean', description: 'also append a scene that uses it (write)' },
            name: { type: 'string', description: 'scene label in the film (add)' },
            length: { type: 'number', description: 'scene length in seconds (add)' },
          },
          output: text('JSON'),
          execute: async ({ action, id, source, add, name, length }, exec) => {
            const project = filmOf(exec);
            const dir = path.join(project, 'scenes');

            if (action === 'list') {
              const builtin = (await import('../src/scenes/all.mjs')).modules.map((m) => m.id);
              const own = fs.existsSync(dir)
                ? fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).map((f) => f.replace(/\.mjs$/, ''))
                : [];
              return JSON.stringify({ scenes: [...new Set([...builtin, ...own])] }, null, 2);
            }

            if (!id || !/^[a-z][a-z0-9-]{0,40}$/.test(id)) throw new Error('id must be a lowercase slug');
            const file = path.join(dir, `${id}.mjs`);

            if (action === 'read') {
              if (!fs.existsSync(file)) throw new Error(`no scene "${id}" in this film`);
              return fs.readFileSync(file, 'utf8');
            }
            if (action !== 'write') throw new Error('action must be list, read or write');
            if (typeof source !== 'string' || !source.trim()) throw new Error('write needs source');

            // Load it before it becomes the real file: a scene that does not
            // parse must not replace one that does.
            fs.mkdirSync(dir, { recursive: true });
            const probe = path.join(dir, `.probe-${id}-${process.pid}-${Date.now()}.mjs`);
            fs.writeFileSync(probe, source);
            let mod;
            try {
              mod = await import(`${pathToFileURL(probe).href}?v=${Date.now()}`);
            } catch (error) {
              fs.rmSync(probe, { force: true });
              throw new Error(`scene does not load: ${String(error?.message ?? error).split('\n')[0]}`);
            } finally {
              fs.rmSync(probe, { force: true });
            }
            if (mod.id !== id) throw new Error(`the module exports id "${mod.id}", not "${id}"`);
            if (typeof mod.render !== 'function') throw new Error('the module must export render(t)');
            fs.writeFileSync(file, source);

            let placed = null;
            if (add) {
              const timeline = JSON.parse(fs.readFileSync(path.join(project, 'timeline.json'), 'utf8'));
              if (timeline.scenes.some((scene) => scene.id === id)) throw new Error(`the film already has a scene "${id}"`);
              const seconds = Math.max(1, Math.min(600, Number(length) || 4));
              const start = timeline.scenes.reduce((sum, scene) => sum + scene.length, 0);
              timeline.scenes.push({ id, name: name || id, start, length: seconds, palette: 'main', speed: 1 });
              timeline.duration = start + seconds;
              await writeTimeline(project, timeline, `scene-${id}`);
              placed = { start, length: seconds, duration: timeline.duration };
            }

            return JSON.stringify({ ok: true, id, slots: Object.keys(mod.slots ?? {}), placed }, null, 2);
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_info',
          description:
            'Inspect the film: duration, fps, scenes and their start/length, palette tokens and the beat grid. Call before editing or rendering.',
          parameters: {},
          output: text('JSON'),
          execute: async (_args, exec) => {
            const project = filmOf(exec);
            const timeline = JSON.parse(fs.readFileSync(path.join(project, 'timeline.json'), 'utf8'));
            const beatsFile = path.join(project, 'out/beats.json');
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
            'Read or write a scene text slot (e.g. title, subtitle). A write validates and takes effect on the next frame.',
          parameters: {
            action: { type: 'string', required: true, description: 'get | set' },
            scene: { type: 'string', required: true },
            slot: { type: 'string', required: true },
            value: { type: 'string' },
          },
          output: text('value'),
          execute: async ({ action, scene, slot, value }, exec) => {
            const project = filmOf(exec);
            if (action === 'get') return runScript('texts.mjs', ['get', '--scene', scene, '--slot', slot], project);
            if (action !== 'set') throw new Error('action must be get or set');
            if (value === undefined) throw new Error('set needs value');
            return runScript('texts.mjs', ['set', '--scene', scene, '--slot', slot, '--value', value], project);
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_palette',
          description:
            'Change one color token. Without scene/element it edits the shared palette; with scene (and optionally element) it writes an override so a single element can differ.',
          parameters: {
            token: { type: 'string', required: true, description: 'bg | fg | accent | muted | grid | panel' },
            value: { type: 'string', required: true, description: '#rrggbb' },
            palette: { type: 'string', description: 'palette name, default main' },
            scene: { type: 'string', description: 'write an override for this scene' },
            element: { type: 'string', description: 'override for one element of that scene' },
          },
          output: text('changed'),
          execute: async ({ token, value, palette, scene, element }, exec) => {
            if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`not a hex color: ${value}`);
            const project = filmOf(exec);
            const timeline = JSON.parse(fs.readFileSync(path.join(project, 'timeline.json'), 'utf8'));
            if (scene) {
              const key = element ? `${scene}/${element}` : scene;
              timeline.overrides ??= {};
              timeline.overrides[key] = { ...(timeline.overrides[key] ?? {}), [token]: value };
              await writeTimeline(project, timeline, `palette-${key}`);
              return `override ${key}.${token} = ${value}`;
            }
            const name = palette ?? 'main';
            timeline.palettes ??= {};
            timeline.palettes[name] = { ...(timeline.palettes[name] ?? {}), [token]: value };
            await writeTimeline(project, timeline, `palette-${name}`);
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
            'Work with viewer annotations anchored to {t, rect, elementId}. The viewer writes a comment in the film panel; it reaches you as a chat message, so use this tool to read the anchors and to close the thread when the change is made.',
          parameters: {
            action: { type: 'string', required: true, description: 'list | resolve' },
            id: { type: 'string' },
          },
          output: text('JSON'),
          execute: async ({ action, id }, exec) => {
            const project = filmOf(exec);
            if (action === 'list') return JSON.stringify({ threads: list(project) }, null, 2);
            if (action === 'resolve') {
              if (!id) throw new Error('resolve needs id');
              return JSON.stringify(resolve(project, id), null, 2);
            }
            throw new Error('action must be list or resolve');
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
          execute: async ({ action, scene, key, value }, exec) => {
            const project = filmOf(exec);
            if (action === 'list') return JSON.stringify({ scenes: await describeProject(project) }, null, 2);
            if (action !== 'set') throw new Error('action must be list or set');
            if (!scene || !key || value === undefined) throw new Error('set needs scene, key and value');
            const out = await setProjectParam(project, scene, key, Number(value));
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
            'List earlier states of the film (newest first) or restore one. Every write keeps the previous state.',
          parameters: {
            action: { type: 'string', required: true, description: 'list | restore' },
            id: { type: 'string', description: 'snapshot id (restore)' },
          },
          output: text('JSON'),
          execute: async ({ action, id }, exec) => {
            const project = filmOf(exec);
            if (action === 'list') return JSON.stringify({ snapshots: history(project) }, null, 2);
            if (action !== 'restore') throw new Error('action must be list or restore');
            if (!id) throw new Error('restore needs id');
            const timeline = await restoreProject(project, id);
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
            'Read a reference video and return its structure, not adjectives: duration, cut points, a motion curve, dominant colours and one summary per segment. Use it before writing a scene when the user says "like this video".',
          parameters: {
            path: { type: 'string', required: true, description: 'local video file (mp4 / mov / webm)' },
            out: { type: 'string', description: 'output JSON, default out/reference.json' },
            cutThreshold: { type: 'number', description: 'frame-difference cut threshold 0..1, default 0.12' },
          },
          output: text('JSON'),
          execute: async ({ path: file, out, cutThreshold }, exec) => {
            if (!file) throw new Error('path is required');
            const project = filmOf(exec);
            return runScript(
              'reference.mjs',
              [file, '--out', out ?? 'out/reference.json', ...(cutThreshold ? ['--cut', String(cutThreshold)] : [])],
              project,
            );
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_render',
          description:
            'Render the film. mode=stills writes a contact sheet (fast, for review); mode=video renders MP4 with audio when the timeline has one. Rendering happens inside the plugin; the film appears in the panel as it is made.',
          parameters: {
            mode: { type: 'string', required: true, description: 'stills | video' },
            out: { type: 'string', description: 'output path, default out/sheet.png or out/film.mp4' },
            stills: { type: 'string', description: 'comma separated seconds for stills mode' },
            cols: { type: 'number', description: 'contact sheet columns, default 3' },
            fps: { type: 'number', description: 'video fps, default timeline fps' },
            supersample: { type: 'number', description: '1 = normal, 2 = render at 2x then downscale (sharper text)' },
          },
          output: text('path'),
          execute: async ({ mode, out, stills, cols, fps, supersample }, exec) => {
            const project = filmOf(exec);
            if (mode === 'stills') {
              const times = stills ?? '0,3,6,9,12';
              return runCapture(
                ['--stills', times, '--cols', String(cols ?? 3), '--out', out ?? 'out/sheet.png'],
                'stills',
                project,
              );
            }
            if (mode === 'video') {
              return runCapture(
                [
                  '--video',
                  ...(fps ? ['--fps', String(fps)] : []),
                  ...(supersample ? ['--supersample', String(supersample)] : []),
                  '--out', out ?? 'out/film.mp4',
                ],
                'video',
                project,
              );
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
            'Export the final file: format=mp4, or format=gif (15 fps, no audio).',
          parameters: {
            format: { type: 'string', required: true, description: 'mp4 | gif' },
            out: { type: 'string' },
            fps: { type: 'number' },
            supersample: { type: 'number', description: '1 = normal, 2 = 2x render then downscale' },
          },
          output: text('path'),
          execute: async ({ format, out, fps, supersample }, exec) => {
            const project = filmOf(exec);
            const fpsArgs = [...(fps ? ['--fps', String(fps)] : []), ...(supersample ? ['--supersample', String(supersample)] : [])];
            if (format === 'mp4') {
              return runCapture(['--video', ...fpsArgs, '--out', out ?? 'out/export.mp4'], 'export', project);
            }
            if (format === 'gif') {
              const src = 'out/export-src.mp4';
              await runCapture(['--video', '--no-audio', ...fpsArgs, '--out', src], 'export', project);
              const gif = out ?? 'out/export.gif';
              writeRenderState(project, { status: 'rendering', kind: 'gif', frame: 0, frames: 0, phase: 'encoding' });
              await runFfmpeg([
                '-loglevel', 'error', '-y',
                '-i', path.join(project, src),
                '-vf', 'fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
                '-loop', '0',
                path.join(project, gif),
              ]);
              fs.rmSync(path.join(project, src), { force: true });
              writeRenderState(project, { status: 'done', kind: 'gif', out: gif });
              return gif;
            }
            throw new Error('format must be mp4 or gif');
          },
        }),
      ),
    );

    // --- the film's own routes: /plugins/dsh-motion/p/<session>/... ---
    // Everything the panel loads is relative to that prefix, so the film's
    // timeline, scenes, assets and output all resolve inside the workspace.
    const pkgFile = (name, type) => (req, res) => sendFile(res, path.join(PKG_ROOT, 'lib', name), type);

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
            return sendJson(res, 200, JSON.parse(fs.readFileSync(renderStateFile(project), 'utf8')));
          } catch {
            return sendJson(res, 200, { status: 'idle' });
          }
        }
        return sendJson(res, 404, { error: 'unknown api route' });
      };
    };

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
        const name = path.basename(sub);
        return sendFile(res, path.join(PKG_ROOT, 'lib/chunks', name), 'text/javascript; charset=utf-8');
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

    // Optional: only the web profile has webServer. Injecting it strictly would
    // keep the tools pending in headless profiles, so routes live in a sub-scope.
    ctx.inject(['webServer'], (web) => {
      const served = [web.webServer.register({ kind: 'prefix', path: `${WEB}/p`, handler: mounted })];
      web.effect(() => () => served.forEach((dispose) => dispose()), 'dsh-motion: film routes');
    });

    ctx.inject(['agents'], (scope) => {
      agents = scope.agents;
    });

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, 'dsh-motion: tools');
}
