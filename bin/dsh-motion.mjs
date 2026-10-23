#!/usr/bin/env node
// dsh-motion — the library's command line. The agent works in its workspace:
// it writes motion/timeline.json and motion/scenes/*.mjs, then runs this.
//
// Every child process gets its temp directory inside the film, so nothing here
// writes outside the workspace: Chromium's profile and ffmpeg's scratch files
// land in motion/out/.tmp. That keeps the whole loop inside the sandbox.

import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTimeline } from '../src/validate.mjs';
import { modules } from '../src/project.mjs';
import { createFilm } from '../src/film.mjs';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const cmd = argv[0];

const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const flag = (name) => argv.includes(`--${name}`);

// One conventional place, relative to wherever the command runs: the workspace.
const FILM = path.resolve('motion');

function fail(message) {
  console.error(message);
  process.exit(1);
}

/** Temp inside the film: the only writable place a sandboxed shell is sure of. */
function withFilm(film = FILM) {
  const tmp = path.join(film, 'out', '.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  return { ...process.env, DSH_MOTION_PROJECT: film, TMPDIR: tmp, TMP: tmp, TEMP: tmp };
}

function run(script, args, film) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(PKG, 'scripts', script), ...args], {
      cwd: PKG,
      env: withFilm(film),
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

const ffmpeg = (args) =>
  new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { env: withFilm() }, (err) => (err ? reject(new Error(err.message)) : resolve()));
  });

async function init() {
  createFilm(process.cwd(), { title: opt('title', 'Untitled'), length: Number(opt('length', 6)) });
  console.log('motion/timeline.json');
  console.log('motion/scenes/blank.mjs');
  console.log('a starter scene is included; replace or add scenes under motion/scenes/');
}

async function validate() {
  if (!fs.existsSync(path.join(FILM, 'timeline.json'))) fail('no film here — run: dsh-motion init');
  const timeline = JSON.parse(fs.readFileSync(path.join(FILM, 'timeline.json'), 'utf8'));
  const mods = await modules(FILM);
  const { ok, errors } = validateTimeline(timeline, mods);
  if (!ok) {
    console.error('invalid timeline:');
    for (const line of errors) console.error(`  - ${line}`);
    process.exit(1);
  }
  const seconds = timeline.scenes.reduce((sum, s) => sum + s.length, 0);
  console.log(`ok · ${timeline.scenes.length} scene(s) · ${seconds}s · ${timeline.width}x${timeline.height} @ ${timeline.fps}fps`);
}

async function render() {
  if (!fs.existsSync(path.join(FILM, 'timeline.json'))) fail('no film here — run: dsh-motion init');
  const out = opt('out');
  if (flag('video')) {
    await run('capture.mjs', ['--video', ...(out ? ['--out', out] : []), ...(opt('fps') ? ['--fps', opt('fps')] : [])], FILM);
    return;
  }
  const stills = opt('stills', '0,3,6');
  await run('capture.mjs', ['--stills', stills, '--cols', String(opt('cols', 3)), '--out', out ?? 'out/sheet.png'], FILM);
}

async function exportVideo() {
  if (!fs.existsSync(path.join(FILM, 'timeline.json'))) fail('no film here — run: dsh-motion init');
  const out = opt('out');
  if (flag('gif')) {
    const src = 'out/export-src.mp4';
    await run('capture.mjs', ['--video', '--no-audio', '--out', src, ...(opt('fps') ? ['--fps', opt('fps')] : [])], FILM);
    const gif = out ?? 'out/export.gif';
    await ffmpeg([
      '-loglevel', 'error', '-y',
      '-i', path.join(FILM, src),
      '-vf', 'fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse',
      '-loop', '0',
      path.join(FILM, gif),
    ]);
    fs.rmSync(path.join(FILM, src), { force: true });
    console.log(gif);
    return;
  }
  const quality = opt('quality', 'high');
  const crf = { high: 18, medium: 23, low: 28 }[quality] ?? 18;
  const height = opt('height', '');
  await run(
    'capture.mjs',
    [
      '--video',
      '--out', out ?? (flag('gif') ? 'out/export.gif' : 'out/export.mp4'),
      ...(opt('fps') ? ['--fps', opt('fps')] : []),
      ...(height ? ['--out-height', height] : []),
      '--crf', String(crf),
    ],
    FILM,
  );
}

const commands = {
  init,
  validate,
  render,
  export: exportVideo,
};

if (!cmd || !commands[cmd]) {
  console.error('usage: dsh-motion <init|validate|render|export> [options]');
  console.error('');
  console.error('  init      [--title "…"] [--length 6]');
  console.error('  validate  check the timeline and every scene it names');
  console.error('  render    [--stills 0,3,6] | [--video] [--out path] [--cols 3]');
  console.error('  export    [--gif] [--out path] [--fps 30] [--height 720|1080] [--quality high|medium|low]');
  process.exit(cmd ? 1 : 0);
}

try {
  await commands[cmd]();
} catch (error) {
  fail(String(error?.message ?? error));
}
