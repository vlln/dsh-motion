// Page entry: fetch the timeline, build the kernel, expose window.__MOTION__.
// Used by both the capture script and (later) the preview panel.

import { createKernel } from './kernel.mjs';
import { assertTimeline } from './validate.mjs';
import { modules } from './scenes/index.mjs';

const canvas = document.getElementById('stage');
const timeline = await (await fetch('../timeline.json')).json();

// Optional: beat grid produced by scripts/beats.mjs (the page still renders without it).
try {
  const res = await fetch('../out/beats.json');
  if (res.ok) timeline.beats = await res.json();
} catch {}

assertTimeline(timeline, modules);
const kernel = createKernel({ timeline, modules });

await kernel.mountAll(canvas, {
  width: timeline.width ?? 1920,
  height: timeline.height ?? 1080,
  dpr: window.devicePixelRatio || 1,
});

window.__MOTION__ = {
  ready: true,
  timeline,
  kernel,
  renderAt: (t) => kernel.renderAt(t),
  setText: (scene, slot, value) => kernel.setText(scene, slot, value),
  setPalette: (patch) => kernel.setPalette(patch),
  setOverride: (scene, el, patch) => kernel.setOverride(scene, el, patch),
  describe: () => kernel.describe(),
  textUsage: (scene, t) => kernel.textUsage(scene, t),
  pick: (x, y, t) => kernel.pick(x, y, t),
  /** Sample a pixel in CSS coordinates (used by gates). */
  pixel(x, y) {
    const g = kernel.surface;
    const d = g.getImageData(Math.round(x * (window.devicePixelRatio || 1)), Math.round(y * (window.devicePixelRatio || 1)), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  },
  /** Screenshot is done by Playwright; the kernel just needs a deterministic frame. */
  warnings: () => kernel.warnings,
};

kernel.renderAt(0);
