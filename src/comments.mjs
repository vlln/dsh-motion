// Comment store shared by the preview server, the CLI and the future plugin.
// A thread is anchored to { t, rect, elementId } and only becomes actionable
// when the viewer explicitly activates it ("Send to Claude").

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FILE = 'out/comments.json';

export function storePath(root) {
  return path.join(root, FILE);
}

export function load(root) {
  const file = storePath(root);
  if (!fs.existsSync(file)) return { threads: [] };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(data.threads) ? data : { threads: [] };
  } catch {
    return { threads: [] };
  }
}

export function save(root, data) {
  const file = storePath(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const now = () => new Date().toISOString();

export function addThread(root, { id, anchor, text, sentAt }) {
  if (!anchor || typeof anchor.t !== 'number') throw new Error('anchor.t is required');
  if (!text || typeof text !== 'string') throw new Error('text is required');
  if (!sentAt) throw new Error('sentAt is required: a pin exists only after the words went out');

  const data = load(root);
  const thread = {
    id: id ?? `th_${crypto.randomBytes(4).toString('hex')}`,
    anchor: {
      t: Number(anchor.t.toFixed(2)),
      rect: anchor.rect
        ? {
            x: Math.round(anchor.rect.x),
            y: Math.round(anchor.rect.y),
            w: Math.round(anchor.rect.w),
            h: Math.round(anchor.rect.h),
          }
        : null,
      elementId: anchor.elementId ?? null,
    },
    status: 'open',
    sentAt,
    createdAt: now(),
    messages: [{ role: 'viewer', text, at: now() }],
  };
  data.threads.push(thread);
  save(root, data);
  return thread;
}

export function resolve(root, id) {
  const data = load(root);
  const thread = data.threads.find((x) => x.id === id);
  if (!thread) throw new Error(`unknown thread ${id}`);
  thread.status = 'resolved';
  thread.resolvedAt = now();
  save(root, data);
  return thread;
}

export function list(root, { onlyOpen = false } = {}) {
  const data = load(root);
  return onlyOpen ? data.threads.filter((x) => x.status === 'open') : data.threads;
}
