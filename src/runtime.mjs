// Capture page entry (index.html): mount the kernel and expose a tiny API for the
// screenshot driver. The panel entry (preview.mjs) shares the same mount path.

import { mountMotion } from './mount.mjs';

const canvas = document.getElementById('stage');
const { timeline, kernel } = await mountMotion({ canvas });

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
  /** Sample a pixel in timeline coordinates (used by gates). */
  pixel(x, y) {
    const g = kernel.surface;
    const scale = g.canvas.width / timeline.width;
    const d = g.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  },
  warnings: () => kernel.warnings,
};

kernel.renderAt(0);
