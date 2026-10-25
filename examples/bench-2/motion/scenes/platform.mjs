// 第一镜 · 站台
//
// 物：黄线、立柱、吊灯、一张传单、一个纸杯、远处站着的背影。
// 动作：风先到——传单抖角、翻面、贴着地滚向镜头；纸杯滚半步；大衣下摆开始拍。
// 机位：低，一点透视，不动（只有 0.4% 的呼吸）。这一镜要让观众先认出台阶、黄线、等车的人。

import { W, H, C, mulberry32, clamp01, smooth, stillAt, plate, paperEdge, makeGlow, blit, taper, fillPoly } from './_print.mjs';
import { standBack } from './_figures.mjs';
import { scrap } from './_print.mjs';

export const id = 'platform';
export const slots = {};

const VP = { x: 960, y: 545 };
const EDGE_X = 1420; // 站台边缘线在画面底边的 x
const YEL_X = 1265; // 黄线内边在画面底边的 x
const WALL_END = 820; // 左墙在屏幕上的尽头
const JUNC_Y = 790; // 墙脚线在左边缘的 y
const CORN_Y = -300; // 檐口线在左边缘的 y
const LAMP = { x: 1180, y: 74 };

let ctx;
let base;
let glow;
let pool;
let farGlow;
let wash;
let dust;

// 透视：near 点连到灭点
const toVP = (x0, y0, atX) => {
  const k = (atX - x0) / (VP.x - x0);
  return [atX, y0 + (VP.y - y0) * k];
};
const edgeAt = (y) => 960 + ((EDGE_X - 960) * (y - VP.y)) / (1080 - VP.y);

export function mount(context) {
  ctx = context;
  const rng = mulberry32(90210);
  dust = Array.from({ length: 52 }, () => ({
    x0: 250 + rng() * 2300,
    y: 540 + rng() * 490,
    len: 24 + rng() * 120,
    sp: 240 + rng() * 660,
    w: 1.4 + rng() * 4.2,
    a: 0.2 + rng() * 0.42,
    t0: 0.86 + rng() * 1.6,
    tilt: (rng() - 0.5) * 0.14,
    amber: rng() < 0.16,
  }));
  glow = makeGlow({ w: 460, h: 460, step: 10, angle: 0.3, hotR: 0.2, seed: 3 });
  farGlow = makeGlow({ w: 150, h: 150, step: 8, hotR: 0.2, seed: 5 });
  wash = makeGlow({ w: 760, h: 640, step: 11, angle: 0.3, hotR: 0, power: 1.0, seed: 13 });
  pool = makeGlow({ w: 1120, h: 500, step: 9, angle: 0.28, hotR: 0, power: 1.15, seed: 9 });
  base = stillAt(ctx, 1.25, drawBase);
}

function wallPath(g) {
  g.beginPath();
  g.moveTo(0, CORN_Y);
  for (let x = 20; x <= WALL_END; x += 20) {
    const p = toVP(0, CORN_Y, x);
    g.lineTo(p[0], p[1]);
  }
  const j = toVP(0, JUNC_Y, WALL_END);
  g.lineTo(WALL_END, j[1]);
  g.lineTo(0, JUNC_Y);
  g.closePath();
}

function drawBase(g) {
  g.fillStyle = C.ink;
  g.fillRect(0, 0, W, H);

  // --- 地面：地平线以下、黄线以左 ---
  fillPoly(g, [[0, VP.y], [VP.x, VP.y], [EDGE_X, H], [0, H]], C.structLite, { amp: 0 });

  const rowY = [];
  for (let n = 0; n < 13; n++) rowY.push(VP.y + (H - VP.y) * Math.pow(0.78, n));

  // 地砖：几块被踩亮的平涂一档
  for (let r = 2; r < rowY.length - 2; r += 2) {
    for (let c = 1; c < 6; c += 3) {
      const x1 = 80 + c * 235;
      const x2 = x1 + 235;
      fillPoly(g, [[x1, rowY[r]], [x2, rowY[r]], [x2, rowY[r + 1]], [x1, rowY[r + 1]]], '#382d24', { amp: 0 });
    }
  }
  // 地砖缝：横线 + 连到灭点的纵线
  g.strokeStyle = C.ink;
  g.lineWidth = 2.2;
  for (const y of rowY) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(edgeAt(y) - 8, y);
    g.stroke();
  }
  for (let i = -1; i < 8; i++) {
    const x = 80 + i * 235;
    g.beginPath();
    g.moveTo(x, H + 20);
    g.lineTo(VP.x, VP.y);
    g.stroke();
  }

  // 远处压一档：光打不到的地方是平的暗，不是渐变
  g.save();
  g.globalAlpha = 0.28;
  fillPoly(g, [[0, VP.y], [VP.x, VP.y], [edgeAt(742), 742], [0, 742]], C.ink, { amp: 0 });
  g.restore();

  // --- 黄线 ---
  fillPoly(g, [[YEL_X, H], [YEL_X + 5, H], [VP.x, VP.y], [EDGE_X - 34, H], [EDGE_X - 44, H]], C.amber, { amp: 0 });
  g.save();
  g.translate(5, -3);
  g.globalAlpha = 0.5;
  fillPoly(g, [[YEL_X + 8, H], [YEL_X + 14, H], [VP.x, VP.y], [EDGE_X - 28, H], [EDGE_X - 38, H]], C.amberDim, { amp: 0 });
  g.restore();
  g.strokeStyle = C.bone;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(EDGE_X, H);
  g.lineTo(VP.x, VP.y);
  g.stroke();
  g.strokeStyle = C.boneDim;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(YEL_X + 2, H);
  g.lineTo(VP.x, VP.y);
  g.stroke();

  // --- 吊灯在地上的光池 ---
  blit(g, pool, 1120, 950, 1, 0.34);

  // --- 左墙 ---
  wallPath(g);
  g.fillStyle = C.struct;
  g.fill();
  // 远处两盏灯打在墙上的光（裁在墙面里）
  g.save();
  wallPath(g);
  g.clip();
  blit(g, wash, 770, 500, 1, 0.3);
  g.restore();
  // 墙砖：竖缝
  g.strokeStyle = C.grout;
  g.lineWidth = 2;
  for (let n = 0; n < 22; n++) {
    const x = VP.x - (VP.x + 80) * Math.pow(0.865, n);
    if (x > WALL_END) break;
    const [, yTop] = toVP(0, CORN_Y, x);
    const [, yBot] = toVP(0, JUNC_Y, x);
    g.beginPath();
    g.moveTo(x, yTop);
    g.lineTo(x, yBot);
    g.stroke();
  }
  // 墙砖：横缝
  for (let y = CORN_Y; y <= JUNC_Y + 0.1; y += 108) {
    const [, ye] = toVP(0, y, WALL_END);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(WALL_END, ye);
    g.stroke();
  }
  // 墙上的红带（腰线）
  fillPoly(g, [[0, 300], [WALL_END, toVP(0, 300, WALL_END)[1]], [WALL_END, toVP(0, 352, WALL_END)[1]], [0, 352]], C.red, { amp: 0 });
  // 檐口 + 墙脚
  g.strokeStyle = C.boneDim;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, CORN_Y);
  g.lineTo(...toVP(0, CORN_Y, WALL_END));
  g.stroke();
  g.beginPath();
  g.moveTo(0, JUNC_Y);
  g.lineTo(...toVP(0, JUNC_Y, WALL_END));
  g.stroke();

  // --- 轨行区 ---
  fillPoly(g, [[VP.x, VP.y], [W, VP.y], [W, H], [EDGE_X, H]], '#0d0a09', { amp: 0 });
  // 两条钢轨：从灭点向右下展开
  taper(g, VP.x + 6, VP.y + 8, W + 30, 872, 2, 8, C.amberDim, 0.85);
  taper(g, VP.x + 6, VP.y + 12, W + 30, 964, 2, 7, C.boneDim, 0.5);

  // --- 对面站台：一条边线、一条黄线、一堵暗墙 ---
  for (const [y2, col, w] of [[800, C.boneDim, 3], [762, C.amber, 6]]) {
    taper(g, VP.x, VP.y + 2, W + 10, y2, 1.5, w, col, 0.75);
  }
  fillPoly(g, [[VP.x, VP.y], [W, VP.y], [W, 800], [VP.x, VP.y]], '#1b1613', { amp: 0 });
  fillPoly(g, [[VP.x, VP.y], [W, VP.y], [W, 330], [VP.x, VP.y]], '#17120f', { amp: 0 });
  // 对面墙上的砖缝、红带、瓷砖
  g.save();
  g.beginPath();
  g.moveTo(VP.x, VP.y);
  g.lineTo(W, VP.y);
  g.lineTo(W, 320);
  g.closePath();
  g.clip();
  g.strokeStyle = '#2a211c';
  g.lineWidth = 1.6;
  for (let n = 0; n < 16; n++) {
    const x = W - 4 - 420 * (1 - Math.pow(0.82, n));
    g.beginPath();
    g.moveTo(x, 320 + 225 * ((x - VP.x) / (W - VP.x)) ** 0.0 * 0);
    g.lineTo(x, 760);
    g.stroke();
  }
  // 对面墙的红带
  fillPoly(g, [[VP.x, VP.y + 2], [W, 560], [W, 596], [VP.x, VP.y + 2]], '#5c231a', { amp: 0 });
  g.restore();

  // --- 近处的立柱 ---
  fillPoly(g, [[22, -120], [214, -114], [222, 930], [12, 924]], C.flat, { amp: 3, seed: 71 });
  g.fillStyle = C.boneDim;
  g.fillRect(206, -112, 6, 1034);
  fillPoly(g, [[22, 300], [222, 318], [222, 352], [22, 334]], C.red, { amp: 0 });
  // 中景的两根柱子
  for (const [x, w, top, bot] of [[455, 58, 356, 663], [590, 36, 402, 616], [680, 24, 432, 585]]) {
    fillPoly(g, [[x, top], [x + w, top + 3], [x + w + 3, bot], [x, bot - 2]], C.flat, { amp: 2, seed: x });
    g.fillStyle = C.boneDim;
    g.fillRect(x + w - 1, top + 4, 3, bot - top - 8);
  }

  // --- 吊灯：一盏钠灯。灯管是一根实心黄，光晕在它后面 ---
  blit(g, glow, LAMP.x, 176, 0.46, 0.95);
  g.fillStyle = C.boneDim;
  g.fillRect(LAMP.x - 1, 0, 3, 72);
  fillPoly(g, [[LAMP.x - 96, 72], [LAMP.x + 96, 72], [LAMP.x + 124, 110], [LAMP.x - 124, 110]], C.ink, { amp: 2, seed: 89 });
  g.fillStyle = C.amber;
  g.fillRect(LAMP.x - 122, 108, 244, 12);
  g.fillStyle = C.bone;
  g.fillRect(LAMP.x - 122, 108, 244, 4);
  // 远一点的两盏
  for (const [x, y, sc] of [[706, 300, 0.2], [820, 392, 0.12]]) {
    g.fillStyle = C.boneDim;
    g.fillRect(x - 1, y - 60, 2, 60);
    blit(g, farGlow, x, y, sc, 0.9);
  }
  // 对面站台的两盏小灯
  for (const [x, y, sc] of [[1580, 588, 0.13], [1792, 636, 0.1]]) {
    blit(g, farGlow, x, y, sc, 0.8);
  }
}

function drawCup(g, x, y, rot, s = 1) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  // 杯身
  g.fillStyle = C.bone;
  g.beginPath();
  g.moveTo(-24, -19);
  g.lineTo(22, -16);
  g.quadraticCurveTo(30, 0, 22, 16);
  g.lineTo(-24, 19);
  g.closePath();
  g.fill();
  // 印刷的带子
  g.fillStyle = C.amberDim;
  g.fillRect(-6, -18, 7, 36);
  // 杯口
  g.beginPath();
  g.ellipse(-24, 0, 8, 19, 0, 0, Math.PI * 2);
  g.fillStyle = C.boneDim;
  g.fill();
  g.beginPath();
  g.ellipse(-24, 0, 5.5, 14, 0, 0, Math.PI * 2);
  g.fillStyle = C.ink;
  g.fill();
  g.restore();
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const breathe = 1 + 0.004 * Math.sin(t * 1.6 + 0.4);
  plate(g, base, { z: breathe, cx: 990, cy: 700 });

  const wind = smooth((t - 0.75) / 1.5);

  // --- 风里的尘和纸屑 ---
  for (const d of dust) {
    const age = t - d.t0;
    if (age <= 0) continue;
    const x = d.x0 - age * d.sp;
    if (x < -260 || x > W + 120) continue;
    const y = d.y + (d.x0 - x) * d.tilt;
    const a = d.a * clamp01(age / 0.35) * (0.55 + 0.45 * wind);
    taper(g, x + d.len, y + d.len * d.tilt * 0.5, x, y, d.w * 0.55, d.w, d.amber ? C.amber : C.bone, a);
  }

  // --- 几道长的风痕：比尘更长的刀口 ---
  for (let i = 0; i < 7; i++) {
    const sp = 700 + i * 130;
    const y = 470 + ((i * 173) % 470);
    const t0 = 1.0 + i * 0.16;
    const age = t - t0;
    if (age <= 0) continue;
    const x = 1900 - age * sp * 1.15 + i * 90;
    const len = 190 + i * 40;
    const a = 0.1 + 0.16 * clamp01(age / 0.5) * (1 - clamp01(age / 2.4));
    taper(g, x + len, y + 6, x, y, 1.2, 3.4, C.bone, a);
  }

  // --- 远处的车头灯：两点黄，先来 ---
  const pin = smooth((t - 2.15) / 0.55);
  if (pin > 0) {
    for (const [x, y, s] of [
      [928, 578, 0.1],
      [962, 578, 0.1],
    ]) {
      blit(g, farGlow, x, y, s * (0.7 + pin * 0.6), 0.55 + 0.45 * pin);
    }
  }

  // --- 纸杯：被风推着滚半步 ---
  const cupRun = clamp01((t - 1.1) / 1.35);
  const cupX = 828 - 104 * easeOutSoft(cupRun);
  g.save();
  g.globalAlpha = 0.45;
  g.beginPath();
  g.ellipse(cupX, 1012 + 2 * cupRun, 52, 11, 0, 0, Math.PI * 2);
  g.fillStyle = C.ink;
  g.fill();
  g.restore();
  drawCup(g, cupX, 984 + 2 * cupRun, -0.3 * cupRun, 1.35);

  // --- 传单：抖角 → 翻面 → 贴着地滚向镜头 ---
  const lift = smooth((t - 0.45) / 0.7);
  if (t < 1.15) {
    g.save();
    g.globalAlpha = 0.4;
    fillPoly(g, [[492, 880], [644, 872], [650, 900], [500, 908]], C.ink, { amp: 0 });
    g.restore();
    drawFlyer(g, 566, 852, 0.78, -0.05 * lift, 1, 1 - 0.12 * lift, 0.5);
  } else {
    const p = clamp01((t - 1.15) / 1.45);
    const q = p * p * (0.72 + 0.28 * p);
    const x = lerpQ(566, 400, 30, q);
    const y = lerpQ(852, 500, 1210, q);
    const s = 0.78 + 1.15 * q;
    const rot = 6.4 * q;
    const flip = Math.cos(2.7 * Math.PI * q);
    drawFlyer(g, x, y, s, rot, flip, 1);
  }

  // --- 等车的人：站在黄线上，风把围巾从左肩吹横 ---
  const windLift = smooth((t - 1.25) / 1.3);
  const scarfAngle = 0.95 - 0.86 * windLift + 0.05 * Math.sin(t * 15) * windLift;
  standBack(g, { x: 1210, feetY: 930, h: 340, scarfAngle, sway: 0.3 * wind });

  paperEdge(g);
}

const lerpQ = (a, b, c, p) => (1 - p) * (1 - p) * a + 2 * (1 - p) * p * b + p * p * c;
const easeOutSoft = (p) => 1 - (1 - clamp01(p)) ** 2;

function drawFlyer(g, x, y, s, rot, flip, alpha, squash = 1) {
  g.save();
  g.globalAlpha = alpha;
  scrap(g, x, y, s, rot, flip, { squash });
  g.restore();
}
