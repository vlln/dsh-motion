// Versions: what the agent finished, kept as a full snapshot of the film.
//
// A version is not a keystroke log (that is .snapshots/) — it is "one task done":
// the timeline plus every scene source at that moment, so restoring also brings
// back code, not just data. Assets are referenced, never copied.

import fs from 'node:fs';
import path from 'node:path';

const DIR = '.versions';
const dir = (root) => path.join(root, DIR);
const meta = (root) => path.join(dir(root), 'index.json');

const timelineFile = (root) => path.join(root, 'timeline.json');
const scenesDir = (root) => path.join(root, 'scenes');

export function listVersions(root) {
  try {
    const index = JSON.parse(fs.readFileSync(meta(root), 'utf8'));
    return Array.isArray(index.versions) ? index.versions : [];
  } catch {
    return [];
  }
}

function saveIndex(root, versions) {
  fs.mkdirSync(dir(root), { recursive: true });
  fs.writeFileSync(meta(root), `${JSON.stringify({ versions }, null, 2)}\n`);
}

function readScenes(root) {
  const out = {};
  try {
    for (const file of fs.readdirSync(scenesDir(root))) {
      if (!file.endsWith('.mjs')) continue;
      out[file] = fs.readFileSync(path.join(scenesDir(root), file), 'utf8');
    }
  } catch {
    /* a film may have no scenes directory yet */
  }
  return out;
}

/** Newest mtime under the film, so the panel can tell "changed since vN". */
export function filmMtime(root) {
  const stamps = [];
  const touch = (file) => {
    try {
      stamps.push(fs.statSync(file).mtimeMs);
    } catch {
      /* ignore */
    }
  };
  touch(timelineFile(root));
  try {
    for (const file of fs.readdirSync(scenesDir(root))) touch(path.join(scenesDir(root), file));
  } catch {
    /* no scenes yet */
  }
  return stamps.length ? Math.max(...stamps) : 0;
}

export function isDirty(root) {
  const versions = listVersions(root);
  if (!versions.length) return fs.existsSync(timelineFile(root));
  return filmMtime(root) > (versions[0].mtime ?? 0);
}

/** Write one version of the working tree. `title` is what the user will read. */
export function createVersion(root, { title, author = 'agent' } = {}) {
  if (!fs.existsSync(timelineFile(root))) throw new Error('no film here (timeline.json missing)');
  const versions = listVersions(root);
  const id = `v${versions.length + 1}`;
  const at = new Date().toISOString();
  const timeline = JSON.parse(fs.readFileSync(timelineFile(root), 'utf8'));
  const scenes = readScenes(root);
  const record = {
    id,
    at,
    title: String(title ?? '').trim() || `版本 ${id}`,
    author,
    mtime: filmMtime(root),
    timeline,
    scenes,
  };
  fs.mkdirSync(dir(root), { recursive: true });
  fs.writeFileSync(path.join(dir(root), `${id}.json`), `${JSON.stringify(record, null, 2)}\n`);
  // newest first, so the panel renders top-down without sorting
  saveIndex(root, [{ id, at, title: record.title, author, mtime: record.mtime }, ...versions]);
  return { id, at, title: record.title, author };
}

/**
 * Switch to an older version. Appending, never rewriting history: the state you
 * leave is saved as a version first, and the arrival is saved as another one.
 */
export function useVersion(root, id) {
  const versions = listVersions(root);
  const target = versions.find((v) => v.id === id);
  if (!target) throw new Error(`unknown version "${id}" (have: ${versions.map((v) => v.id).join(', ') || 'none'})`);
  const record = JSON.parse(fs.readFileSync(path.join(dir(root), `${id}.json`), 'utf8'));

  if (fs.existsSync(timelineFile(root))) createVersion(root, { title: `切到 ${id} 之前`, author: 'user' });

  fs.mkdirSync(scenesDir(root), { recursive: true });
  for (const [file, source] of Object.entries(record.scenes ?? {})) {
    fs.writeFileSync(path.join(scenesDir(root), file), source);
  }
  fs.writeFileSync(timelineFile(root), `${JSON.stringify(record.timeline, null, 2)}\n`);

  createVersion(root, { title: `回到 ${id}`, author: 'user' });
  return { restored: id, title: record.title };
}
