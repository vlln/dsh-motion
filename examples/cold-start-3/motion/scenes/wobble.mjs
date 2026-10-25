import { drawScene, palette, camWobble, makeMotes } from './_engrave.mjs';

export const id = 'wobble';
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
  drawScene(ctx, P, { s: ctx.sceneStart + t, cam: camWobble(t), motes, companion: true, ghosts: true });
}
