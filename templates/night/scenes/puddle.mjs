// Shot 2 — down in the water. Same painting, window cropped to the big puddle
// and drifting left; the rain is bigger because the ground is closer.
import { drawView } from './_night.mjs';

export const id = 'puddle';
export const slots = {};
export const textUsage = {};

const SHOT = { rainScale: 1.6, ripples: true, cup: null };

let ctx;

export function mount(context) {
  ctx = context;
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  // framed on the light pool, where the water actually shows something
  const drift = 0.05 * (t / 7);
  drawView(ctx, g, w, h, { x: 0.62 - 0.3 - drift, y: 0.86 - 0.3, w: 0.6, h: 0.6 }, SHOT, t);
}
