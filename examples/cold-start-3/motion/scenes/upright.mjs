import { drawScene, palette, camUpright, makeMotes } from './_engrave.mjs';

export const id = 'upright';
export const slots = {};

let ctx;
let P;
let motes;

export function mount(context) {
  ctx = context;
  P = palette(context);
  motes = makeMotes(context.rng('motes'));
}

export function render(t) {
  drawScene(ctx, P, { s: ctx.sceneStart + t, cam: camUpright(t), motes, companion: false, ghosts: true });
}
