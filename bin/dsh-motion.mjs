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
import { createVersion, listVersions, useVersion } from '../src/versions.mjs';
import { scaffoldFilm } from '../src/film.mjs';
import { pathToFileURL } from 'node:url';
import { sheetFor } from '../src/audio.mjs';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const cmd = argv[0];

const opt = (name, fallback) => {
  // Both spellings, because the manual taught `-m` for a year and a half of the
  // CLI only looked for `--m`: the flag was silently dropped and the version
  // title came out empty.
  const long = argv.indexOf(`--${name}`);
  const short = name.length === 1 ? argv.indexOf(`-${name}`) : -1;
  const i = long === -1 ? short : long;
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

/**
 * Start a film: a timeline with no shots, an empty storyboard, and a copy of
 * the kit. No look — a starter style becomes the film whether or not it fits
 * the subject, which is why every film used to look like the last one.
 */
async function init() {
  const { dir, film } = scaffoldFilm(process.cwd(), { title: opt("title", "Untitled") });
  const rel = path.relative(process.cwd(), dir) || ".";
  console.log(`${rel}/timeline.json  · ${film.scenes.length} scene(s)`);
  console.log(`${rel}/镜头表.md     ← write this first: the look in three lines, then one row per shot`);
  console.log(`${rel}/kit/           ← samples you may copy, change or delete`);
  console.log("");
  console.log("next: 填镜头表 → 写 scenes/<id>.mjs（导出 mount/render）→ dsh-motion check");
}
async function check() {
  if (flag('deliver')) {
    await validate();
    return deliver();
  }
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
  // What the picture is made of, in numbers the agent can act on. Soft: a film
  // is allowed to be flat on purpose.
  try {
    await run('look.mjs', [], FILM);
  } catch {
    if (flag('strict')) process.exit(1);
  }
}

/**
 * The delivery check: facts about the rendered file.
 *
 * Everything asserted here can be proved without taste — there is a picture, a
 * sound, they are the film's length, the screen is never empty for long, the
 * picture is no slideshow, and it is not one blue-violet haze. Whether the film
 * is any good is the review step, not this.
 */
async function deliver() {
  const dir = path.join(FILM, 'out');
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((n) => n.endsWith('.mp4'))
        .map((n) => path.join(dir, n))
        .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    : [];
  const file = opt('file') ?? files[0];
  if (!file) fail('no film rendered yet — run: dsh-motion render --video');

  const timeline = JSON.parse(fs.readFileSync(path.join(FILM, 'timeline.json'), 'utf8'));
  const { inspect } = await import(pathToFileURL(path.join(PKG, 'scripts/film-gate.mjs')).href);
  const r = inspect(file);
  const red = [];
  const say = (ok, label, detail) => console.log(`${ok ? 'ok  ' : 'RED '} ${label}${detail ? `  — ${detail}` : ''}`);

  say(r.hasVideo, 'there is a picture', `${r.width}x${r.height} @ ${r.fps}`);
  if (!r.hasVideo) red.push('no video stream');

  say(r.hasAudio, 'there is a sound', r.audio ? `${r.audio.codec} ${r.audio.rate}Hz ${r.audio.channels}ch` : 'MISSING — no score: write motion/audio.json and run make-audio.mjs --write (howto/交付.md)');
  if (!r.hasAudio) red.push('no audio stream');

  const drift = Math.abs(r.duration - timeline.duration);
  say(drift < 0.5, 'it matches the timeline length', `${r.duration.toFixed(2)}s vs ${timeline.duration}s`);
  if (drift >= 0.5) red.push('duration does not match the timeline');

  say(r.blankRun <= 0.3, 'nothing goes blank for long', `longest empty run ${r.blankRun.toFixed(2)}s`);
  if (r.blankRun > 0.3) red.push('an empty screen for more than 0.3s');

  say(r.moved > 0.5, 'the picture moves', `${(r.moved * 100).toFixed(0)}% of frames differ`);
  if (r.moved <= 0.5) red.push('the film is a slideshow');
  if (r.frozenRun > 3) console.log(`note nothing moves for ${r.frozenRun.toFixed(1)}s — fine for a painted hold, not for a shot`);

  const purpleReason = opt('allow-blue-purple', '');
  if (r.purpleShare > 0.3 && !flag('allow-blue-purple')) {
    say(false, 'not one blue-violet haze', `${(r.purpleShare * 100).toFixed(0)}% of pixels`);
    red.push('blue-violet covers more than 30% of the film — pass --allow-blue-purple "reason" if the subject needs it');
  } else {
    say(true, 'not one blue-violet haze', `${(r.purpleShare * 100).toFixed(0)}% of pixels${purpleReason ? ` — allowed: ${purpleReason}` : ''}`);
  }

  if (red.length) fail(`not deliverable:\n  - ${red.join('\n  - ')}`);
  console.log(`ok · deliverable · ${path.relative(FILM, file)}`);
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
  // The score is two files and one line of JSON; drift between them is silent
  // until export. Catch it here, where a fix is cheap.
  const sheetFile = path.join(FILM, 'audio.json');
  if (fs.existsSync(sheetFile)) {
    try {
      sheetFor(JSON.parse(fs.readFileSync(sheetFile, 'utf8')), timeline.duration);
    } catch (err) {
      console.error(`invalid cue sheet (motion/audio.json): ${err.message}`);
      process.exit(1);
    }
  }
  for (const [role, spec] of Object.entries(timeline.fonts ?? {})) {
    if (spec?.src && !fs.existsSync(path.join(FILM, spec.src))) {
      console.error(`fonts.${role} points at a missing file: motion/${spec.src}`);
      process.exit(1);
    }
  }
  if (timeline.audio?.src && !fs.existsSync(path.join(FILM, timeline.audio.src))) {
    console.error(`timeline.audio.src is missing: motion/${timeline.audio.src}`);
    console.error('  run: node <skill>/scripts/make-audio.mjs --write');
    process.exit(1);
  }

  const seconds = timeline.scenes.reduce((sum, s) => sum + s.length, 0);
  const sound = timeline.audio?.src ? ` · audio ${timeline.audio.src}` : '';
  console.log(`ok · ${timeline.scenes.length} scene(s) · ${seconds}s · ${timeline.width}x${timeline.height} @ ${timeline.fps}fps${sound}`);
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
  const out = createVersion(FILM, { title });
  console.log(`${out.id} · ${out.title}`);
}

async function versions() {
  const rows = listVersions(FILM);
  if (!rows.length) {
    console.log('no versions yet — run: dsh-motion version -m "what changed"');
    return;
  }
  for (const row of rows) console.log(`${row.id.padEnd(4)} ${row.at.slice(0, 16).replace('T', ' ')}  ${row.title}`);
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
    // The reference gives rhythm, not shots: write the table the agent has to
    // fill in. Splitting a scene across beats is only possible once one exists.
    const rows = beats
      .map((beat) => `| ${beat.start.toFixed(2)}–${(beat.start + beat.length).toFixed(2)}s |  |  | 停 | — |  |`)
      .join("\n");
    fs.writeFileSync(
      path.join(refDir("out/ref"), "镜头表.md"),
      `# 从参考量出来的镜头表\n\n参考：${index.duration.toFixed(2)}s，${beats.length} 个节拍。\n\n| 时间段 | 画面里的物（名词） | 它在做什么（动词） | 镜头 | 屏上字 | 做法 |\n|---|---|---|---|---|---|\n${rows}\n\n把「物」和「动词」填上——填不出的那一行先别做。\n`,
    );
    const sourceScene = sceneId ? path.join(FILM, "scenes", `${sceneId}.mjs`) : null;
    if (!sourceScene || !fs.existsSync(sourceScene)) {
      console.log("shots: none in the film yet — wrote out/ref/镜头表.md");
      console.log("  fill the table, write scenes/<id>.mjs, run dsh-motion reference --shots --write again to split it per beat");
      return;
    }
    // One scene file per beat, each with its own id: the film can't repeat one id.
    const body = fs.readFileSync(sourceScene, 'utf8');
    const ids = beats.map((beat, i) => {
      const id = `beat${String(i + 1).padStart(2, '0')}`;
      const copy = body.replace(/export const id = ['"][^'"]+['"];/, `export const id = '${id}';`);
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
 * One command for the reference-first loop: read
 * the reference into out/ref, and write a brief the agent can work from.
 */
async function reference() {
  if (flag('shots')) return storyboard();
  const src = argv[1];
  if (!src) fail('usage: dsh-motion reference <video> [--fps 2]');
  const source = path.resolve(src);
  if (!fs.existsSync(source)) fail(`no such file: ${src}`);
  const fps = Math.max(0.2, Math.min(10, Number(opt('fps', 2)) || 2));

  if (!fs.existsSync(path.join(FILM, 'timeline.json'))) fail('no film here — run: dsh-motion init (the breakdown belongs to a film)');
  const film = JSON.parse(fs.readFileSync(path.join(FILM, 'timeline.json'), 'utf8'));
  const index = readVideo(source, { fps, cols: 4, outDir: refDir('out/ref') });
  const brief = {
    film: {
      width: film.width,
      height: film.height,
      duration: film.duration,
      scenes: film.scenes.map((s) => s.id),
    },
    reference: index,
    next: [
      'compare the sheet with motion/out/ref/sheet.jpg',
      'fill out/ref/镜头表.md: one row per beat, a thing and what it does',
      'dsh-motion validate && dsh-motion render --stills 0,2,4',
      'dsh-motion version -m "what changed"',
    ],
  };
  fs.writeFileSync(path.join(refDir('out/ref'), 'brief.json'), `${JSON.stringify(brief, null, 2)}\n`);
  console.log(
    `${index.frames} frames · ${index.cuts.length} cuts · film kept`,
  );
  console.log(`brief: motion/out/ref/brief.json`);
}

// check --perf is the same verb, a different question.

const commands = {
  init,       // start a film: an empty timeline, a storyboard and the kit
  reference,  // read a reference video into the film
  check,      // does the film hold together
  render,     // stills, video, export
  version,    // save / list / use
};

if (!cmd || !commands[cmd]) {
  // Name what was asked for: a retired verb then reads as a retired verb, not
  // as "the command printed usage for no reason".
  if (cmd) console.error(`unknown command "${cmd}" — there are five: ${Object.keys(commands).join(', ')}`);
  console.error('usage: dsh-motion <init|reference|check|render|version> [options]');
  console.error('');
  console.error('  init      [--title "…"]                      empty timeline + 镜头表 + kit');
  console.error('  reference <video> [--fps 2] [--cols 4]           frames, cuts, shot list into out/ref');
  console.error('  check [--fast] [--strict] [--budget 33]               the timeline, then each scene\'s frame cost');
  console.error('  check --deliver [file]                                facts about the rendered file');
  console.error('  render    [--stills 0,3,6] | [--video] [--export] [--out path] [--cols 3]');
  console.error('  version   -m "what changed" | version list | version use v3');
  process.exit(cmd ? 1 : 0);
}

try {
  await commands[cmd]();
} catch (error) {
  fail(String(error?.message ?? error));
}
