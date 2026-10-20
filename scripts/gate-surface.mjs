#!/usr/bin/env node
// Tool-surface gate: every tool the plugin registers must actually run.
// A tool can be registered, documented, and still throw on first call (motion_comments
// once called an unimported function). This gate drives the real Cordis entry with a
// fake context — no model, no browser — and executes every read-only path.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { linkSdk } from './lib/dsh.mjs';
import { loadTools } from './lib/surface.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

// The entry imports @deepseek-ai/dsh-tools; make sure the local link exists.
try {
  linkSdk(ROOT);
} catch {
  /* the gates run offline; a missing link surfaces on import below */
}

const { tools, routes, dispose } = await loadTools(ROOT);

const expected = [
  'motion_info', 'motion_texts', 'motion_palette', 'motion_comments', 'motion_params',
  'motion_history', 'motion_reference', 'motion_render', 'motion_export',
];
const missing = expected.filter((name) => !tools.has(name));
check('every declared tool is registered', missing.length === 0, missing.join(', ') || `${tools.size} tools`);

const shapeless = [...tools.values()].filter((t) => typeof t.execute !== 'function' || !t.description || !t.parameters);
check('every tool has an execute, a description and parameters', shapeless.length === 0, shapeless.map((t) => t.name).join(', '));

const run = async (name, args) => {
  const tool = tools.get(name);
  if (!tool) throw new Error(`no such tool: ${name}`);
  return tool.execute(args);
};

// --- read-only paths: these must return data, not throw ---
// One broken tool should not abort the report, so each call is attempted separately.
const attempt = async (name, args) => {
  try {
    return { ok: true, value: await run(name, args) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
};

const info = await attempt('motion_info', {});
const infoData = info.ok ? JSON.parse(info.value) : null;
check(
  'motion_info returns the timeline',
  Boolean(infoData && infoData.duration === 19 && infoData.scenes.length === 3),
  infoData ? `${infoData.duration}s · ${infoData.scenes.length} scenes` : info.error,
);

const comments = await attempt('motion_comments', { action: 'list' });
const threads = comments.ok ? JSON.parse(comments.value).threads : null;
check('motion_comments list returns threads', Array.isArray(threads), threads ? `${threads.length} threads` : comments.error);

const params = await attempt('motion_params', { action: 'list' });
const knobScene = params.ok ? JSON.parse(params.value).scenes.find((s) => s.id === 'first-peoples') : null;
check('motion_params lists knobs with values', knobScene?.knobs.length === 6, knobScene ? `${knobScene.knobs.length} knobs` : params.error);

const history = await attempt('motion_history', { action: 'list' });
const snaps = history.ok ? JSON.parse(history.value).snapshots : null;
check('motion_history lists snapshots', Array.isArray(snaps), snaps ? `${snaps.length} snapshots` : history.error);

const title = await attempt('motion_texts', { action: 'get', scene: 'first-peoples', slot: 'title' });
check('motion_texts get returns a value', title.ok && typeof title.value === 'string' && title.value.length > 0, title.ok ? JSON.stringify(title.value) : title.error);

// --- writes that must be refused before touching the file ---
const refused = async (name, args) => {
  try {
    await run(name, args);
    return null;
  } catch (err) {
    return err.message;
  }
};

const outOfRange = await refused('motion_params', { action: 'set', scene: 'first-peoples', key: 'axisY', value: 5 });
check('motion_params refuses an out-of-range value', /0\.45\.\.0\.82/.test(outOfRange ?? ''), outOfRange ?? 'accepted');

const noId = await refused('motion_comments', { action: 'reply', id: '', text: 'x' });
check('motion_comments refuses a reply without an id', /needs id/.test(noId ?? ''), noId ?? 'accepted');

const ghostTool = await refused('motion_history', { action: 'restore', id: '../timeline' });
check('motion_history refuses a traversal id', /bad snapshot id/.test(ghostTool ?? ''), ghostTool ?? 'accepted');

// motion_reference runs the same script the reference gate drives; here we only
// prove the wiring fails loudly on a bad path (the happy path is gate:reference).
const badRef = await refused('motion_reference', { path: 'out/definitely-missing.mp4' });
check('motion_reference reports a missing file', /no such file/.test(badRef ?? ''), badRef ?? 'accepted');

// --- the panel routes exist even without a browser ---
const paths = routes.map((r) => r.path);
for (const suffix of ['/app', '/api/comments', '/api/params', '/api/history']) {
  check(`panel route ${suffix} is registered`, paths.some((p) => p === `/plugins/dsh-motion${suffix}`), paths.length + ' routes');
}

dispose();

finish();
