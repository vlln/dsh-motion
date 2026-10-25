// 第三镜 · 车过
//
// 物：车厢侧面——车窗、门缝、腰线、黄线；还有一张被风卷过来的传单。
// 动作：车体从右向左横扫、减速、停住；门缝在最后一刻亮起一条黄。
// 机位：平视，跟车横移（镜头有震动，车停震动就停）。

import {
  W, H, C, mulberry32, clamp01, smooth, easeOut,
  stillAt, paperEdge, makeGlow, blit, taper, fillPoly, scrap,
} from './_print.mjs';
import { ribbon, tailPts } from './_figures.mjs';

export const id = 'train';
export const slots = {};

const TOP = 150;
const BOT = 900;
const UNIT = 1200; // 一个重复单元：3 扇窗 + 1 樘门
const DOOR_X = 810;
const STOP_T = 2.52;
const D = 4930; // 停住时累计位移，正好把一樘门停在 780

let ctx;
let base;
let pattern;
let doorGlow;
let dust;

export function mount(context) {
  ctx = context;
  const rng = mulberry32(3131);
  dust = Array.from({ length: 22 }, () => ({
    x0: 300 + rng() * 2400,
    y: 200 + rng() * 680,
    sp: 1500 + rng() * 1500,
    len: 40 + rng() * 130,
    w: 2 + rng() * 5,
    a: 0.1 + rng() * 0.3,
    t0: rng() * 1.8,
    amber: rng() < 0.5,
  }));
  // 窗的光：一块网点
  const tile = document.createElement('canvas');
  tile.width = 22;
  tile.height = 22;
  const tg = tile.getContext('2d');
  tg.fillStyle = C.amber;
  tg.beginPath();
  tg.arc(11, 11, 5.2, 0, Math.PI * 2);
  tg.fill();
  pattern = ctx.canvas.getContext('2d').createPattern(tile, 'repeat');
  doorGlow = makeGlow({ w: 260, h: 900, step: 13, hotR: 0, power: 1.1, seed: 61 });
  base = stillAt(ctx, 1.22, drawBg);
}

const offset = (t) => D * (1 - (1 - clamp01(t / STOP_T)) ** 3);
const speed = (t) => (3 * D) / STOP_T * (1 - clamp01(t / STOP_T)) ** 2;

function drawBg(g) {
  g.fillStyle = C.ink;
  g.fillRect(0, 0, W, H);
  // 上：站台的顶
  g.fillStyle = '#17120f';
  g.fillRect(0, 0, W, TOP);
  g.fillStyle = C.boneDim;
  g.fillRect(0, TOP - 4, W, 3);
  // 下：站台地面
  g.fillStyle = '#33291f';
  g.fillRect(0, BOT, W, H - BOT);
  g.fillStyle = C.ink;
  g.fillRect(0, BOT, W, 4);
  g.fillStyle = '#6b2a1f';
  g.fillRect(0, BOT + 6, W, 10);
  g.fillStyle = C.bone;
  g.fillRect(0, BOT + 16, W, 3);
  g.save();
  g.globalAlpha = 0.72;
  g.fillStyle = C.amber;
  g.fillRect(0, BOT + 58, W, 13);
  g.restore();
  g.fillStyle = C.ink;
  g.fillRect(0, BOT + 71, W, 3);
  g.fillStyle = '#241d1a';
  g.fillRect(0, BOT + 104, W, 3);
}

function windowAt(g, x, t, sp) {
  const y = 248;
  const w = 220;
  const h = 242;
  if (x + w < -260 || x > W + 260) return;
  const smear = sp * 0.055;
  if (smear > 6) {
    g.save();
    g.globalAlpha = 0.18;
    g.fillStyle = C.amber;
    g.fillRect(x + w - 10, y + 14, smear, h - 28);
    g.restore();
  }
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  // 车里的光：一块暗底 + 一层网点 + 顶部更亮的一条
  g.fillStyle = '#38220c';
  g.fillRect(x, y, w, h);
  g.globalAlpha = 0.9;
  g.fillStyle = pattern;
  g.fillRect(x, y, w, h);
  g.globalAlpha = 1;
  g.fillStyle = '#6b3f12';
  g.fillRect(x, y, w, 26);
  // 两根立杆
  g.fillStyle = '#2a1a0a';
  g.fillRect(x + 38, y + 6, 7, h - 12);
  g.fillRect(x + w - 45, y + 6, 7, h - 12);
  // 椅背（两个人）
  g.fillStyle = '#241708';
  for (let i = 0; i < 2; i++) {
    const sx = x + 20 + i * 100;
    g.beginPath();
    g.moveTo(sx, y + h - 4);
    g.lineTo(sx, y + h - 74);
    g.quadraticCurveTo(sx + 44, y + h - 96, sx + 88, y + h - 74);
    g.lineTo(sx + 88, y + h - 4);
    g.closePath();
    g.fill();
  }
  // 窗台
  g.fillStyle = '#1a1108';
  g.fillRect(x, y + h - 14, w, 14);
  g.restore();
  g.strokeStyle = C.bone;
  g.lineWidth = 2.6;
  g.strokeRect(x + 1.3, y + 1.3, w - 2.6, h - 2.6);
}

function doorAt(g, x, t) {
  const w = 200;
  if (x + w < -320 || x > W + 320) return;
  // 门板：比车体亮一点点，两道骨白的边
  g.fillStyle = '#221b17';
  g.fillRect(x, TOP + 6, w, BOT - TOP - 12);
  g.fillStyle = C.bone;
  g.fillRect(x + 1, TOP + 10, 3, BOT - TOP - 20);
  g.fillRect(x + w - 4, TOP + 10, 3, BOT - TOP - 20);
  // 门上的窗
  const dy = 268;
  const dw = w - 34;
  g.save();
  g.beginPath();
  g.rect(x + 17, dy, dw, 150);
  g.clip();
  g.fillStyle = '#38220c';
  g.fillRect(x + 17, dy, dw, 150);
  g.globalAlpha = 0.85;
  g.fillStyle = pattern;
  g.fillRect(x + 17, dy, dw, 150);
  g.globalAlpha = 1;
  g.fillStyle = '#2a1a0a';
  g.fillRect(x + 76, dy + 4, 7, 142);
  g.restore();
  g.strokeStyle = C.bone;
  g.lineWidth = 2.4;
  g.strokeRect(x + 18.2, dy + 1.2, dw - 2.4, 147.6);
  // 门上方的到站显示：三个黄点（不是字）
  g.fillStyle = '#0f0c0b';
  g.fillRect(x + 56, 196, 88, 26);
  g.fillStyle = C.amber;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.arc(x + 76 + i * 22, 209, 5.5, 0, Math.PI * 2);
    g.fill();
  }
  // 门缝：一条黄，最后亮起来
  const lit = smooth((t - 2.56) / 0.34);
  const mx = x + w / 2;
  g.save();
  g.globalAlpha = 0.1 + 0.9 * lit;
  g.fillStyle = C.amber;
  g.fillRect(mx - 3, TOP + 18, 6, BOT - TOP - 36);
  g.restore();
  // 门的胶条：红
  g.fillStyle = '#5c231a';
  g.fillRect(x + 8, 440, w - 16, 7);
  g.fillRect(x + 8, 720, w - 16, 7);
}

/**
 * 右缘一个背影：肩、后脑的一角、一条被风扯向左侧的围巾。
 * 车在后面过，她在前面站着——这一镜靠她给纵深，也靠她的围巾把风画出来。
 */
function foreground(g, t) {
  // 只到肩：头裁在画外，右下一个大的暗面 + 一条往左甩的围巾
  const body = [
    [1920, 496],
    [1868, 540],
    [1812, 638],
    [1768, 792],
    [1730, 962],
    [1706, 1080],
    [1920, 1080],
  ];
  g.save();
  g.translate(-7, -4);
  fillPoly(g, body, C.bone, { amp: 2.6, seed: 51 });
  g.restore();
  fillPoly(g, body, '#0e0b0a', { amp: 0, seed: 51 });

  // 围巾：从画右伸进来，被风扯向左边，一直在抖
  const a = 0.13 + 0.05 * Math.sin(t * 9.3) + 0.03 * Math.sin(t * 17.1 + 1);
  const pts = tailPts(1912, 556, a, 620, { n: 22, sag: 30 });
  g.save();
  g.translate(4, -3);
  g.globalAlpha = 0.9;
  ribbon(g, pts, 56, 20, C.amberDim);
  g.restore();
  ribbon(g, pts, 52, 18, C.bone);
  const fold = pts.map(([x, y], i) => [x, y + 11 - i * 0.2]);
  ribbon(g, fold.slice(3), 13, 6, C.amberDim, { alpha: 0.85 });
  // 肩上的钠光
  g.strokeStyle = C.amber;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(1716, 1040);
  g.quadraticCurveTo(1760, 780, 1846, 560);
  g.stroke();
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const sp = speed(t);
  const s = offset(t);
  const shakeY = 2.4 * (sp / 5000) * Math.sin(t * 91);
  const shakeX = 0.9 * (sp / 5000) * Math.sin(t * 57 + 1.1);

  g.save();
  g.translate(shakeX, shakeY);
  g.drawImage(base, 0, 0, W, H);

  // --- 车体：一条带子，只滚它 ---
  g.save();
  g.beginPath();
  g.rect(0, TOP, W, BOT - TOP);
  g.clip();
  g.fillStyle = '#191412';
  g.fillRect(0, TOP, W, BOT - TOP);

  const doorX = [];
  const k0 = Math.floor(s / UNIT) - 1;
  for (let k = k0; k <= k0 + 4; k++) {
    const ox = k * UNIT - s;
    for (let i = 0; i < 4; i++) windowAt(g, ox + 60 + i * 300, t, sp);
    doorAt(g, ox + DOOR_X, t);
    doorX.push(ox + DOOR_X);
    // 单元接缝 + 下裙板上的两道竖缝
    g.fillStyle = '#0e0b0a';
    g.fillRect(ox, TOP + 4, 5, BOT - TOP - 8);
    g.fillStyle = '#2c231d';
    g.fillRect(ox + 5, TOP + 4, 3, BOT - TOP - 8);

  }

  // 窗台线、裙板、腰线、顶部反光
  g.fillStyle = C.boneDim;
  g.fillRect(0, 500, W, 2.5);
  // 裙板：比车体亮一档，上面一道划痕
  g.fillStyle = '#211a16';
  g.fillRect(0, 716, W, BOT - 716);
  g.fillStyle = '#2a211c';
  g.fillRect(0, 716, W, 3);
  g.fillStyle = C.boneDim;
  g.fillRect(0, 812, W, 2);
  // 腰线：一条哑红，压在裙板上
  g.fillStyle = C.red;
  g.fillRect(0, 836, W, 16);
  g.fillStyle = C.amber;
  g.fillRect(0, TOP + 18, W, 2);
  g.fillStyle = C.bone;
  g.fillRect(0, BOT - 6, W, 3);
  // 裙板上跟着车一起走的竖缝和一排铆钉
  const kk0 = Math.floor(s / 300) - 1;
  for (let kk = kk0; kk <= kk0 + Math.ceil(W / 300) + 2; kk++) {
    const x = kk * 300 - s;
    g.fillStyle = '#2a211c';
    g.fillRect(x, 510, 2, 206);
    g.fillRect(x, 722, 2, 108);
  }
  g.fillStyle = '#3a2e25';
  for (let kk = kk0; kk <= kk0 + Math.ceil(W / 150) + 2; kk++) {
    const x = kk * 150 - s + 40;
    g.fillRect(x, 690, 4, 4);
  }

  // 速度线：贴着车窗底的一条条
  if (sp > 120) {
    const n = Math.min(16, Math.round(sp / 320));
    for (let i = 0; i < n; i++) {
      const y = 530 + ((i * 97) % 60);
      const x = (i * 211 - s * 1.02) % (W + 400);
      const px = x < -200 ? x + W + 400 : x;
      taper(g, px + 150 + sp * 0.02, y, px, y, 1.5, 4, C.amberDim, 0.5);
    }
  }
  g.restore();

  // --- 门缝的光晕（车停之后）---
  const lit = smooth((t - 2.56) / 0.34);
  if (lit > 0) {
    const target = doorX.reduce((best, x) => (Math.abs(x + 84 - 810) < Math.abs(best + 84 - 810) ? x : best), doorX[0]);
    g.save();
    g.beginPath();
    g.rect(0, TOP, W, BOT - TOP);
    g.clip();
    blit(g, doorGlow, target + 84, 540, 1, 0.5 * lit);
    g.restore();
    // 门缝的光落到地上
    g.save();
    g.globalAlpha = 0.18 * lit;
    g.fillStyle = C.amber;
    g.fillRect(target + 40, BOT + 72, 90, 5);
    g.restore();
  }

  // --- 前景：右缘的背影 ---
  foreground(g, t);

  // --- 风：从车前面卷过去的长痕 ---
  const wind = smooth((t - 0.15) / 0.9) * (1 - smooth((t - 2.2) / 0.7));
  for (const d of dust) {
    const age = t - d.t0;
    if (age <= 0) continue;
    const x = d.x0 - age * d.sp;
    if (x < -320 || x > W + 120) continue;
    const y = d.y - age * 40;
    const a = d.a * clamp01(age / 0.3) * wind;
    taper(g, x + d.len, y + 8, x, y, d.w * 0.3, d.w, d.amber ? C.amber : C.bone, a);
  }

  // --- 传单：从右边卷过来，贴着车身滑走 ---
  const fp = clamp01((t - 1.32) / 1.05);
  if (fp > 0 && fp < 1) {
    const x = 2050 - 2350 * easeOut(fp);
    const y = 420 + 120 * Math.sin(fp * 3.1);
    scrap(g, x, y, 1.15 + 0.6 * fp, -1.2 + 7 * fp, Math.cos(fp * 7.5), { lines: false });
  }

  g.restore();
  paperEdge(g);
}
