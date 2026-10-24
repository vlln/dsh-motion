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
import { filmFontOverrides, listFonts } from '../src/fonts.mjs';

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
  const from = opt('template');
  if (from !== undefined) {
    if (!from || from === 'list') {
      for (const name of listTemplates()) console.log(name);
      return;
    }
    const { dir, film } = createFilmFromTemplate(process.cwd(), from);
    console.log(`motion/ ← template "${from}" · ${film.scenes.length} scene(s) · ${film.duration}s`);
    console.log(`  ${film.scenes.map((x) => x.id).join(', ')}  in ${path.relative(process.cwd(), dir)}`);
    return;
  }
  const { dir } = createFilm(process.cwd(), { title: opt('title', 'Untitled'), length: Number(opt('length', 6)) });
  const plan = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'plan.md');
  if (fs.existsSync(plan)) fs.copyFileSync(plan, path.join(dir, 'PLAN.md'));
  console.log('motion/timeline.json');
  console.log('motion/PLAN.md');
  console.log('motion/scenes/blank.mjs');
  console.log('write PLAN.md first (seven sections), then replace the starter scene');
}

async function check() {
  if (flag('perf')) {
    await run('perf.mjs', ['--budget', String(opt('budget', 33)), ...(flag('strict') ? ['--strict'] : [])], FILM);
    return;
  }
  await validate();
  if (flag('fast')) return;
  // Stills look fine while playback stutters, so the default check measures too.
  // Loud, not fatal: a heavy scene is a fix, not an invalid film.
  try {
    await run('perf.mjs', ['--budget', String(opt('budget', 33)), ...(flag('strict') ? ['--strict'] : [])], FILM);
  } catch {
    if (flag('strict')) process.exit(1);
  }
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
  if (flag('export')) return exportVideo();
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
  const sub = argv[1];
  if (sub === 'list') return versions();
  if (sub === 'use') {
    if (!argv[2]) fail('usage: dsh-motion version use v3');
    return use(argv[2]);
  }
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

async function use(id = argv[1]) {
  if (!id) fail('usage: dsh-motion version use v3');
  const out = useVersion(FILM, id);
  console.log(`回到 ${out.restored} · ${out.title}`);
  console.log('reload the preview panel: scene code changed.');
}

/**
 * Read a reference video into the film: frames, a contact sheet, and the cuts.
 * The agent gets composition and rhythm as data, not "a video it cannot watch".
 */
function readVideo(source, { fps = 2, cols = 4, outDir } = {}) {
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

  run(['-i', source, '-vf', `fps=${fps},scale=480:-2`, '-q:v', '3', path.join(outDir, 'f%03d.jpg')]);
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
  return index;
}

function refDir(name) {
  return path.resolve(FILM, name);
}

function frames() {
  const src = argv[1];
  if (!src) fail('usage: dsh-motion frames <video> [--fps 2] [--out out/ref] [--cols 4]');
  if (!fs.existsSync(path.join(FILM, 'timeline.json'))) fail('no film here — run: dsh-motion init or template');
  const source = path.resolve(src);
  if (!fs.existsSync(source)) fail(`no such file: ${src}`);
  const fps = Math.max(0.2, Math.min(10, Number(opt('fps', 2)) || 2));
  const cols = Math.max(2, Math.min(8, Number(opt('cols', 4)) || 4));
  const outDir = refDir(opt('out', 'out/ref'));
  if (!outDir.startsWith(FILM + path.sep)) fail('--out must stay inside the film');

  const index = readVideo(source, { fps, cols, outDir });
  console.log(`${index.frames} frames · ${index.size} · ${index.duration}s → ${path.relative(FILM, outDir)}`);
  console.log(`sheet: ${index.sheet}${index.cuts.length ? ` · cuts: ${index.cuts.join(', ')}` : ' · no hard cuts'}`);
}

/**
 * Turn the reference's cuts into a shot list: segments between cuts, short ones
 * merged, long ones split, each with a start, a length and a scene slot. With
 * --write the film's timeline is rebuilt from it.
 */
async function storyboard() {
  const src = argv[1];
  const refFile = path.join(FILM, 'out/ref/index.json');
  let index;
  if (src && fs.existsSync(path.resolve(src))) {
    index = readVideo(path.resolve(src), { fps: Number(opt('fps', 2)) || 2, cols: 4, outDir: refDir('out/ref') });
  } else if (fs.existsSync(refFile)) {
    index = JSON.parse(fs.readFileSync(refFile, 'utf8'));
  } else {
    fail('usage: dsh-motion storyboard <video> | storyboard (after frames/reference)');
  }

  const min = Math.max(0.4, Number(opt('min', 1.2)) || 1.2);
  const max = Math.max(min, Number(opt('max', 8)) || 8);
  const cuts = (index.cuts ?? []).filter((c) => c > 0.05 && c < index.duration - 0.05);
  const bounds = [0, ...cuts, index.duration];

  const raw = [];
  for (let i = 0; i < bounds.length - 1; i++) raw.push([bounds[i], bounds[i + 1] - bounds[i]]);
  const merged = [];
  for (const [start, length] of raw) {
    const last = merged[merged.length - 1];
    if (last && (last.length < min || length < min)) {
      last.length += length;
    } else {
      merged.push({ start, length });
    }
  }
  const shots = [];
  for (const shot of merged) {
    const parts = Math.max(1, Math.ceil(shot.length / max));
    const each = shot.length / parts;
    for (let i = 0; i < parts; i++) shots.push({ start: shot.start + i * each, length: each });
  }

  const sceneId = JSON.parse(fs.readFileSync(path.join(FILM, 'timeline.json'), 'utf8')).scenes[0]?.id;
  const beats = shots.map((shot, i) => ({
    index: i + 1,
    name: `Beat ${String(i + 1).padStart(2, '0')}`,
    start: Number(shot.start.toFixed(2)),
    length: Number(shot.length.toFixed(2)),
    source: `out/ref/f${String(Math.min(index.frames, Math.round(shot.start * index.fps) + 1)).padStart(3, '0')}.jpg`,
  }));

  const story = {
    duration: index.duration,
    cuts,
    scene: sceneId,
    beats,
    note: 'lengths come from the reference cuts; motion and easing still have to be written',
  };
  fs.mkdirSync(refDir('out/ref'), { recursive: true });
  fs.writeFileSync(path.join(refDir('out/ref'), 'storyboard.json'), `${JSON.stringify(story, null, 2)}\n`);

  for (const beat of beats) {
    console.log(`${String(beat.index).padStart(2)}  ${beat.start.toFixed(2)}s +${beat.length.toFixed(2)}s  ${beat.source}`);
  }

  if (flag('write')) {
    const file = path.join(FILM, 'timeline.json');
    const timeline = JSON.parse(fs.readFileSync(file, 'utf8'));
    const sourceScene = path.join(FILM, 'scenes', `${sceneId}.mjs`);
    if (!fs.existsSync(sourceScene)) {
      fail(
        `scene "${sceneId}" is built in: copy it into motion/scenes/ first, then run storyboard --write again`,
      );
    }
    // One scene file per beat, each with its own id: the film can't repeat one id.
    const body = fs.readFileSync(sourceScene, 'utf8');
    const ids = beats.map((beat, i) => {
      const id = `beat${String(i + 1).padStart(2, '0')}`;
      const copy = body.replace(/export const id = '[^']+';/, `export const id = '${id}';`);
      fs.writeFileSync(path.join(FILM, 'scenes', `${id}.mjs`), copy);
      return id;
    });
    timeline.duration = Number(index.duration.toFixed(2));
    timeline.scenes = beats.map((beat, i) => ({
      id: ids[i],
      name: beat.name,
      start: beat.start,
      length: beat.length,
      palette: timeline.scenes[0]?.palette ?? 'main',
      speed: 1,
    }));
    fs.writeFileSync(file, `${JSON.stringify(timeline, null, 2)}\n`);
    await validate();

    // One still per beat, so the shot list is something you can look at.
    if (!flag('no-stills')) {
      const mids = beats.map((beat) => (beat.start + beat.length / 2).toFixed(2));
      await run(
        'capture.mjs',
        ['--stills', mids.join(','), '--cols', String(Math.min(4, beats.length)), '--out', 'out/ref/beats.png'],
        FILM,
      );
      const framesDir = path.join(FILM, 'out/ref/beats-frames');
      const stillsDir = path.join(FILM, 'out/ref/beats');
      fs.rmSync(stillsDir, { recursive: true, force: true });
      fs.mkdirSync(stillsDir, { recursive: true });
      if (fs.existsSync(framesDir)) {
        const shots = fs.readdirSync(framesDir).filter((f) => /\.(png|jpg)$/i.test(f)).sort();
        shots.forEach((name, i) => {
          const target = `beat${String(i + 1).padStart(2, '0')}${path.extname(name)}`;
          fs.copyFileSync(path.join(framesDir, name), path.join(stillsDir, target));
          if (story.beats[i]) story.beats[i].still = `out/ref/beats/${target}`;
        });
        fs.rmSync(framesDir, { recursive: true, force: true });
      }
      fs.writeFileSync(path.join(refDir('out/ref'), 'storyboard.json'), `${JSON.stringify(story, null, 2)}\n`);
      console.log(`stills: ${story.beats.filter((b) => b.still).length} in out/ref/beats/ · sheet out/ref/beats.png`);
    }
  }
  console.log('storyboard: motion/out/ref/storyboard.json');
}

/**
 * One command for the reference-first loop: start the film from a template, read
 * the reference into out/ref, and write a brief the agent can work from.
 */
async function reference() {
  if (flag('shots')) return storyboard();
  const src = argv[1];
  if (!src) fail('usage: dsh-motion reference <video> [--template kinetic] [--fps 2]');
  const source = path.resolve(src);
  if (!fs.existsSync(source)) fail(`no such file: ${src}`);
  const templateId = opt('template', 'kinetic');
  const fps = Math.max(0.2, Math.min(10, Number(opt('fps', 2)) || 2));

  let created = null;
  if (!fs.existsSync(path.join(FILM, 'timeline.json'))) {
    created = createFilmFromTemplate(process.cwd(), templateId);
  }
  const film = JSON.parse(fs.readFileSync(path.join(FILM, 'timeline.json'), 'utf8'));
  const index = readVideo(source, { fps, cols: 4, outDir: refDir('out/ref') });
  const brief = {
    template: created ? templateId : null,
    film: {
      width: film.width,
      height: film.height,
      duration: film.duration,
      scenes: film.scenes.map((s) => s.id),
    },
    reference: index,
    next: [
      'compare the sheet with motion/out/ref/sheet.jpg',
      'pick one beat from cuts and rebuild it on the template scene',
      'dsh-motion validate && dsh-motion render --stills 0,2,4',
      'dsh-motion version -m "what changed"',
    ],
  };
  fs.writeFileSync(path.join(refDir('out/ref'), 'brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
  console.log(
    `${created ? `film ← template "${templateId}"` : 'film kept'} · ${index.frames} frames · ${index.cuts.length} cuts`,
  );
  console.log(`brief: motion/out/ref/brief.json`);
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

/** The four type roles a film may use. Printed so nobody goes looking for fonts. */
async function fonts() {
  for (const font of listFonts()) {
    console.log(`${font.key.padEnd(8)} ${font.note}`);
    console.log(`         ${font.stack}`);
  }
  const file = path.join(FILM, 'timeline.json');
  if (!fs.existsSync(file)) return;
  const overrides = filmFontOverrides(JSON.parse(fs.readFileSync(file, 'utf8')));
  for (const [role, spec] of overrides) {
    const local = spec.src ? path.join(FILM, spec.src) : null;
    const state = local ? (fs.existsSync(local) ? 'ok' : 'MISSING') : 'system';
    console.log(`film     ${role} → ${spec.family ?? role}${spec.src ? ` (${spec.src}, ${state})` : ''}`);
  }
}

// check --perf is the same verb, a different question.

const commands = {
  init,       // start a film (blank or from a template)
  reference,  // read a reference video into the film
  check,      // does the film hold together
  render,     // stills, video, export
  version,    // save / list / use
};

if (!cmd || !commands[cmd]) {
  console.error('usage: dsh-motion <init|reference|check|render|version> [options]');
  console.error('');
  console.error('  init      [--title "…"] [--length 6] | [--template <id>]  (--template list prints them)');
  console.error('  reference <video> [--template id] [--fps 2] [--cols 4]    frames, cuts, shot list into out/ref');
  console.error('  check [--fast] [--strict] [--budget 33]               the timeline, then each scene\'s frame cost');
  console.error('  render    [--stills 0,3,6] | [--video] [--export] [--out path] [--cols 3]');
  console.error('  version   -m "what changed" | version list | version use v3');
  process.exit(cmd ? 1 : 0);
}

try {
  await commands[cmd]();
} catch (error) {
  fail(String(error?.message ?? error));
}
