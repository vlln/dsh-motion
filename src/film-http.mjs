// The two read-only answers the panel needs before it can mount anything:
//
//   · which film should be shown — the published version, not the working tree;
//   · the files of that version.
//
// Shared by the dev server (scripts/serve.mjs) and the plugin's own routes
// (lib/index.mjs). They existed only in the dev server once, which meant the
// installed plugin still mounted the working tree while the repo previewed the
// version — the same panel behaving two ways depending on how it was started.

import fs from 'node:fs';
import path from 'node:path';
import { listVersions, isDirty, currentVersion, versionRecord, filmMtime } from './versions.mjs';

const BUILDING_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Contain a relative path inside `root`; null when it would escape. */
export function under(root, rel) {
  const file = path.resolve(root, rel);
  return file === root || file.startsWith(root + path.sep) ? file : null;
}

/**
 * What the panel should show. Not the same question as "does a file exist": a
 * film is published by `version`, and a working tree newer than the newest
 * version is being built, so it must not be mounted.
 */
export function filmStatus(root) {
  const versions = listVersions(root);
  const newest = versions[0] ?? null;
  // A film that has never been published is not "being changed" — it is simply
  // unpublished, and the panel may mount it. Only a working tree that has moved
  // past a published version is off limits.
  const dirty = versions.length ? isDirty(root) : false;
  const hasFilm = fs.existsSync(path.join(root, 'timeline.json'));
  const state = !newest ? (hasFilm ? 'ready' : 'none') : dirty ? 'building' : 'ready';
  return {
    state,
    version: newest
      ? { id: newest.id, title: newest.title, at: newest.at, current: currentVersion(root) }
      : null,
    versions: versions.length,
    dirty,
    // A write older than the window is debris, not an agent at work.
    stale: dirty && Date.now() - filmMtime(root) > BUILDING_WINDOW_MS,
  };
}

/**
 * A published version's own timeline and scenes. Anything else under the same
 * prefix (assets/, kit/) falls through to the working tree: those rarely change
 * and do not belong in a version record.
 */
export function versionFile(root, id, rel) {
  const record = versionRecord(root, id);
  if (!record) return null;
  const clean = rel.replace(/^\/+/, '');
  if (clean === 'timeline.json') {
    return { body: JSON.stringify(record.timeline), type: 'application/json; charset=utf-8' };
  }
  const scene = record.scenes?.[clean.startsWith('scenes/') ? clean.slice(7) : clean];
  if (scene !== undefined) return { body: scene, type: 'text/javascript; charset=utf-8' };
  return null;
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
};

/**
 * The whole answer to `/api/version/<id>/<rel>`: the version's own file, else
 * the working tree's copy when it is inside the film directory, else 404.
 * Returns `{ status, type, body }` so both servers can just write it out.
 */
export function versionResponse(root, id, rel) {
  const hit = versionFile(root, id, rel);
  if (hit) return { status: 200, type: hit.type, body: hit.body };

  const file = under(root, rel);
  if (!file) return { status: 403, type: 'application/json; charset=utf-8', body: JSON.stringify({ error: 'forbidden' }) };
  try {
    return {
      status: 200,
      type: TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      body: fs.readFileSync(file),
    };
  } catch {
    return { status: 404, type: 'application/json; charset=utf-8', body: JSON.stringify({ error: 'no such file in this version' }) };
  }
}
