// One mount path for both entries (capture page and panel): fetch timeline,
// attach beats, load the scenes the timeline names, validate, mount the kernel.

import { createKernel } from './kernel.mjs';
import { assertTimeline } from './validate.mjs';
import { loadModules } from './scenes/index.mjs';

export async function mountMotion({ canvas, width, height, dpr = window.devicePixelRatio || 1 }) {
  const timeline = await (await fetch('./timeline.json')).json();

  try {
    const res = await fetch('./out/beats.json');
    if (res.ok) timeline.beats = await res.json();
  } catch {
    /* the page renders without a beat grid */
  }

  const modules = await loadModules(timeline.scenes.map((s) => s.id));
  assertTimeline(timeline, modules);

  const kernel = createKernel({ timeline, modules });
  await kernel.mountAll(canvas, {
    width: width ?? timeline.width,
    height: height ?? timeline.height,
    dpr,
  });

  return { timeline, kernel, modules };
}
