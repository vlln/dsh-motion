// A film lives in the session's workspace, not in this package: `motion/` next
// to the code the agent is already working on. This module is the only place
// that knows that layout.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = path.join(PKG_ROOT, 'kit');
const STORYBOARD = path.join(PKG_ROOT, 'howto', '镜头表.md');

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
/**
 * Start a film: a timeline with no shots, an empty storyboard, and a copy of
 * the kit.
 *
 * It deliberately does NOT bring a look. A starter scene is a style the agent
 * inherits whether or not it fits the subject, and the first thing that happens
 * to an inherited style is that it becomes the film. The shape here is: write
 * the storyboard, then write the first shot in your own code, using kit/ as
 * samples you are free to delete.
 */
export function scaffoldFilm(root, { title = 'Untitled' } = {}) {
  const dir = filmDir(root);
  const timeline = path.join(dir, 'timeline.json');
  if (fs.existsSync(timeline)) throw new Error(`a film already exists at ${path.relative(root, timeline)}`);

  fs.mkdirSync(path.join(dir, 'scenes'), { recursive: true });
  // Renders and undo copies are not the film; the timeline and the scenes are.
  fs.writeFileSync(path.join(dir, '.gitignore'), 'out/\n.snapshots/\n');

  const film = {
    width: 1920,
    height: 1080,
    fps: 60,
    duration: 0,
    palettes: { main: { ...PALETTE } },
    overrides: {},
    texts: {},
    values: {},
    scenes: [],
  };
  fs.writeFileSync(timeline, `${JSON.stringify(film, null, 2)}\n`);

  // Samples, not API: the film keeps its own copy and may delete every file.
  if (fs.existsSync(KIT)) fs.cpSync(KIT, path.join(dir, 'kit'), { recursive: true });
  // 少了镜头表是打包错误，不是"这次不用给"——以前的 existsSync 守卫把这种缺失吞掉了：
  // 目录改名之后 init 静默地不再生成镜头表，只有真正的 agent 用的时候才发现。
  if (!fs.existsSync(STORYBOARD)) {
    throw new Error(`the storyboard template is missing from the package: ${path.relative(PKG_ROOT, STORYBOARD)}`);
  }
  fs.copyFileSync(STORYBOARD, path.join(dir, '镜头表.md'));

  return { dir, timeline, film };
}

/** A short account for tools and the panel's empty state. */