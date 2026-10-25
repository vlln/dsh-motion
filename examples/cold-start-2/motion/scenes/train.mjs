// 镜头三：车来了（7.2–11.0s）
//
// 机位在站台上，正对车侧。物：一整面车厢（车窗、车门缝、锈红腰带）、黄线、一个背影。
// 动作：车体由左向右扫过、减速、停稳；门缝亮开一线；围巾从横飞落回肩上。
// 画法：车厢在 mount() 里刻成一节（1400×820 的版），render 只平移贴；速度靠横的刻痕带，
//       不靠模糊——版画没有模糊。

import { W, H, DEG, pal, mk, paper, grain, mass, hatch, poly, windStroke, windPath, figureBack, clamp01, smooth, lerp } from './_print.mjs';

export const id = 'train';

const CAR = 1400; // 一节车
const TRAIN_H = 820; // 车体高度（站在地板上沿）
const BASE_Y = 820; // 车体下沿 / 站台边
const YEL = 872; // 黄线中心

let ctx;
let P;
let base = null;
let car = null;
let carPaper = null;
let gusts = [];
let scraps = [];

export function mount(context) {
  ctx = context;
  P = pal(ctx);
  car = makeCar(2);
  gusts = [];
  const r = mk(733);
  for (let i = 0; i < 12; i++) {
    gusts.push({ y: 90 + r() * 900, off: r(), len: 220 + r() * 420, lift: -22 - r() * 54, w: 4.5 + r() * 6, v: 0.5 + r() * 0.7 });
  }
  scraps = [];
  for (let i = 0; i < 7; i++) {
    scraps.push({ y: 240 + r() * 640, s: 0.6 + r() * 1.1, off: r(), rot: r() * 6.28, spin: (r() - 0.5) * 10, v: 0.6 + r() * 0.8 });
  }
  base = ctx.still(drawBase, { scale: 1 });
}

/** 一节车厢，刻进一张 2 倍大的版里。 */
function makeCar(scale) {
  const c = document.createElement('canvas');
  c.width = CAR * scale;
  c.height = TRAIN_H * scale;
  const g = c.getContext('2d');
  g.scale(scale, scale);
  drawCar(g);
  return c;
}

function drawCar(g) {
  // 车身：一整块墨
  mass(g, [[-10, -10], [CAR + 10, -10], [CAR + 10, TRAIN_H + 10], [-10, TRAIN_H + 10]], P, { amp: 1.6, step: 40, carve: 0, seed: 601 });
  // 车顶的一道纸线
  g.strokeStyle = P.paper;
  g.globalAlpha = 0.55;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(0, 14);
  g.lineTo(CAR, 14);
  g.stroke();
  g.globalAlpha = 1;

  // 车身排线：斜的，越靠下越密
  hatch(g, { x: 0, y: 600, w: CAR, h: 220, gap: 7, angle: 42, width: 2, color: P.paper, alpha: 0.1 });

  // 车窗：纸白的四个洞
  for (let i = 0; i < 4; i++) {
    const x = 78 + i * 236;
    mass(g, [[x, 196], [x + 190, 196], [x + 190, 592], [x, 592]], P, {
      amp: 1.4, step: 22, carve: 0, seed: 610 + i, fill: 'paper', edge: P.ink, edgeW: 3,
    });
    // 窗里的一点"车厢内"：上部一道横线，下部一块暗
    g.strokeStyle = P.ink;
    g.globalAlpha = 0.35;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + 6, 250);
    g.lineTo(x + 184, 250);
    g.stroke();
    g.globalAlpha = 0.18;
    g.fillStyle = P.ink;
    g.fillRect(x + 8, 470, 174, 116);
    g.globalAlpha = 1;
  }

  // 车门：两扇，中间一道缝
  mass(g, [[1050, 60], [1310, 60], [1310, 790], [1050, 790]], P, { amp: 1.6, step: 24, carve: 3.2, seed: 621 });
  // 门上的窗
  mass(g, [[1082, 196], [1278, 196], [1278, 500], [1082, 500]], P, {
    amp: 1.4, step: 22, carve: 0, seed: 623, fill: 'paper', edge: P.ink, edgeW: 3,
  });
  // 门的踏步（底部一块浅色）
  mass(g, [[1056, 700], [1304, 700], [1304, 790], [1056, 790]], P, {
    amp: 1.2, step: 18, carve: 0, seed: 625, fill: 'paper', edge: P.ink, edgeW: 2.4, alpha: 0.85,
  });

  // 锈红腰带：从车头一直拉过去，被人和窗切断也行
  mass(g, [[-10, 620], [CAR + 10, 620], [CAR + 10, 686], [-10, 686]], P, { amp: 1.4, step: 30, carve: 2.4, seed: 631, fill: 'rust' });

  // 车厢接缝：一道竖的纸线
  g.strokeStyle = P.paper;
  g.globalAlpha = 0.5;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(4, 24);
  g.lineTo(4, TRAIN_H - 10);
  g.stroke();
  g.globalAlpha = 1;
}

function drawBase(g) {
  paper(g, W, H, P, 71);
  // 站台地面
  mass(g, [[-8, BASE_Y - 4], [W + 8, BASE_Y - 4], [W + 8, H + 8], [-8, H + 8]], P, {
    amp: 1.6, step: 30, carve: 0, seed: 641, fill: 'paper',
  });
  // 地面排线 / 砖缝
  g.save();
  g.beginPath();
  g.rect(-8, BASE_Y, W + 16, H);
  g.clip();
  g.strokeStyle = P.mortar;
  g.globalAlpha = 0.45;
  g.lineWidth = 1.8;
  for (let y = BASE_Y + 46; y < H; y += 54) {
    g.beginPath();
    g.moveTo(-8, y);
    g.lineTo(W + 8, y);
    g.stroke();
  }
  for (let x = 40; x < W; x += 132) {
    g.beginPath();
    g.moveTo(x, BASE_Y);
    g.lineTo(x - 40, H);
    g.stroke();
  }
  hatch(g, { x: -8, y: BASE_Y, w: W + 16, h: H - BASE_Y, gap: 26, angle: 42, width: 2.4, color: P.mortar, alpha: 0.3 });
  g.restore();

  // 黄线：贴墙根的一条
  mass(g, [[-8, YEL - 22], [W + 8, YEL - 22], [W + 8, YEL + 22], [-8, YEL + 22]], P, {
    amp: 1.6, step: 26, carve: 2.6, seed: 643, fill: 'yellow',
  });
  // 黄线底下的一道墨（站台边）
  mass(g, [[-8, YEL + 22], [W + 8, YEL + 22], [W + 8, YEL + 34], [-8, YEL + 34]], P, { amp: 1.2, step: 24, carve: 0, seed: 645 });

  grain(g, W, H, 79);
}

// ---------------------------------------------------------------- render

function isFloor(x, y) {
  return y > YEL + 30;
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.drawImage(base, 0, 0, W, H);

  // 车体的位置：2.5s 到站，之后一次很轻的回弹
  // 走法：先匀速冲一段，后 40% 减速到停 —— 不然后半段等于静止
  const D = 2600;
  const T = 2.55;
  const u = clamp01(t / T);
  const f = u < 0.6 ? (0.72 * u) / 0.6 : 0.72 + 0.28 * (1 - (1 - (u - 0.6) / 0.4) ** 1.4);
  let off = -D * (1 - f);
  if (t > T) off += -16 * Math.sin((t - T) * 5.2) * Math.exp(-(t - T) * 3.2);
  const speed = u < 0.6 ? 1 : Math.max(0, 1 - (u - 0.6) / 0.4) ** 0.8;
  const stopped = clamp01((t - 2.65) / 0.5);

  // 车厢（贴三次，够铺满）
  g.save();
  g.translate(off, 0);
  for (let i = -1; i < 3; i++) g.drawImage(car, i * CAR, 0, CAR, TRAIN_H);
  // 速度痕：车快的时候，窗光拉成横条
  if (speed > 0.06) {
    g.save();
    g.globalAlpha = speed * 0.9;
    g.fillStyle = P.paper;
    for (let i = 0; i < 9; i++) {
      const y = 200 + i * 44;
      const len = 300 + ((i * 137) % 520);
      g.fillRect(((i * 311) % CAR) - 40, y, len, 7 + (i % 3) * 4);
    }
    g.restore();
  }
  g.restore();

  // 门缝：停稳之后亮开一线（纸色的光从缝里出来）
  const open = smooth((t - 2.5) / 0.8);
  if (open > 0) {
    const seamX = off + 1180;
    g.save();
    g.fillStyle = P.paper;
    g.globalAlpha = 0.95;
    g.fillRect(seamX - (2 + 12 * open), 70, 4 + 24 * open, TRAIN_H - 80);
    // 门缝漏到站台上的一块光
    g.globalAlpha = 0.75 * open;
    poly(g, [[seamX - 40, YEL + 26], [seamX + 44, YEL + 26], [seamX + 120, H], [seamX - 120, H]]);
    g.fill();
    g.restore();
  }

  // 影子
  g.save();
  g.globalAlpha = 0.22;
  g.fillStyle = P.ink;
  g.beginPath();
  g.ellipse(1216, 1014, 150, 24, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // 人：先贴一层纸色的剪影（错开 7px），再压墨 —— 黑车前面靠这道刀口立住
  const fall = smooth((t - 2.45) / 1.25);
  const fig = {
    x: 1212, footY: 1012, h: 566,
    scarfAngle: lerp(-9, 82, fall),
    scarfLen: lerp(0.42, 0.3, fall),
    scarfPhase: t * 6.2,
    scarfAmp: lerp(19, 3, fall),
    flap: 0.012 * (1 - fall),
    scarfSide: 1,
    seed: 41,
  };
  g.save();
  g.translate(-5, -2);
  figureBack(g, { ...P, ink: P.paper, rust: P.paper, yellow: P.paper, grey: P.paper, mortar: P.paper }, fig);
  g.restore();
  figureBack(g, P, fig);

  // 风：车停稳就断，最后只剩一两笔在飘
  const windAmp = t < 2.65 ? 1 : Math.max(0.12, 1 - (t - 2.65) / 1.1);
  for (let i = 0; i < gusts.length; i++) {
    const s = gusts[i];
    const ph = (t * 0.5 * s.v + s.off) % 1.2;
    const x = -140 + ph * 2140;
    const y = s.y + Math.sin(ph * 2.4 + i * 1.3) * 14;
    const pts = windPath(x, y, s.len * (0.6 + ph * 0.7), 16, s.lift * (0.5 + ph));
    const dark = isFloor(x + 150, y + 10);
    windStroke(g, P, { pts, width: s.w * (0.5 + ph * 0.6) * (0.5 + 0.5 * windAmp), dark, alpha: 0.9 * windAmp });
  }

  // 碎纸
  for (const d of scraps) {
    const age = t - 0.25;
    if (age < 0) continue;
    const ph = (age * 0.5 * d.v + d.off) % 1.2;
    const x = -120 + ph * 2180;
    const y = d.y + Math.sin(ph * 5 + d.rot) * 44 - ph * 120;
    const fade = clamp01(1.4 - age);
    g.save();
    g.globalAlpha = fade;
    g.translate(x, y);
    g.rotate(d.rot + ph * d.spin);
    g.scale(d.s, d.s);
    mass(g, [[-17, -12], [18, -14], [15, 12], [-16, 10]], P, { amp: 1, step: 10, carve: 0, seed: 651, fill: 'paper', edge: P.ink, edgeW: 2.2 });
    g.strokeStyle = P.ink;
    g.globalAlpha = fade * 0.7;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(-9, -3);
    g.lineTo(8, -4);
    g.moveTo(-9, 3);
    g.lineTo(6, 2);
    g.stroke();
    g.restore();
  }
  g.globalAlpha = 1;
}
