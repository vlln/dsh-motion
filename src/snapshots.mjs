// Snapshots: every write to timeline.json is preceded by a copy of the previous
// file, so the panel's "drag a slider" loop has an undo and the agent has a
// receipt. Files live in .motion/snapshots/ (gitignored) — never in the repo.

import fs from 'node:fs';
import path from 'node:path';

const KEEP = 20;
const ID = /^[0-9TZ-]+-[A-Za-z0-9-]+$/;

const dir = (root) => path.join(root, '.snapshots');
const timelineFile = (root, file = 'timeline.json') => path.join(root, file);

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');
const slug = (reason) => String(reason).replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

/**
 * Copy the current timeline.json aside. Call this *before* writing: the point is
 * to keep the state the user can return to.
 */
export function snapshot(root, reason = 'edit', keep = KEEP, file = 'timeline.json') {
  const src = timelineFile(root, file);
  if (!fs.existsSync(src)) return null;

  const directory = dir(root);
  fs.mkdirSync(directory, { recursive: true });
  const id = `${stamp()}-${slug(reason) || 'edit'}`;
  const copy = path.join(directory, `${id}.json`);
  fs.copyFileSync(src, copy);
  prune(directory, keep);
  return { id, at: atOf(id), reason: reasonOf(id), bytes: fs.statSync(copy).size };
}

function reasonOf(id) {
  return id.slice(25) || 'edit';
}

/** 2026-10-20T16-15-25-123Z -> 2026-10-20T16:15:25.123Z */
function atOf(id) {
  return id.slice(0, 24).replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z');
}

function prune(directory, keep) {
  const files = fs
    .readdirSync(directory)
    .filter((f) => f.endsWith('.json'))
    .sort();
  for (const f of files.slice(0, Math.max(0, files.length - keep))) {
    fs.rmSync(path.join(directory, f), { force: true });
  }
}

/** Newest first. */
export function listSnapshots(root) {
  const directory = dir(root);
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .map((f) => {
      const id = f.replace(/\.json$/, '');
      return { id, at: atOf(id), reason: reasonOf(id), bytes: fs.statSync(path.join(directory, f)).size };
    });
}

/** Read a snapshot by id. Refuses ids that are not plain filenames. */
export function readSnapshot(root, id) {
  if (!ID.test(id)) throw new Error(`bad snapshot id: ${id}`);
  const file = path.join(dir(root), `${id}.json`);
  if (!fs.existsSync(file)) throw new Error(`no such snapshot: ${id}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
