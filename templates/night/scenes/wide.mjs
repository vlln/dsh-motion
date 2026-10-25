// Shot 1 — the whole lot. Slow push, nothing happens: the light is the only
// actor and it does nothing for seven seconds.
import { drawView } from './_night.mjs';

export const id = 'wide';
export const slots = {};
export const textUsage = {};

const SHOT = { rainScale: 1, ripples: false, cup: { x: 0.12, y: 0.88, travel: 0.34, scale: 0.7 } };

let ctx;

export function mount(context) {
  ctx = context;
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  const z = 0.035 * (t / 7);
  drawView(ctx, g, w, h, { x: z, y: z * 0.4, w: 1 - z * 2, h: 1 - z * 0.8 }, SHOT, t);
}
