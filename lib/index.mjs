// dsh-motion Node half: tools that drive the render kernel in this package.
// The browser half lives in client/ and is loaded through dsh.client.

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { validateTimeline } from '../src/validate.mjs';
import { list, reply, resolve } from '../src/comments.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMELINE = path.join(PKG_ROOT, 'timeline.json');

export const name = 'dsh-motion';
export const inject = ['tools'];

function runScript(script, args = []) {
  return new Promise((resolvePromise, reject) => {
    execFile(
      process.execPath,
      [path.join(PKG_ROOT, 'scripts', script), ...args],
      { cwd: PKG_ROOT, maxBuffer: 20 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) reject(new Error((stderr || stdout || err.message).trim()));
        else resolvePromise(stdout.trim());
      },
    );
  });
}

const readTimeline = () => JSON.parse(fs.readFileSync(TIMELINE, 'utf8'));

function writeTimeline(timeline) {
  const { ok, errors } = validateTimeline(timeline, null);
  if (!ok) throw new Error(`invalid timeline:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  fs.writeFileSync(TIMELINE, `${JSON.stringify(timeline, null, 2)}\n`);
}

const text = (value) => ({ schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] });

export function apply(ctx) {
  ctx.effect(() => {
    const disposers = [];

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_info',
          description:
            'Inspect the motion project: duration, fps, scenes and their start/length, text slots and palette tokens. Use before editing or rendering.',
          parameters: {},
          output: text('JSON'),
          execute: async () => {
            const timeline = readTimeline();
            const beatsFile = path.join(PKG_ROOT, 'out/beats.json');
            const beats = fs.existsSync(beatsFile) ? JSON.parse(fs.readFileSync(beatsFile, 'utf8')) : null;
            return JSON.stringify(
              {
                duration: timeline.duration,
                fps: timeline.fps,
                scenes: timeline.scenes,
                palettes: Object.keys(timeline.palettes ?? {}),
                beats: beats ? { bpm: beats.bpm, drop: beats.drop, count: beats.beats.length } : null,
              },
              null,
              2,
            );
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_texts',
          description:
            'Read or write a scene text slot (e.g. title, subtitle). Writing updates timeline.json, validates it, and takes effect on the next rendered frame without recompiling the scene.',
          parameters: {
            action: { type: 'string', required: true, description: 'get | set' },
            scene: { type: 'string', required: true },
            slot: { type: 'string', required: true },
            value: { type: 'string' },
          },
          output: text('value'),
          execute: async ({ action, scene, slot, value }) => {
            if (action === 'get') return runScript('texts.mjs', ['get', '--scene', scene, '--slot', slot]);
            if (action !== 'set') throw new Error('action must be get or set');
            if (value === undefined) throw new Error('set needs value');
            return runScript('texts.mjs', ['set', '--scene', scene, '--slot', slot, '--value', value]);
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_palette',
          description:
            'Change one color token. Without scene/element it edits the shared palette; with scene (and optionally element) it writes an override so a single element can differ (e.g. "make this bright red").',
          parameters: {
            token: { type: 'string', required: true, description: 'bg | fg | accent | muted | grid | panel' },
            value: { type: 'string', required: true, description: '#rrggbb' },
            palette: { type: 'string', description: 'palette name, default main' },
            scene: { type: 'string', description: 'write an override for this scene' },
            element: { type: 'string', description: 'override for one element of that scene' },
          },
          output: text('changed'),
          execute: async ({ token, value, palette, scene, element }) => {
            if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`not a hex color: ${value}`);
            const timeline = readTimeline();
            if (scene) {
              const key = element ? `${scene}/${element}` : scene;
              timeline.overrides ??= {};
              timeline.overrides[key] = { ...(timeline.overrides[key] ?? {}), [token]: value };
              writeTimeline(timeline);
              return `override ${key}.${token} = ${value}`;
            }
            const name = palette ?? 'main';
            timeline.palettes ??= {};
            timeline.palettes[name] = { ...(timeline.palettes[name] ?? {}), [token]: value };
            writeTimeline(timeline);
            return `${name}.${token} = ${value}`;
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_comments',
          description:
            'Work with viewer annotations anchored to {t, rect, elementId}. list returns open threads; reply and resolve act only on threads the viewer sent to Claude.',
          parameters: {
            action: { type: 'string', required: true, description: 'list | reply | resolve' },
            id: { type: 'string' },
            text: { type: 'string' },
          },
          output: text('JSON'),
          execute: async ({ action, id, text: body }) => {
            if (action === 'list') return JSON.stringify({ threads: list(PKG_ROOT) }, null, 2);
            if (action === 'reply') {
              if (!id || !body) throw new Error('reply needs id and text');
              return JSON.stringify(reply(PKG_ROOT, id, body), null, 2);
            }
            if (action === 'resolve') {
              if (!id) throw new Error('resolve needs id');
              return JSON.stringify(resolve(PKG_ROOT, id), null, 2);
            }
            throw new Error('action must be list, reply or resolve');
          },
        }),
      ),
    );

    disposers.push(
      ctx.tools.register(
        defineTool({
          name: 'motion_render',
          description:
            'Render the timeline with the local kernel. mode=stills writes a contact sheet (fast, for review); mode=video renders MP4 (with audio when timeline.audio is set). Requires node, ffmpeg and Playwright chromium on the host.',
          parameters: {
            mode: { type: 'string', required: true, description: 'stills | video' },
            out: { type: 'string', description: 'output path, default out/sheet.png or out/demo.mp4' },
            stills: { type: 'string', description: 'comma separated seconds for stills mode' },
            cols: { type: 'number', description: 'contact sheet columns, default 3' },
            fps: { type: 'number', description: 'video fps, default timeline fps' },
          },
          output: text('path'),
          execute: async ({ mode, out, stills, cols, fps }) => {
            if (mode === 'stills') {
              const times = stills ?? '0,3,6,9,12';
              return runScript('capture.mjs', [
                '--stills', times,
                '--cols', String(cols ?? 3),
                '--out', out ?? 'out/sheet.png',
              ]);
            }
            if (mode === 'video') {
              return runScript('capture.mjs', [
                '--video',
                ...(fps ? ['--fps', String(fps)] : []),
                '--out', out ?? 'out/demo.mp4',
              ]);
            }
            throw new Error('mode must be stills or video');
          },
        }),
      ),
    );

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, 'dsh-motion: tools');
}
