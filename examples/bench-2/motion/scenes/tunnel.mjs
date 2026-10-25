// 第二镜 · 隧道口
//
// 物：隧道口、两盏车头灯、被风从洞里推出来的纸屑和尘土。
// 动作：黑洞口里的两点黄从针尖涨成两团网点，把瓷砖一圈圈点亮；纸屑朝镜头冲出来，
//       最后黑色的车头从光里长出来。
// 机位：正对洞口，缓推 1.00→1.10。

import {
  W, H, C, mulberry32, clamp01, smooth, easeInOut,
  stillAt, plate, paperEdge, makeGlow, blit, taper, fillPoly, scrap,
} from './_print.mjs';

export const id = 'tunnel';
export const slots = {};

const MOUTH = { x: 920, top: 300, bottom: 960, halfW: 330 };
const PIT_TOP = 960;
const EDGE_TOP = 1002;
const YEL_TOP = 1024;

let ctx;
let base;
let pinGlow;
let wash;
let washIn;
let dust;
let papers;

export function mount(context) {
  ctx = context;
  const rng = mulberry32(4242);
  dust = Array.from({ length: 84 }, () => ({
    ang: rng() * Math.PI * 2,
    v: 200 + rng() * 980,
    r0: 26 + rng() * 200,
    t0: 0.04 + rng() * 2.1,
    w: 2.4 + rng() * 5.2,
    len: 28 + rng() * 64,
    a: 0.16 + rng() * 0.4,
    amber: rng() < 0.62,
  }));
  papers = Array.from({ length: 7 }, () => ({
    ang: rng() * Math.PI * 2,
    v: 260 + rng() * 680,
    r0: 30 + rng() * 140,
    t0: 0.55 + rng() * 1.7,
    s: 0.28 + rng() * 0.5,
    spin: (rng() < 0.5 ? -1 : 1) * (2.6 + rng() * 4),
  }));
  pinGlow = makeGlow({ w: 520, h: 520, step: 10, hotR: 0.11, seed: 21 });
  wash = makeGlow({ w: 2400, h: 1800, step: 18, angle: 0.22, hotR: 0, power: 1.12, seed: 31 });
  washIn = makeGlow({ w: 1000, h: 1000, step: 15, angle: 0.24, hotR: 0, power: 1.35, seed: 41 });
  base = stillAt(ctx, 1.22, drawBase);
}

function archPath(g, halfW = MOUTH.halfW, grow = 0) {
  const x = MOUTH.x;
  const top = MOUTH.top - grow;
  const bottom = MOUTH.bottom + grow * 0.3;
  const hw = halfW + grow;
  const r = hw;
  g.beginPath();
  g.moveTo(x - hw, bottom);
  g.lineTo(x - hw, top + r);
  g.arc(x, top + r, r, Math.PI, 0);
  g.lineTo(x + hw, bottom);
  g.closePath();
}

function drawBase(g) {
  g.fillStyle = C.ink;
  g.fillRect(0, 0, W, H);

  // --- 洞口周围的瓷砖墙：一块一块地画，颜色有一档差别 ---
  const rng = mulberry32(77);
  const TW = 132;
  const TH = 128;
  const tilesW = Math.ceil(W / TW);
  const tilesH = Math.ceil(MOUTH.bottom / TH);
  for (let r = 0; r < tilesH; r++) {
    for (let c = 0; c < tilesW; c++) {
      const v = rng();
      g.fillStyle = v < 0.18 ? '#251e1a' : v < 0.32 ? '#2f2620' : C.struct;
      g.fillRect(c * TW, r * TH, TW, TH);
    }
  }
  // 缝
  g.strokeStyle = C.grout;
  g.lineWidth = 1.8;
  for (let x = 0; x <= W; x += TW) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, MOUTH.bottom);
    g.stroke();
  }
  for (let y = 0; y <= MOUTH.bottom; y += TH) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  // 腰线：一条哑红（比黄线暗，不抢）
  g.fillStyle = '#7a2b1f';
  g.fillRect(0, 706, W, 30);
  g.fillStyle = C.boneDim;
  g.fillRect(0, 704, W, 2);

  // 檐口
  g.fillStyle = C.boneDim;
  g.fillRect(0, 148, W, 3);
  g.fillStyle = C.ink;
  g.fillRect(0, 0, W, 148);

  // 墙上的电缆管：一根横的，几段卡子
  g.fillStyle = '#3b2f26';
  g.fillRect(0, 214, W, 7);
  g.fillStyle = C.boneDim;
  for (let x = 60; x < W; x += 260) g.fillRect(x, 210, 10, 15);

  // 进站信号灯：一根杆 + 一个黄灯（提示"车要来了"）
  g.fillStyle = C.ink;
  g.fillRect(232, 400, 14, 560);
  fillPoly(g, [[196, 380], [282, 380], [296, 470], [182, 470]], C.deep, { amp: 2, seed: 12 });
  g.fillStyle = C.ink;
  g.fillRect(210, 392, 58, 22);
  g.beginPath();
  g.arc(239, 440, 20, 0, Math.PI * 2);
  g.fillStyle = C.ink;
  g.fill();

  // --- 洞口的混凝土圈：外圈一道骨白，压出一条发亮的边 ---
  archPath(g, MOUTH.halfW + 30, 26);
  g.fillStyle = C.flat;
  g.fill();
  g.save();
  archPath(g, MOUTH.halfW + 30, 26);
  g.strokeStyle = '#4a3a2d';
  g.lineWidth = 3;
  g.stroke();
  g.restore();
  archPath(g);
  g.fillStyle = C.deep;
  g.fill();

  // 洞里的两条钢轨
  g.save();
  g.globalAlpha = 0.55;
  taper(g, 896, MOUTH.bottom + 2, 918, 700, 6, 1.6, C.amberDim);
  taper(g, 944, MOUTH.bottom + 2, 922, 700, 6, 1.6, C.amberDim);
  g.restore();

  // --- 站台边：轨行区、红色鼻线、黄线（都压暗，它们是底不是主角） ---
  g.fillStyle = '#0b0908';
  g.fillRect(0, PIT_TOP, W, EDGE_TOP - PIT_TOP);
  g.fillStyle = '#6b2a1f';
  g.fillRect(0, EDGE_TOP - 12, W, 14);
  g.fillStyle = C.bone;
  g.fillRect(0, EDGE_TOP - 14, W, 3);
  g.fillStyle = C.structLite;
  g.fillRect(0, EDGE_TOP + 1, W, H - EDGE_TOP);
  g.save();
  g.globalAlpha = 0.6;
  g.fillStyle = C.amber;
  g.fillRect(0, 1042, W, 10);
  g.fillStyle = C.boneDim;
  g.fillRect(0, 1052, W, 2);
  g.restore();
  g.fillStyle = C.ink;
  g.fillRect(0, 1068, W, 3);
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const z = 1 + 0.1 * easeInOut(t / 3.3);
  plate(g, base, { z, cx: MOUTH.x, cy: 640 });

  const L = smooth((t - 0.32) / 2.05); // 灯涨
  const N = smooth((t - 2.28) / 0.95); // 车头长出来

  // --- 墙本来就是被洞里的光洗过的；灯涨，网点就铺开 ---
  g.save();
  g.globalAlpha = 0.16 + 0.4 * L;
  blit(g, wash, MOUTH.x, 780, 0.3 + 0.26 * L, 1);
  g.restore();
  {
    // 洞口内壁被照亮：裁在洞里，用一张小的网点，点的大小才看得见变化
    g.save();
    archPath(g);
    g.clip();
    blit(g, washIn, MOUTH.x, 790, 0.42 + 0.3 * L, 0.6 * L);
    g.restore();
  }

  // --- 洞口边被灯照亮的一圈（必须在车头之前，不然会压在车脸上） ---
  if (L > 0) {
    g.save();
    g.globalAlpha = 0.6 * L;
    archPath(g);
    g.strokeStyle = C.amberDim;
    g.lineWidth = 7;
    g.stroke();
    g.restore();
  }

  // --- 车头：一块黑，只留一道骨白前缘 ---
  if (N > 0) {
    const hw = 360 * N + 60;
    const h = 660 * N + 130;
    const top = MOUTH.bottom - h;
    const r = 46;
    g.beginPath();
    g.moveTo(MOUTH.x - hw, MOUTH.bottom);
    g.lineTo(MOUTH.x - hw, top + r);
    g.quadraticCurveTo(MOUTH.x - hw, top, MOUTH.x - hw + r, top);
    g.lineTo(MOUTH.x + hw - r, top);
    g.quadraticCurveTo(MOUTH.x + hw, top, MOUTH.x + hw, top + r);
    g.lineTo(MOUTH.x + hw, MOUTH.bottom);
    g.closePath();
    g.fillStyle = C.deep;
    g.fill();
    // 前脸：风挡一块更暗的方，底下一条黄的裙灯
    g.save();
    g.globalAlpha = 0.75;
    g.fillStyle = '#1d1815';
    g.fillRect(MOUTH.x - hw * 0.78, top + 56, hw * 1.56, h * 0.4);
    g.restore();
    g.fillStyle = C.amber;
    g.fillRect(MOUTH.x - hw + 18, MOUTH.bottom - 26, hw * 2 - 36, 9);
    // 前脸下沿一条红的裙线、中间一块车钩的黑
    g.fillStyle = C.red;
    g.fillRect(MOUTH.x - hw + 22, MOUTH.bottom - 52, hw * 2 - 44, 16);
    g.fillStyle = C.ink;
    g.fillRect(MOUTH.x - 46, MOUTH.bottom - 120, 92, 120);
    // 骨白前缘：车头压过来时唯一能看见的边
    g.strokeStyle = C.boneDim;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(MOUTH.x - hw, MOUTH.bottom);
    g.lineTo(MOUTH.x - hw, top + r);
    g.quadraticCurveTo(MOUTH.x - hw, top, MOUTH.x - hw + r, top);
    g.lineTo(MOUTH.x + hw - r, top);
    g.quadraticCurveTo(MOUTH.x + hw, top, MOUTH.x + hw, top + r);
    g.lineTo(MOUTH.x + hw, MOUTH.bottom);
    g.stroke();
  }

  // --- 两盏车头灯 ---
  const spread = 32 + 168 * L;
  const ly = 742;
  const glowScale = 0.1 + 0.52 * L;
  for (const sx of [-1, 1]) {
    blit(g, pinGlow, MOUTH.x + sx * spread, ly, glowScale * (1 + 0.12 * N), 0.9);
  }
  // 灯下的反光：钢轨上两点黄
  g.save();
  g.globalAlpha = 0.5 + 0.4 * L;
  taper(g, MOUTH.x - spread, ly + 40, MOUTH.x - 18, PIT_TOP - 4, 3, 1.2, C.amber);
  taper(g, MOUTH.x + spread, ly + 40, MOUTH.x + 18, PIT_TOP - 4, 3, 1.2, C.amber);
  g.restore();

  // --- 风把纸屑从洞里推出来 ---
  for (const p of papers) {
    const age = t - p.t0;
    if (age <= 0) continue;
    const r = p.r0 + p.v * age * 1.25;
    const x = MOUTH.x + Math.cos(p.ang) * r * 1.35;
    const y = 742 + Math.sin(p.ang) * r * 0.95;
    if (x < -180 || x > W + 180 || y < -160 || y > H + 160) continue;
    const s = p.s * (1 + r / 900);
    if (s > 3.4) continue;
    scrap(g, x, y, s, p.spin * age, Math.cos(age * 4.2), { lines: false });
  }

  // --- 尘土：径向冲出来，越近越大 ---
  const windAmt = smooth((t - 0.02) / 0.8);
  for (const d of dust) {
    const age = t - d.t0;
    if (age <= 0) continue;
    const r = d.r0 + d.v * age * 1.2;
    const r2 = d.r0 + d.v * Math.max(0, age - 0.06) * 1.2;
    const ux = Math.cos(d.ang) * 1.3;
    const uy = Math.sin(d.ang) * 0.9;
    const x = MOUTH.x + ux * r;
    const y = 742 + uy * r;
    const x2 = MOUTH.x + ux * r2 * 0.93;
    const y2 = 742 + uy * r2 * 0.93;
    if (x < -160 || x > W + 160 || y < -160 || y > H + 160) continue;
    const a = d.a * clamp01(age / 0.25) * windAmt;
    const w = d.w * (0.7 + r / 1100);
    const mx = (x + x2) / 2 + Math.cos(d.ang + 1.57) * w * 0.55;
    const my = (y + y2) / 2 + Math.sin(d.ang + 1.57) * w * 0.55;
    const col = d.amber ? C.amber : C.bone;
    taper(g, x2, y2, mx, my, w * 0.12, w * 0.7, col, a * 0.75);
    taper(g, mx, my, x, y, w * 0.7, w, col, a);
  }

  // --- 进站信号：黄灯亮着，车来之前一直亮 ---
  const sig = 0.5 + 0.5 * smooth((t - 0.6) / 1.2);
  blit(g, pinGlow, 239, 440, 0.08 + 0.02 * sig, 0.85);
  g.beginPath();
  g.arc(239, 440, 13, 0, Math.PI * 2);
  g.fillStyle = C.amber;
  g.fill();
  g.beginPath();
  g.arc(239, 440, 4.5, 0, Math.PI * 2);
  g.fillStyle = C.bone;
  g.fill();

  paperEdge(g);
}
