// 第三镜：液面（横移、微距）
//
// 物：茶汤表面 + 一片茶叶 + 结出来的那层薄皮。
// 动作：叶子翻面沉下去；薄皮从盏壁往盏心爬。
// 镜头 2.55 → 2.72 向左横移 34px——和上一镜的"推"换一种动作，观众才知道换镜了。

import { view, makePaperBits } from './_plate.mjs';
import { world, heatAt, filmAt, leafAt } from './_cup.mjs';

export const id = 'surface';
export const kind = 'canvas2d';
export const slots = {};

let ctx;
let bits;

export function mount(context) {
  ctx = context;
  bits = makePaperBits(ctx.rng('paper'));
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const gt = ctx.sceneStart + t;
  const u = t / 2.4;
  const s = 2.42 * Math.pow(2.62 / 2.42, u);
  const V = view(s, 1140 - 30 * u, 492 + 6 * u, ctx.width, ctx.height);
  world(g, V, {
    W: ctx.width,
    H: ctx.height,
    t,
    gt,
    heat: heatAt(gt),
    film: filmAt(gt),
    leaf: leafAt(gt),
    bits,
  });
}
