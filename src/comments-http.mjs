// Comment API handlers shared by the dev server (scripts/serve.mjs) and the
// plugin's web routes (lib/index.mjs). One implementation, two mount points.

import { addThread, list, resolve } from './comments.mjs';

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

export function commentsHandlers(root) {
  const wrap = (fn) => async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      json(res, 400, { error: err.message });
    }
  };

  return {
    list: wrap(async (req, res) => json(res, 200, { threads: list(root) })),
    create: wrap(async (req, res) => json(res, 201, { thread: addThread(root, await readBody(req)) })),
    resolve: wrap(async (req, res) => {
      const { id } = await readBody(req);
      json(res, 200, resolve(root, id));
    }),
  };
}
