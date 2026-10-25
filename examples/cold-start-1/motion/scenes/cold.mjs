// 第四镜：凉（拉）
//
// 物：先是桌上的整只茶盏，然后整张印张（版痕、纸边、版下那三个字）。
// 动作：最后一缕蒸汽断掉；镜头一口气拉出版外，字印到底边的窄带里。
// 这一镜的任务只有一个：让观众发现自己在看的是一张印出来的纸。

import { view, makePaperBits, C, colophonRule } from './_plate.mjs';
import { world, heatAt, filmAt, leafAt } from './_cup.mjs';

export const id = 'cold';
export const kind = 'canvas2d';
export const slots = {
  colophon: { default: '茶凉了', role: 'title', maxChars: 8 },
};
export const textUsage = { colophon: 1 };

let ctx;
let bits;

export function mount(context) {
  ctx = context;
  bits = makePaperBits(ctx.rng('paper'));
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const gt = ctx.sceneStart + t;
  const u = t / 2.6;
  // 拉：从上一镜的收尾（2.72）退到整张纸（1.00），等比走
  const s = 2.62 * Math.pow(1.0 / 2.62, Math.pow(u, 0.9));
  const cx = 1110 + (960 - 1110) * u;
  const cy = 498 + (540 - 498) * u;
  const V = view(s, cx, cy, ctx.width, ctx.height);

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

  // 版下的窄边：一道细横线 + 三个字。拉得够开才印上去（印刷的最后一道工序）
  const ink = Math.min(1, Math.max(0, (gt - 9.35) / 0.55));
  if (ink > 0.02) {
    colophonRule(g, V);
    ctx.drawText('colophon', {
      x: V.x(130),
      w: V.dx(1660),
      y: V.y(944),
      size: 42,
      weight: 500,
      family: 'serif',
      align: 'center',
      letterSpacing: 15,
      color: C.ink,
      alpha: ink * 0.92,
    });
  }
}
