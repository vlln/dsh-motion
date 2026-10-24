#!/usr/bin/env node
// Templates gate: what a template must declare, not how it must look.
// A template states its cover time (poster); whether that frame is busy is art.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { createFilmFromTemplate, listTemplates } from '../src/film.mjs';
import { validateTimeline } from '../src/validate.mjs';
import { modules } from '../src/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-motion-templates-'));

try {
  const ids = listTemplates();
  check('templates exist', ids.length >= 4, ids.join(', '));
  for (const id of ids) {
    const dir = path.join(tmp, id);
    fs.mkdirSync(dir, { recursive: true });
    const { film } = createFilmFromTemplate(dir, id);
    check(`${id}: declares a cover time`, typeof film.poster === 'number', String(film.poster));
    check(`${id}: cover time is inside the film`, film.poster >= 0 && film.poster <= film.duration, `${film.poster}/${film.duration}`);
    // Validate with the film's own scenes, not just the package's built-ins.
    const mods = await modules(path.join(dir, 'motion'));
    const { ok, errors } = validateTimeline(film, mods);
    check(`${id}: timeline validates`, ok, errors.slice(0, 2).join(' · '));
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
finish();
