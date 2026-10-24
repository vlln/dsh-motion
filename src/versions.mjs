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

export function listVersions(root, { includeSafety = false } = {}) {
  try {
    const index = JSON.parse(fs.readFileSync(meta(root), 'utf8'));
    const all = Array.isArray(index.versions) ? index.versions : [];
    // The list is edits only. A safety copy is undo scratch, and a row written
    // before 'kind' existed is not a version either — the list must never show
    // "切到 v2 之前" as if it were a name someone chose.
    return includeSafety ? all : all.filter((v) => v.kind === 'edit');
  } catch {
    return [];
  }
}

export function currentVersion(root) {
  try {
    return JSON.parse(fs.readFileSync(meta(root), 'utf8')).current ?? null;
  } catch {
    return null;
  }
}

function saveIndex(root, versions, current = null) {
  fs.mkdirSync(dir(root), { recursive: true });
  fs.writeFileSync(meta(root), `${JSON.stringify({ versions, current }, null, 2)}\n`);
}

function readScenes(root) {
  const out = {};
  // Scenes may sit in subdirectories (a shared lib/ is common), and a directory
  // is not a file: reading it throws EISDIR. Walk, and key by relative path.
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.name.endsWith('.mjs')) out[rel] = fs.readFileSync(path.join(dir, entry.name), 'utf8');
    }
  };
  try {
    walk(scenesDir(root), '');
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
export function createVersion(root, { title, kind = 'edit' } = {}) {
  if (!fs.existsSync(timelineFile(root))) throw new Error('no film here (timeline.json missing)');
  // ids count every record, hidden ones included, so they never get reused
  const versions = listVersions(root, { includeSafety: true });
  const id = `v${versions.length + 1}`;
  const at = new Date().toISOString();
  const timeline = JSON.parse(fs.readFileSync(timelineFile(root), 'utf8'));
  const scenes = readScenes(root);
  const record = {
    id,
    at,
    title: String(title ?? '').trim() || `版本 ${id}`,
    kind,
    mtime: filmMtime(root),
    timeline,
    scenes,
  };
  fs.mkdirSync(dir(root), { recursive: true });
  fs.writeFileSync(path.join(dir(root), `${id}.json`), `${JSON.stringify(record, null, 2)}\n`);
  // newest first, so the panel renders top-down without sorting
  saveIndex(root, [{ id, at, title: record.title, kind: record.kind, mtime: record.mtime }, ...versions], id);
  return { id, at, title: record.title };
}

/**
 * Switch to an older version. Navigation, not an edit: the list does not grow.
 * The state being replaced is kept as one *hidden* safety copy, and only when it
 * actually differs from the target.
 */
export function useVersion(root, id) {
  const versions = listVersions(root);
  const target = versions.find((v) => v.id === id);
  if (!target) throw new Error(`unknown version "${id}" (have: ${versions.map((v) => v.id).join(', ') || 'none'})`);
  const record = JSON.parse(fs.readFileSync(path.join(dir(root), `${id}.json`), 'utf8'));

  // Switching is navigation, not an edit: the list must not grow. Keep one
  // hidden safety copy of what is being replaced, and only when it differs.
  const current = fs.existsSync(timelineFile(root))
    ? { timeline: JSON.parse(fs.readFileSync(timelineFile(root), 'utf8')), scenes: readScenes(root) }
    : null;
  const same = current && JSON.stringify(current) === JSON.stringify({ timeline: record.timeline, scenes: record.scenes ?? {} });
  // Keep the displaced state, but outside the list: it is undo scratch, not a
  // version anyone named. Switching must not write a row that looks like one.
  if (current && !same) {
    const safety = JSON.parse(JSON.stringify(record));
    safety.id = `safety-${Date.now()}`;
    safety.kind = 'safety';
    safety.timeline = current.timeline;
    safety.scenes = current.scenes;
    fs.mkdirSync(path.join(dir(root), 'safety'), { recursive: true });
    fs.writeFileSync(path.join(dir(root), 'safety', `${safety.id}.json`), `${JSON.stringify(safety, null, 2)}\n`);
  }

  for (const [file, source] of Object.entries(record.scenes ?? {})) {
    const to = path.join(scenesDir(root), file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, source);
  }
  fs.writeFileSync(timelineFile(root), `${JSON.stringify(record.timeline, null, 2)}\n`);
  // the film on disk is now exactly this version
  saveIndex(root, versions, id);
  return { restored: id, title: record.title };
}
