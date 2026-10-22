// Param API handlers, shared by the dev server (scripts/serve.mjs) and the
// plugin's web routes (lib/index.mjs). Same reason as comments: one
// implementation, two mount points.

import { describeProject, history, restoreProject, setProjectParam, setProjectText, setProjectValue } from './project.mjs';

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
      const { scene, key, value } = await readBody(req);
      if (!scene || !key) throw new Error('set needs scene and key');
      const out = await setProjectParam(root, scene, key, value);
      json(res, 200, { ok: true, scene, key, value: out.value, snapshot: out.snapshot });
    }),
    text: wrap(async (req, res) => {
      const { scene, slot, value } = await readBody(req);
      if (!scene || !slot) throw new Error('set needs scene and slot');
      if (value === undefined || value === null) throw new Error('set needs value');
      const out = await setProjectText(root, scene, slot, value);
      json(res, 200, { ok: true, scene, slot, value: out.value, snapshot: out.snapshot });
    }),
    value: wrap(async (req, res) => {
      const { scene, key, value } = await readBody(req);
      if (!scene || !key) throw new Error('set needs scene and key');
      if (value === undefined || value === null) throw new Error('set needs value');
      const out = await setProjectValue(root, scene, key, value);
      json(res, 200, { ok: true, scene, key, value: out.value, snapshot: out.snapshot });
    }),
    history: wrap(async (req, res) => json(res, 200, { snapshots: history(root) })),
    restore: wrap(async (req, res) => {
      const { id } = await readBody(req);
      if (!id) throw new Error('restore needs id');
      const timeline = await restoreProject(root, id);
      json(res, 200, { ok: true, restored: id, timeline });
    }),
  };
}
