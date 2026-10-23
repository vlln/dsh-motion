// Param API handlers, shared by the dev server (scripts/serve.mjs) and the
// plugin's web routes (lib/index.mjs). Same reason as comments: one
// implementation, two mount points.

import { TEMPLATES, createProject, describeProject, exportProject, history, listProjects, rebakeAsset, restoreProject, revision, setProjectAsset, setProjectParam, setProjectScene, setProjectText, setProjectValue } from './project.mjs';

const json = (res, code, data) => {
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

export function paramsHandlers(root) {
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      json(res, 400, { error: err.message });
    }
  };

  return {
    get: wrap(async (req, res) => json(res, 200, { scenes: await describeProject(root) })),
    set: wrap(async (req, res) => {
      const { scene, key, value, timeline } = await readBody(req);
      if (!scene || !key) throw new Error('set needs scene and key');
      const out = await setProjectParam(root, scene, key, value, timeline);
      json(res, 200, { ok: true, scene, key, value: out.value, snapshot: out.snapshot });
    }),
    text: wrap(async (req, res) => {
      const { scene, slot, value, timeline } = await readBody(req);
      if (!scene || !slot) throw new Error('set needs scene and slot');
      if (value === undefined || value === null) throw new Error('set needs value');
      const out = await setProjectText(root, scene, slot, value, timeline);
      json(res, 200, { ok: true, scene, slot, value: out.value, snapshot: out.snapshot });
    }),
    value: wrap(async (req, res) => {
      const { scene, key, value, timeline } = await readBody(req);
      if (!scene || !key) throw new Error('set needs scene and key');
      if (value === undefined || value === null) throw new Error('set needs value');
      const out = await setProjectValue(root, scene, key, value, timeline);
      json(res, 200, { ok: true, scene, key, value: out.value, snapshot: out.snapshot });
    }),
    asset: wrap(async (req, res) => {
      const { name, src, timeline } = await readBody(req);
      if (!name || !src) throw new Error('set needs name and src');
      const out = await setProjectAsset(root, name, src, timeline);
      json(res, 200, { ok: true, name: out.name, src: out.src, snapshot: out.snapshot });
    }),
    rebake: wrap(async (req, res) => {
      const { name, src, timeline } = await readBody(req);
      if (!name) throw new Error('rebake needs name');
      const out = await rebakeAsset(root, name, src, timeline);
      json(res, 200, { ok: true, name: out.name, src: out.src, manifest: out.manifest });
    }),
    scene: wrap(async (req, res) => {
      const { scene, name, length, speed, timeline } = await readBody(req);
      if (!scene) throw new Error('scene edit needs scene');
      const out = await setProjectScene(root, scene, { name, length, speed }, timeline);
      json(res, 200, { ok: true, scene: out.scene, duration: out.duration, snapshot: out.snapshot });
    }),
    export: wrap(async (req, res) => {
      const { format, fps, supersample, height, quality, timeline } = await readBody(req);
      const out = await exportProject(root, { format, fps, supersample, height, quality, file: timeline });
      json(res, 200, { ok: true, ...out });
    }),
    projects: wrap(async (req, res) =>
      json(res, 200, {
        projects: listProjects(root),
        templates: Object.entries(TEMPLATES).map(([id, spec]) => ({ id, ...spec })),
      }),
    ),
    create: wrap(async (req, res) => {
      const { name, template } = await readBody(req);
      const out = await createProject(root, { name, template });
      json(res, 200, { ok: true, ...out });
    }),
    revision: wrap(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const file = url.searchParams.get('timeline') ?? 'timeline.json';
      json(res, 200, revision(root, file));
    }),
    history: wrap(async (req, res) => json(res, 200, { snapshots: history(root) })),
    restore: wrap(async (req, res) => {
      const { id, timeline: target } = await readBody(req);
      if (!id) throw new Error('restore needs id');
      const timeline = await restoreProject(root, id, target);
      json(res, 200, { ok: true, restored: id, timeline });
    }),
  };
}
