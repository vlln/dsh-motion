#!/usr/bin/env node
// dsh-motion — the library's command line. The agent works in its workspace:
// it writes motion/timeline.json and motion/scenes/*.mjs, then runs this.
//
// Every child process gets its temp directory inside the film, so nothing here
// writes outside the workspace: Chromium's profile and ffmpeg's scratch files
// land in motion/out/.tmp. That keeps the whole loop inside the sandbox.

import { spawn, spawnSync, execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateTimeline } from '../src/validate.mjs';
import { modules } from '../src/project.mjs';
import { createFilm } from '../src/film.mjs';
import { createVersion, listVersions, useVersion } from '../src/versions.mjs';
import { createFilmFromTemplate, listTemplates } from '../src/film.mjs';

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

async function version() {
  const title = opt('m', opt('message', ''));
  const out = createVersion(FILM, { title, author: opt('author', 'agent') });
  console.log(`${out.id} · ${out.title}`);
}

async function versions() {
  const rows = listVersions(FILM);
  if (!rows.length) {
    console.log('no versions yet — run: dsh-motion version -m "what changed"');
    return;
  }
  for (const row of rows) console.log(`${row.id.padEnd(4)} ${row.at.slice(0, 16).replace('T', ' ')}  ${row.author.padEnd(5)}  ${row.title}`);
}

async function use() {
  const id = argv[1];
  if (!id) fail('usage: dsh-motion use v3');
  const out = useVersion(FILM, id);
  console.log(`回到 ${out.restored} · ${out.title}`);
  console.log('reload the preview panel: scene code changed.');
}

/**
 * Read a reference video: frames at a fixed rate, one contact sheet, and the
 * cuts. The agent gets composition and rhythm as data, not "a video it cannot
 * watch". Stored inside the film, never next to it.
 */
async function frames() {
  const src = argv[1];
  if (!src) fail('usage: dsh-motion frames <video> [--fps 2] [--out out/ref] [--cols 4]');
  if (!fs.existsSync(path.join(FILM, 'timeline.json'))) fail('no film here — run: dsh-motion init or template');
  const source = path.resolve(src);
  if (!fs.existsSync(source)) fail(`no such file: ${src}`);
  const fps = Math.max(0.2, Math.min(10, Number(opt('fps', 2)) || 2));
  const cols = Math.max(2, Math.min(8, Number(opt('cols', 4)) || 4));
  const outDir = path.resolve(FILM, opt('out', 'out/ref'));
  if (!outDir.startsWith(FILM + path.sep)) fail('--out must stay inside the film');

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  const env = withFilm(FILM);
  const run = (args) =>
    execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });

  const probe = JSON.parse(
    execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-show_entries', 'stream=width,height', '-of', 'json', source],
      { env, encoding: 'utf8' },
    ),
  );
  const duration = Number(probe.format?.duration ?? 0);
  const stream = probe.streams?.[0] ?? {};

  run([
    '-i', source,
    '-vf', `fps=${fps},scale=480:-2`,
    '-q:v', '3',
    path.join(outDir, 'f%03d.jpg'),
  ]);
  const files = fs.readdirSync(outDir).filter((f) => /^f\d+\.jpg$/.test(f)).sort();
  const rows = Math.ceil(files.length / cols);

  run([
    '-i', source,
    '-vf', `fps=${fps},scale=320:-2,tile=${cols}x${rows}`,
    '-frames:v', '1',
    path.join(outDir, 'sheet.jpg'),
  ]);

  // Cuts: ffmpeg's scene score, printed by showinfo on stderr.
  const scan = spawnSync(
    'ffmpeg',
    ['-hide_banner', '-v', 'info', '-i', source, '-vf', "select='gt(scene,0.25)',showinfo", '-f', 'null', '-'],
    { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
  );
  const scanLog = `${scan.stdout ?? ''}\n${scan.stderr ?? ''}`;
  const cuts = [];
  for (const line of scanLog.split('\n')) {
    const at = /pts_time:([0-9.]+)/.exec(line);
    if (at) {
      const time = Number(at[1]);
      if (Number.isFinite(time) && !cuts.some((c) => Math.abs(c - time) < 0.08)) cuts.push(Number(time.toFixed(2)));
    }
  }

  const index = {
    source: path.relative(FILM, source),
    duration: Number(duration.toFixed(2)),
    size: stream.width ? `${stream.width}x${stream.height}` : null,
    fps,
    frames: files.length,
    sheet: path.relative(FILM, path.join(outDir, 'sheet.jpg')),
    cuts,
  };
  fs.writeFileSync(path.join(outDir, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
  console.log(`${index.frames} frames · ${index.size} · ${index.duration}s → ${path.relative(FILM, outDir)}`);
  console.log(`sheet: ${index.sheet}${cuts.length ? ` · cuts: ${cuts.join(', ')}` : ' · no hard cuts'}`);
}

/**
 * Start from one of the package's template films. The whole point of a template
 * is that the agent begins with a stage, not with an empty directory.
 */
async function template() {
  const id = argv[1];
  if (!id || id === 'list' || flag('list')) {
    for (const name of listTemplates()) console.log(name);
    return;
  }
  const { dir, film } = createFilmFromTemplate(process.cwd(), id);
  console.log(`motion/ ← template "${id}" · ${film.scenes.length} scene(s) · ${film.duration}s`);
  console.log(`  ${film.scenes.map((s) => s.id).join(', ')}  in ${path.relative(process.cwd(), dir)}`);
  console.log('next: dsh-motion validate && dsh-motion render --stills 0,3');
}

const commands = {
  init,
  template,
  frames,
  validate,
  render,
  export: exportVideo,
  version,
  versions,
  use,
};

if (!cmd || !commands[cmd]) {
  console.error('usage: dsh-motion <init|validate|render|export|template|frames|version|versions|use> [options]');
  console.error('');
  console.error('  init      [--title "…"] [--length 6]');
  console.error('  template list | template <id>   start a film from a template instead of blank');
  console.error('  frames <video> [--fps 2] [--cols 4]   frames + contact sheet + cuts into out/ref');
  console.error('  validate  check the timeline and every scene it names');
  console.error('  render    [--stills 0,3,6] | [--video] [--out path] [--cols 3]');
  console.error('  export    [--gif] [--out path] [--fps 30] [--height 720|1080] [--quality high|medium|low]');
  console.error('  version   -m "what changed"   save the film as a version the user can switch to');
  console.error('  versions                      list saved versions');
  console.error('  use v3                        restore a version (appends, never rewrites history)');
  process.exit(cmd ? 1 : 0);
}

try {
  await commands[cmd]();
} catch (error) {
  fail(String(error?.message ?? error));
}
