// A film lives in the session's workspace, not in this package: `motion/` next
// to the code the agent is already working on. This module is the only place
// that knows that layout.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATES = path.join(PKG_ROOT, 'templates');
const TEMPLATE = path.join(PKG_ROOT, 'templates', 'blank.mjs');

const PALETTE = {
  bg: '#0b1426',
  fg: '#f2f2f0',
  accent: '#e0b040',
  muted: '#8b98ad',
  grid: '#243450',
  panel: '#101c33',
};

/** The film directory for one workspace root. */
export function filmDir(root) {
  return path.join(root, 'motion');
}

/** Whether this workspace has a film yet. */
export function hasFilm(root) {
  return fs.existsSync(path.join(filmDir(root), 'timeline.json'));
}

/** Throw the sentence the agent will actually read. */
export function requireFilm(root) {
  if (!hasFilm(root)) {
    throw new Error(
      'this workspace has no film yet — call motion_project with action=create first (it writes motion/timeline.json and motion/scenes/blank.mjs)',
    );
  }
  return filmDir(root);
}

/**
 * Create the workspace's film. Refuses to overwrite: a second create would
 * silently replace whatever the human and the agent already made.
 */
export function createFilm(root, { title = 'Untitled', name = '开场', length = 6 } = {}) {
  const dir = filmDir(root);
  const timeline = path.join(dir, 'timeline.json');
  if (fs.existsSync(timeline)) throw new Error(`a film already exists at ${path.relative(root, timeline)}`);

  const seconds = Math.max(1, Math.min(600, Number(length) || 6));
  fs.mkdirSync(path.join(dir, 'scenes'), { recursive: true });
  fs.copyFileSync(TEMPLATE, path.join(dir, 'scenes', 'blank.mjs'));
  // Renders and undo copies are not the film; the timeline and the scenes are.
  fs.writeFileSync(path.join(dir, '.gitignore'), 'out/\n.snapshots/\n');

  const film = {
    width: 1920,
    height: 1080,
    fps: 60,
    duration: seconds,
    palettes: { main: { ...PALETTE } },
    overrides: {},
    texts: { blank: { title: String(title || 'Untitled'), subtitle: '' } },
    values: {},
    scenes: [{ id: 'blank', name: String(name || '开场'), start: 0, length: seconds, palette: 'main', speed: 1 }],
  };
  fs.writeFileSync(timeline, `${JSON.stringify(film, null, 2)}\n`);
  return { dir, timeline, film };
}

/** A short account for tools and the panel's empty state. */
export function describeFilm(root) {
  const dir = filmDir(root);
  if (!hasFilm(root)) return { exists: false, dir };
  const film = JSON.parse(fs.readFileSync(path.join(dir, 'timeline.json'), 'utf8'));
  return {
    exists: true,
    dir,
    duration: film.duration,
    fps: film.fps,
    scenes: film.scenes?.length ?? 0,
    sceneIds: (film.scenes ?? []).map((s) => s.id),
  };
}

/**
 * Start a film from one of the package's templates: copy its timeline and its
 * scenes into the workspace. Templates that name a built-in scene ship only a
 * timeline; the rest carry their own .mjs.
 */
export function listTemplates() {
  if (!fs.existsSync(TEMPLATES)) return [];
  return fs
    .readdirSync(TEMPLATES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(TEMPLATES, entry.name, 'timeline.json')))
    .map((entry) => entry.name)
    .sort();
}

export function createFilmFromTemplate(root, id) {
  const name = String(id || '').trim();
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error('template id must be lowercase letters, digits or dashes');
  const src = path.join(TEMPLATES, name);
  if (!fs.existsSync(path.join(src, 'timeline.json'))) throw new Error(`no template "${name}"`);

  const dir = filmDir(root);
  const timeline = path.join(dir, 'timeline.json');
  if (fs.existsSync(timeline)) throw new Error(`a film already exists at ${path.relative(root, timeline)}`);

  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.gitignore'), 'out/\n.snapshots/\n');
  fs.copyFileSync(path.join(src, 'timeline.json'), timeline);
  const scenes = path.join(src, 'scenes');
  if (fs.existsSync(scenes)) {
    fs.mkdirSync(path.join(dir, 'scenes'), { recursive: true });
    for (const file of fs.readdirSync(scenes).filter((f) => f.endsWith('.mjs'))) {
      fs.copyFileSync(path.join(scenes, file), path.join(dir, 'scenes', file));
    }
  }
  const film = JSON.parse(fs.readFileSync(timeline, 'utf8'));
  return { dir, timeline, film };
}
