// 第一镜：放好的一盏茶（停）
//
// 物：茶盏 + 盏托 + 茶面最后一圈涟漪 + 蒸汽。
// 动作：涟漪在盏内收住，蒸汽立起来。
// 镜头不动——这一镜要让观众先看清"这是什么"，动了就看不清楚。

import { view, makePaperBits } from './_plate.mjs';
import { world, heatAt, filmAt, leafAt } from './_cup.mjs';

export const id = 'pour';
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
  const V = view(1.14, 958, 502, ctx.width, ctx.height);
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
