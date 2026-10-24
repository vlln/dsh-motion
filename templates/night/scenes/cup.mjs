// Shot 3 — the cup comes to rest against the kerb. Window on it, pushing in,
// then holding: the film ends on an object.
import { getPlate, drawView } from './_night.mjs';

export const id = 'cup';
export const slots = {};
export const textUsage = {};

const SHOT = { rainScale: 2.4, ripples: false, cup: { x: 0.6, y: 0.88, travel: 0.06, scale: 1.2 } };

let ctx;
let plate = null;

export function mount(context) {
  ctx = context;
  plate = getPlate(ctx);
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  // 1.0 -> 0.62 of the opening window, eased out, then still
  const p = Math.min(1, t / 4.5);
  const z = 0.86 - 0.16 * (1 - (1 - p) ** 2);
  // window centred on the cup, which sits at (0.30, 0.86) of the painting
  drawView(ctx, g, w, h, plate, { x: 0.6 - z * 0.5, y: 0.74 - z * 0.5, w: z, h: z }, SHOT, t);
}
