// 第二镜：蒸汽（缓推）
//
// 物：盏口升起的五缕蒸汽。
// 动作：一缕一缕变细、断开、消失（heat 在 11.4 秒里从 1 掉到 0）。
// 镜头缓推 1.62 → 1.86：把观众的注意力从"一整只盏"收到"盏口那几根线"。

import { view, makePaperBits } from './_plate.mjs';
import { world, heatAt, filmAt, leafAt } from './_cup.mjs';

export const id = 'steam';
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
  // 缓推：等比走，视觉速度才匀
  const u = t / 3.2;
  const s = 1.46 * Math.pow(1.72 / 1.46, u);
  const V = view(s, 1144, 436 - 30 * u, ctx.width, ctx.height);
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
