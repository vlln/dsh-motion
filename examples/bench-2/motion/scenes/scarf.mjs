// 第四镜 · 风停
//
// 物：肩、大衣的一大块暗面、一条搭在肩上的围巾。
// 动作：围巾从横着绷直的状态松掉，摆两下，落回肩上；一点纸屑慢慢飘下去。
// 机位：肩部特写（脖子以上裁在画外），缓拉 1.06→1.00。光从左边那扇刚开的门里来。

import {
  W, H, C, mulberry32, clamp01, smooth, lerp,
  stillAt, plate, paperEdge, makeGlow, blit, fillPoly,
} from './_print.mjs';
import { ribbon, tailPts } from './_figures.mjs';

export const id = 'scarf';
export const slots = {};

// 大衣的肩线：从画面左下升到右上
const COAT = [
  [0, 1080],
  [260, 972],
  [560, 902],
  [860, 842],
  [1140, 772],
  [1360, 682],
  [1520, 562],
  [1634, 452],
  [1742, 424],
  [1822, 524],
  [1884, 724],
  [1920, 904],
  [1920, 1080],
];
const NECK = [
  [1622, 462],
  [1698, 300],
  [1812, 330],
  [1748, 478],
];
const HEAD = [1858, 186, 176];
const BUN = [1924, 96, 112];

let ctx;
let base;
let doorGlow;
let specks;

export function mount(context) {
  ctx = context;
  const rng = mulberry32(808);
  specks = Array.from({ length: 7 }, () => ({
    x: 700 + rng() * 900,
    y: -80 + rng() * 800,
    v: 35 + rng() * 70,
    s: 2 + rng() * 5,
    a: 0.18 + rng() * 0.3,
    t0: rng() * 1.5,
    amber: rng() < 0.4,
  }));
  doorGlow = makeGlow({ w: 340, h: 1100, step: 12, hotR: 0, power: 1.15, seed: 71 });
  base = stillAt(ctx, 1.22, drawBg);
}

function drawBg(g) {
  g.fillStyle = '#17120f';
  g.fillRect(0, 0, W, H);
  // 车体：比大衣亮一档的暗面，几道竖缝
  g.fillStyle = '#2a221d';
  g.fillRect(250, 0, W - 250, H);
  g.fillStyle = '#1d1714';
  for (let x = 320; x < W; x += 244) g.fillRect(x, 0, 4, H);
  g.fillStyle = '#1d1714';
  g.fillRect(250, 128, W - 250, 5);
  g.fillRect(250, 806, W - 250, 5);
  // 墙上的瓷砖缝：很淡
  g.strokeStyle = '#33291f';
  g.lineWidth = 2;
  for (let y = 40; y < H; y += 132) {
    g.beginPath();
    g.moveTo(250, y);
    g.lineTo(W, y);
    g.stroke();
  }
  // 门框：左边那扇刚开的门
  g.fillStyle = C.ink;
  g.fillRect(66, 0, 270, H);
  g.fillStyle = '#241d1a';
  g.fillRect(66, 0, 22, H);
  g.fillRect(314, 0, 26, H);
  g.fillStyle = C.boneDim;
  g.fillRect(88, 0, 3, H);
  g.fillRect(311, 0, 3, H);
  g.fillStyle = C.red;
  g.fillRect(96, 0, 9, H);
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const z = lerp(1.06, 1.0, smooth(t / 2.0));
  plate(g, base, { z, cx: 1100, cy: 640 });

  // --- 门里的光：亮一下（提示音），然后慢慢收 ---
  const pulse = smooth(t / 0.3) * (1 - smooth((t - 0.55) / 1.35));
  blit(g, doorGlow, 210, 540, 1, 0.46 + 0.32 * pulse);
  g.save();
  g.globalAlpha = 0.3 + 0.5 * (0.55 + 0.45 * pulse);
  g.fillStyle = C.amber;
  g.fillRect(140, 54, 132, H - 108);
  g.restore();
  g.fillStyle = C.bone;
  g.fillRect(190, 40, 12, H - 80);
  g.save();
  g.globalAlpha = 0.55;
  g.fillStyle = C.boneDim;
  g.fillRect(202, 40, 4, H - 80);
  g.restore();
  // 门框边上被光照到的一线
  g.save();
  g.globalAlpha = 0.75;
  g.fillStyle = C.amberDim;
  g.fillRect(314, 0, 6, H);
  g.restore();

  // --- 人：肩、脖子、后脑（裁在画外） ---
  const bob = 1.5 * Math.sin(t * 2.2 + 0.4);
  g.save();
  g.translate(0, bob);

  // 骨白版：整体偏 (-7,-4)，压完墨只剩左上一线
  g.save();
  g.translate(-7, -4);
  fillPoly(g, COAT, C.bone, { amp: 3.2, seed: 23 });
  fillPoly(g, NECK, C.bone, { amp: 2, seed: 24 });
  g.beginPath();
  g.arc(HEAD[0], HEAD[1], HEAD[2], 0, Math.PI * 2);
  g.fillStyle = C.bone;
  g.fill();
  g.beginPath();
  g.arc(BUN[0], BUN[1], BUN[2], 0, Math.PI * 2);
  g.fill();
  g.restore();

  fillPoly(g, COAT, '#100d0b', { amp: 0, seed: 23 });
  fillPoly(g, NECK, '#151110', { amp: 0, seed: 24 });
  g.beginPath();
  g.arc(HEAD[0], HEAD[1], HEAD[2], 0, Math.PI * 2);
  g.fillStyle = '#141010';
  g.fill();
  g.beginPath();
  g.arc(BUN[0], BUN[1], BUN[2], 0, Math.PI * 2);
  g.fillStyle = '#0d0b0a';
  g.fill();
  // 发髻上的一道钠光
  g.beginPath();
  g.arc(BUN[0] - 20, BUN[1] - 20, BUN[2] * 0.7, Math.PI * 0.85, Math.PI * 1.5);
  g.strokeStyle = C.amberDim;
  g.lineWidth = 10;
  g.stroke();

  // 衣领：比大衣亮一档的一条带子，压出肩颈
  const collar = [
    [1500, 590],
    [1580, 500],
    [1660, 438],
    [1750, 430],
    [1772, 500],
    [1690, 548],
    [1610, 610],
  ];
  fillPoly(g, collar, '#1c1613', { amp: 2, seed: 31 });
  g.strokeStyle = C.boneDim;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(1500, 590);
  g.lineTo(1580, 500);
  g.lineTo(1660, 438);
  g.lineTo(1750, 430);
  g.stroke();
  // 大衣的缝线
  g.strokeStyle = '#241d19';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(1050, 800);
  g.quadraticCurveTo(1180, 930, 1240, 1080);
  g.stroke();
  // 肩线上一道钠黄：门光擦过
  g.strokeStyle = C.amber;
  g.lineWidth = 9;
  g.beginPath();
  g.moveTo(600, 900);
  g.quadraticCurveTo(1100, 800, 1520, 566);
  g.stroke();

  // --- 围巾：搭在肩上，尾端从横着绷直 → 摆两下 → 落下 ---
  const drape = [
    [1920, 300],
    [1850, 336],
    [1780, 372],
    [1712, 404],
  ];
  const fall = (target, delay, k, w) => {
    const tt = Math.max(0, t - delay);
    const start = 0.04;
    return target + (start - target) * Math.exp(-k * tt) * Math.cos(w * tt);
  };
  const a1 = fall(1.06, 0.0, 3.15, 5.1) + 0.012 * Math.sin(t * 7.2) * Math.max(0, 1 - t);
  const tip = tailPts(1690, 432, a1, 700, { n: 28, sag: 34 * Math.max(0, a1) });

  // 黄版：偏 (5,-3)
  g.save();
  g.translate(5, -3);
  g.globalAlpha = 0.9;
  ribbon(g, drape, 104, 96, C.amberDim);
  ribbon(g, tip, 88, 28, C.amberDim);
  g.restore();
  // 骨白版
  ribbon(g, drape, 100, 92, C.bone);
  ribbon(g, tip, 84, 26, C.bone);
  // 围巾的折：一条黄的暗面
  const fold = tip.map(([x, y], i) => [x + 4, y + 18 - i * 0.22]);
  ribbon(g, fold.slice(3), 18, 8, C.amberDim, { alpha: 0.9 });
  const fold2 = drape.map(([x, y]) => [x - 4, y + 26]);
  ribbon(g, fold2, 14, 12, C.amberDim, { alpha: 0.8 });
  // 在脖子上绕的那一圈
  const knot = [
    [1612, 396],
    [1688, 360],
    [1768, 376],
    [1794, 436],
    [1738, 484],
    [1650, 486],
    [1600, 446],
  ];
  g.save();
  g.translate(5, -3);
  g.globalAlpha = 0.9;
  fillPoly(g, knot, C.amberDim, { amp: 3, seed: 7 });
  g.restore();
  fillPoly(g, knot, C.bone, { amp: 3, seed: 7 });

  g.restore();

  // --- 一点纸屑慢慢飘下去 ---
  for (const s of specks) {
    const age = t - s.t0;
    if (age <= 0) continue;
    const y = s.y + s.v * age;
    const x = s.x + 24 * Math.sin(age * 1.7 + s.x * 0.01);
    if (y > H + 40) continue;
    g.save();
    g.globalAlpha = s.a * clamp01(age / 0.3);
    g.fillStyle = s.amber ? C.amber : C.bone;
    g.beginPath();
    g.arc(x, y, s.s, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  paperEdge(g);
}
