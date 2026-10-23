#!/usr/bin/env node
// Project gate: a new film can start from a template instead of from a hand
// written timeline.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGate } from './lib/gate.mjs';
import { startServer } from './serve.mjs';
import { createProject } from '../src/project.mjs';
import { validateTimeline } from '../src/validate.mjs';
import { modules } from '../src/project.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { check, finish } = createGate();

const made = [];
const make = async (opts) => {
  const out = await createProject(ROOT, opts);
  made.push(path.join(ROOT, out.file));
  return out;
};

try {
  const project = await make({ name: 'Gate Project', template: 'data-lab' });
  check('a template seeds a new timeline file', fs.existsSync(path.join(ROOT, project.file)), project.file);

  const timeline = JSON.parse(fs.readFileSync(path.join(ROOT, project.file), 'utf8'));
  const mods = await modules();
  check('the new timeline validates against the scene modules', validateTimeline(timeline, mods).ok, JSON.stringify(validateTimeline(timeline, mods).errors));
  check('it opens with one scene from the template', timeline.scenes.length === 1 && timeline.scenes[0].id === 'data-lab', JSON.stringify(timeline.scenes[0]));
  check('the duration matches that scene', timeline.duration === timeline.scenes[0].length, `${timeline.duration}s`);

  let duplicate = '';
  try {
    await createProject(ROOT, { name: 'gate project', template: 'text-lab' });
  } catch (err) {
    duplicate = err.message;
  }
  check('the same name cannot be created twice', /already exists/.test(duplicate), duplicate || 'accepted');

  let unknown = '';
  try {
    await createProject(ROOT, { name: 'x', template: 'nope' });
  } catch (err) {
    unknown = err.message;
  }
  check('an unknown template is refused', /unknown template/.test(unknown), unknown || 'accepted');

  let empty = '';
  try {
    await createProject(ROOT, { name: '  ', template: 'data-lab' });
  } catch (err) {
    empty = err.message;
  }
  check('an empty name is refused', /name must be/.test(empty), empty || 'accepted');

  // --- the panel path ---
  const { origin, close } = await startServer();
  try {
    const listed = await (await fetch(`${origin}/api/projects`)).json();
    check('the API lists projects and templates', listed.projects.some((p) => p.file === project.file) && listed.templates.length >= 4, `${listed.projects.length} files · ${listed.templates.length} templates`);
    check('a created file is served', (await fetch(`${origin}/${project.file}`)).status === 200, project.file);
    check('an arbitrary json name is not served', (await fetch(`${origin}/secrets.json`)).status === 404);
  } finally {
    close();
  }
} finally {
  for (const file of made) fs.rmSync(file, { force: true });
}

finish();
