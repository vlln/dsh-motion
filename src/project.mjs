// The project edit layer: the one place that reads timeline.json, checks a
// change against the scene modules, snapshots the previous file, then writes.
// The panel API and the agent tools both go through here, so a drag and a tool
// call cannot drift apart.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { validateTimeline } from './validate.mjs';
import { describeParams, resolveParam, checkParam as validateParam } from './params.mjs';
import { checkValue as validateValue } from './values.mjs';
import { listSnapshots, readSnapshot, snapshot } from './snapshots.mjs';

const timelineFile = (root, file = 'timeline.json') => {
  const abs = path.resolve(root, file);
  if (!abs.startsWith(root + path.sep)) throw new Error(`timeline path escapes the package: ${file}`);
  if (path.extname(abs) !== '.json') throw new Error(`timeline must be a .json file: ${file}`);
  return abs;
};

// The node-side module list pulls three in (orbit.mjs). Loading it lazily keeps
// `dsh` boot free of that cost: only an edit or a panel open ever pays it.
let cached = null;
const projectModules = new Map();

/**
 * Every scene this film can use: the package's built-ins plus whatever the
 * agent wrote into <film>/scenes/. Project modules are re-imported when their
 * mtime moves, so an edit is visible without restarting the plugin.
 */
export async function modules(root) {
  cached ??= (await import('./scenes/all.mjs')).modules;
  if (!root) return cached;
  const dir = path.join(root, 'scenes');
  if (!fs.existsSync(dir)) return cached;
  const list = [...cached];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort()) {
    const file = path.join(dir, name);
    const stamp = fs.statSync(file).mtimeMs;
    const key = `${file}:${stamp}`;
    let mod = projectModules.get(key);
    if (!mod) {
      mod = await import(`${pathToFileURL(file).href}?v=${stamp}`);
      projectModules.set(key, mod);
    }
    list.push(mod);
  }
  return list;
}

export function readTimeline(root, file = 'timeline.json') {
  return JSON.parse(fs.readFileSync(timelineFile(root, file), 'utf8'));
}

function assertValid(timeline, mods) {
  const { ok, errors } = validateTimeline(timeline, mods);
  if (!ok) throw new Error(`invalid timeline:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
}

/** Validate, keep the previous file, then write. `reason` ends up in the snapshot id. */
export async function writeTimeline(root, timeline, reason = 'edit', file = 'timeline.json') {
  const mods = await modules(root);
  assertValid(timeline, mods);
  const snap = snapshot(root, reason, undefined, file);
  fs.writeFileSync(timelineFile(root, file), `${JSON.stringify(timeline, null, 2)}\n`);
  return snap;
}

/** Every scene that declares knobs, with its current values. */
export async function describeProject(root, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const mods = await modules(root);
  return timeline.scenes
    .map((scene) => {
      const mod = mods.find((m) => m.id === scene.id);
      return {
        id: scene.id,
        name: scene.name,
        knobs: describeParams(timeline, scene, mod?.params),
      };
    })
    .filter((scene) => scene.knobs.length > 0);
}

export async function setProjectParam(root, sceneId, key, value, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const scene = timeline.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`unknown scene "${sceneId}"`);

  const mod = (await modules(root)).find((m) => m.id === sceneId);
  validateParam(mod?.params, key, value);

  timeline.params ??= {};
  timeline.params[sceneId] ??= {};
  timeline.params[sceneId][key] = value;

  const snap = await writeTimeline(root, timeline, `param-${sceneId}-${key}`, file);
  return { value: resolveParam(timeline, scene, mod.params, key), snapshot: snap };
}

export async function setProjectText(root, sceneId, slot, value, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const scene = timeline.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`unknown scene "${sceneId}"`);

  const mod = (await modules(root)).find((m) => m.id === sceneId);
  if (!mod?.slots?.[slot]) {
    throw new Error(`unknown slot "${slot}" for scene "${sceneId}" (declared: ${Object.keys(mod?.slots ?? {}).join(', ') || 'none'})`);
  }

  timeline.texts ??= {};
  timeline.texts[sceneId] ??= {};
  timeline.texts[sceneId][slot] = String(value);

  const snap = await writeTimeline(root, timeline, `text-${sceneId}-${slot}`, file);
  return { value: String(value), snapshot: snap };
}

export async function setProjectValue(root, sceneId, key, value, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const scene = timeline.scenes.find((s) => s.id === sceneId);
  if (!scene) throw new Error(`unknown scene "${sceneId}"`);

  const mod = (await modules(root)).find((m) => m.id === sceneId);
  validateValue(mod?.values, key, value);

  timeline.values ??= {};
  timeline.values[sceneId] ??= {};
  timeline.values[sceneId][key] = value;

  const snap = await writeTimeline(root, timeline, `value-${sceneId}-${key}`, file);
  return { value, snapshot: snap };
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

/**
 * Point an existing image asset at another file inside the package.
 * Clips are refused: their sprite sheet was baked by `npm run assets`, so a new
 * source needs a new bake — changing the path alone would render the old frames.
 */
/**
 * Scene-level edits: length and speed. Lengths reflow — scenes are contiguous,
 * so changing one moves every later scene and the total duration with it.
 */
export async function setProjectScene(root, sceneId, patch, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const index = timeline.scenes.findIndex((s) => s.id === sceneId);
  if (index === -1) throw new Error(`unknown scene "${sceneId}"`);

  if (patch.length !== undefined) {
    const length = Number(patch.length);
    if (!Number.isFinite(length) || length < 0.5) throw new Error(`length must be >= 0.5s (got ${patch.length})`);
    if (length > 600) throw new Error(`length must be <= 600s (got ${length})`);
    timeline.scenes[index].length = Number(length.toFixed(2));
  }
  if (patch.speed !== undefined) {
    const speed = Number(patch.speed);
    if (![0.5, 1, 2].includes(speed)) throw new Error(`speed must be 0.5 | 1 | 2 (got ${patch.speed})`);
    timeline.scenes[index].speed = speed;
  }

  let cursor = 0;
  for (const scene of timeline.scenes) {
    scene.start = Number(cursor.toFixed(2));
    cursor += scene.length;
  }
  timeline.duration = Number(cursor.toFixed(2));

  const snap = await writeTimeline(root, timeline, `scene-${sceneId}`, file);
  return { scene: timeline.scenes[index], duration: timeline.duration, snapshot: snap };
}

export async function setProjectAsset(root, name, src, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const spec = timeline.assets?.[name];
  if (!spec) throw new Error(`unknown asset "${name}" (declared: ${Object.keys(timeline.assets ?? {}).join(', ') || 'none'})`);
  if (spec.kind !== 'image') {
    throw new Error(`asset "${name}" is ${spec.kind === 'image' ? 'an' : 'a'} ${spec.kind}: re-run \`npm run assets\` after changing its source`);
  }

  const abs = path.resolve(root, src);
  if (!abs.startsWith(root + path.sep)) throw new Error(`asset path escapes the package: ${src}`);
  if (!fs.existsSync(abs)) throw new Error(`asset not found: ${src}`);
  const ext = path.extname(abs).toLowerCase();
  if (!IMAGE_EXT.has(ext)) throw new Error(`not an image (${ext || 'no extension'}): ${src}`);

  timeline.assets[name] = { ...spec, src };
  const snap = await writeTimeline(root, timeline, `asset-${name}`, file);
  return { name, src, snapshot: snap };
}

const VIDEO_EXT = new Set(['.mp4', '.mov', '.webm', '.mkv', '.m4v']);

/**
 * Rebake a clip: optionally repoint it, then run the sheet builder for that one
 * asset. If the bake fails the timeline is rolled back — a clip whose source is
 * not baked would render stale frames, which is worse than refusing.
 */
export async function rebakeAsset(root, name, src, file = 'timeline.json') {
  const timeline = readTimeline(root, file);
  const spec = timeline.assets?.[name];
  if (!spec) throw new Error(`unknown asset "${name}" (declared: ${Object.keys(timeline.assets ?? {}).join(', ') || 'none'})`);
  if (spec.kind !== 'clip') throw new Error(`asset "${name}" is ${spec.kind === 'image' ? 'an' : 'a'} ${spec.kind}: only clips are baked`);

  const target = src ?? spec.src;
  const abs = path.resolve(root, target);
  if (!abs.startsWith(root + path.sep)) throw new Error(`asset path escapes the package: ${target}`);
  if (!fs.existsSync(abs)) throw new Error(`asset not found: ${target}`);
  if (!VIDEO_EXT.has(path.extname(abs).toLowerCase())) {
    throw new Error(`not a video (${path.extname(abs) || 'no extension'}): ${target}`);
  }

  const previous = fs.readFileSync(timelineFile(root, file), 'utf8');
  if (target !== spec.src) {
    timeline.assets[name] = { ...spec, src: target };
    await writeTimeline(root, timeline, `asset-${name}`, file);
  }

  try {
    execFileSync(process.execPath, [path.join(root, 'scripts/assets.mjs'), 'prep', '--only', name, '--timeline', 'timeline.json'], {
      cwd: root,
      encoding: 'utf8',
    });
  } catch (err) {
    fs.writeFileSync(timelineFile(root, file), previous);
    throw new Error(`rebake failed: ${String(err.stderr || err.stdout || err.message).trim()}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'out/media', `${name}.json`), 'utf8'));
  return { name, src: target, manifest };
}

/**
 * Render the finished file and return where it landed. The panel calls this with
 * the timeline it is looking at; the file name carries a timestamp so repeated
 * exports do not overwrite each other.
 */
/** Scene modules that can seed a new project, with what each one needs. */
export const TEMPLATES = {
  'first-peoples': { title: '时间轴示例', note: '一条时间轴 + 双泳道卡片', length: 6 },
  'data-lab': { title: '数据与图表', note: '数字槽 + 条形', length: 4 },
  'media-lab': { title: '素材与实拍', note: '图片 + 视频帧（需要 out/fixtures）', length: 4 },
  'text-lab': { title: '文字版式', note: '中文断行 + 多行', length: 4 },
};

const MAIN_PALETTE = {
  bg: '#0b1426',
  fg: '#f2f2f0',
  accent: '#e0b040',
  muted: '#8b98ad',
  grid: '#243450',
  panel: '#101c33',
};

const sha = (buf) => crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);

/**
 * Two signals the panel polls: the timeline file, and everything that only takes
 * effect after a real page load (bundled or source scene code).
 */
export function revision(root, file = 'timeline.json') {
  const parts = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      const abs = path.join(dir, name);
      const stat = fs.statSync(abs);
      if (stat.isDirectory()) walk(abs);
      else if (/\.(mjs|js|css|html)$/.test(name)) parts.push(`${path.relative(root, abs)}:${stat.mtimeMs}:${stat.size}`);
    }
  };
  walk(path.join(root, 'src'));
  for (const name of ['lib/app.js', 'lib/app.css', 'lib/app.html']) {
    const abs = path.join(root, name);
    if (!fs.existsSync(abs)) continue;
    const stat = fs.statSync(abs);
    parts.push(`${name}:${stat.mtimeMs}:${stat.size}`);
  }
  return { timeline: sha(fs.readFileSync(timelineFile(root, file))), tree: sha(Buffer.from(parts.join('|'))) };
}

export function listProjects(root) {
  return fs
    .readdirSync(root)
    .filter((name) => /^timeline.*\.json$/.test(name))
    .sort()
    .map((name) => {
      try {
        const timeline = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
        return { file: name, scenes: timeline.scenes?.length ?? 0, duration: timeline.duration ?? 0 };
      } catch {
        return { file: name, scenes: 0, duration: 0 };
      }
    });
}

/** Create a new timeline file from a template and return its name. */
export async function createProject(root, { name, template }) {
  const spec = TEMPLATES[template];
  if (!spec) throw new Error(`unknown template "${template}" (available: ${Object.keys(TEMPLATES).join(', ')})`);
  const slug = String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug || slug.length > 40) throw new Error('name must be 1–40 chars of letters, digits or dashes');

  const file = `timeline-${slug}.json`;
  const abs = path.join(root, file);
  if (fs.existsSync(abs)) throw new Error(`${file} already exists`);

  const mods = await modules();
  if (!mods.some((m) => m.id === template)) throw new Error(`no scene module registered for "${template}"`);

  const length = spec.length;
  const timeline = {
    width: 1920,
    height: 1080,
    fps: 60,
    duration: length,
    palettes: { main: { ...MAIN_PALETTE } },
    assets:
      template === 'media-lab'
        ? {
            plate: { kind: 'image', src: 'out/fixtures/plate.png' },
            clipA: { kind: 'clip', src: 'out/fixtures/clip.mp4', fps: 24 },
          }
        : undefined,
    overrides: {},
    texts: {},
    values: {},
    scenes: [{ id: template, name: spec.title, start: 0, length, palette: 'main', speed: 1 }],
  };
  if (!timeline.assets) delete timeline.assets;

  assertValid(timeline, mods);
  fs.writeFileSync(abs, `${JSON.stringify(timeline, null, 2)}\n`);
  return { file, template, duration: length };
}

export async function exportProject(root, opts = {}) {
  const file = opts.file ?? 'timeline.json';
  const timeline = readTimeline(root, file);
  const format = opts.format ?? 'mp4';
  if (!['mp4', 'gif'].includes(format)) throw new Error(`format must be mp4 or gif (got ${format})`);

  const fps = Number(opts.fps ?? timeline.fps ?? 60);
  if (!(fps >= 1 && fps <= 120)) throw new Error(`fps must be 1..120 (got ${opts.fps})`);
  const supersample = Math.max(1, Math.min(2, Number(opts.supersample ?? 1)));

  const base = path.basename(file, '.json');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const mp4 = `out/exports/${base}-${stamp}${format === 'gif' ? '-src' : ''}.mp4`;
  const started = Date.now();

  execFileSync(
    process.execPath,
    ['scripts/capture.mjs', '--video', '--timeline', file, '--out', mp4, '--fps', String(fps), '--supersample', String(supersample), ...(format === 'gif' ? ['--no-audio'] : [])],
    { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );

  let rel = mp4;
  if (format === 'gif') {
    rel = mp4.replace(/-src\.mp4$/, '.gif');
    execFileSync(
      'ffmpeg',
      ['-loglevel', 'error', '-y', '-i', path.join(root, mp4), '-vf', 'fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse', '-loop', '0', path.join(root, rel)],
      { cwd: root },
    );
    fs.rmSync(path.join(root, mp4), { force: true });
  }

  const abs = path.join(root, rel);
  return {
    path: rel,
    format,
    fps,
    supersample,
    bytes: fs.statSync(abs).size,
    ms: Date.now() - started,
    duration: timeline.duration,
  };
}

export function history(root) {
  return listSnapshots(root);
}

/** Restore a snapshot; the state being replaced is itself snapshotted first. */
export async function restoreProject(root, id, file = 'timeline.json') {
  const next = readSnapshot(root, id);
  const mods = await modules(root);
  assertValid(next, mods);
  snapshot(root, 'pre-restore', undefined, file);
  fs.writeFileSync(timelineFile(root, file), `${JSON.stringify(next, null, 2)}\n`);
  return next;
}
