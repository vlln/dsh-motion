// One mount path for both entries (capture page and panel): fetch timeline,
// attach beats, load the scenes the timeline names, validate, mount the kernel.

import { createKernel } from './kernel.mjs';
import { loadFilmFonts } from './fonts.mjs';
import { assertTimeline } from './validate.mjs';
import { loadModules } from './scenes/index.mjs';

export async function mountMotion({ canvas, width, height, dpr = window.devicePixelRatio || 1, scale = 1, base = null }) {
  // Where the film lives. The panel passes a published version (see /api/version),
  // so everything — timeline, scenes, beats, fonts — resolves against one base
  // instead of against the page, which sits at the workspace root.
  // Optional ?timeline= for tests/fixtures. Only same-origin relative paths are
  // accepted: the panel is embedded in the host UI and must not become a fetcher.
  const requested = new URLSearchParams(location.search).get('timeline');
  const filmBase = base ? new URL(base, location.href) : new URL('./', location.href);
  const src = requested && /^(\.\/|\/plugins\/dsh-motion\/)/.test(requested) ? requested : new URL('timeline.json', filmBase).href;
  // The panel is mounted at the film's own directory, so a missing timeline is
  // an empty workspace, not a broken link.
  const res = await fetch(src, { cache: 'no-store' });
  if (!res.ok) {
    if (res.status === 404) throw Object.assign(new Error('no film in this workspace'), { code: 'NO_FILM' });
    throw new Error(`timeline: HTTP ${res.status}`);
  }
  const timeline = await res.json();

  try {
    const res = await fetch(new URL('out/beats.json', filmBase), { cache: 'no-store' });
    if (res.ok) timeline.beats = await res.json();
  } catch {
    /* the page renders without a beat grid */
  }

  // Absolute, because a dynamic import resolves against the importing module
  // (src/mount.mjs in dev, app.js in the built panel), not the page.
  const scenesBase = new URL('scenes/', filmBase).href;
  const modules = await loadModules(timeline.scenes.map((s) => s.id), scenesBase);
  assertTimeline(timeline, modules);
  await loadFilmFonts(timeline, base ?? './');

  const kernel = createKernel({ timeline, modules });
  await kernel.mountAll(canvas, {
    scale,
    width: width ?? timeline.width,
    height: height ?? timeline.height,
    dpr,
  });

  return { timeline, kernel, modules };
}
