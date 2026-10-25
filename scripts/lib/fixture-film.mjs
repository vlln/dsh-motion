// A film for a test to look at.
//
// The package ships no look, so any gate that needs something on screen writes
// a shot — the same way an agent starts. One helper, so the fixtures cannot
// drift apart.

import fs from 'node:fs';
import path from 'node:path';
import { scaffoldFilm } from '../../src/film.mjs';

const scene = (id, label) => `export const id = "${id}";
export const kind = "canvas2d";
export const slots = { title: { default: ${JSON.stringify(label)}, role: "title" } };
export const textUsage = { title: 1 };
let ctx;
export function mount(c) { ctx = c; }
export function render(t) {
  const g = ctx.canvas.getContext("2d");
  g.fillStyle = ctx.color("bg");
  g.fillRect(0, 0, ctx.width, ctx.height);
  g.fillStyle = ctx.color("accent");
  g.fillRect(0, 0, 80 + Math.sin(t) * 60 + 60, ctx.height);
  g.fillStyle = ctx.color("fg");
  g.font = "64px sans-serif";
  g.fillText(ctx.text("title"), 80, 160);
}
`;

/**
 * Scaffold a film and give it exactly one shot.
 * @returns {{ dir: string, timeline: string, film: object }}
 */
export function fixtureFilm(root, { id = 'shot', length = 6, name = '镜头 1' } = {}) {
  const made = scaffoldFilm(root);
  fs.writeFileSync(path.join(made.dir, 'scenes', `${id}.mjs`), scene(id, name));
  const film = JSON.parse(fs.readFileSync(made.timeline, 'utf8'));
  film.duration = length;
  film.scenes = [{ id, name, start: 0, length, palette: 'main', speed: 1 }];
  fs.writeFileSync(made.timeline, `${JSON.stringify(film, null, 2)}\n`);
  return { ...made, film };
}
