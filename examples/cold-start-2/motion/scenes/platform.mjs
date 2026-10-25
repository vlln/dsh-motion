// 镜头一：站台（0–3.4s）
//
// 机位在对面站台，隔着轨道看过去。一条横向的带子结构：
//   上：天花板（墨）→ 墙（纸，瓷砖 + 线路图 + 吊牌）→ 站台地面 → 黄线 → 轨道坑（墨，前景）
// 左端所有横线都向地平线收（k=0.60），所以左深右浅；隧道口在最左边，是一个大黑拱。
// 动作只有一件：风从隧道那侧先到 —— 纸杯先滚、报纸先翻、围巾尾先抬。
// 静的东西在 mount() 里一次刻成，render 只画会动的三样 + 风痕 + 灰。

import { W, H, DEG, pal, mk, paper, grain, mass, hatch, poly, windStroke, windPath, figureBack, plate, clamp01, smooth, lerp } from './_print.mjs';

export const id = 'platform';
export const slots = { platform: { default: '3', role: 'label', maxChars: 3 } };

const HOR = 545; // 地平线（相机高度）
const K = 0.6; // 左端相对右端的收缩
const yL = (y) => HOR + (y - HOR) * K;
const lineY = (yR, x) => yR + (yL(yR) - yR) * (1 - x / W);

const CEIL = 96; // 天花板下沿（右端）
const BASE = 758; // 墙脚（右端）
const EDGE = 906; // 站台边（黄线外沿，右端）

let ctx;
let P;
let base = null;
let motes = [];
let gustSeed = [];
let lamps = [];

export function mount(context) {
  ctx = context;
  P = pal(ctx);
  const r = mk(913);
  motes = [];
  for (let i = 0; i < 26; i++) {
    motes.push({ x: 280 + r() * 1600, y: 260 + r() * 800, s: 0.9 + r() * 2.4, v: 60 + r() * 210, a: 0.1 + r() * 0.22 });
  }
  gustSeed = [];
  const bands = [352, 520, 744, 900, 1010];
  for (let gi = 0; gi < 3; gi++) {
    const y0 = bands[gi] + (r() - 0.5) * 26;
    const off = gi * 0.33 + 0.06;
    const birth = [0.5, 0.78, 1.35][gi] + (r() - 0.5) * 0.12;
    const len = 240 + r() * 120;
    const dir = (r() - 0.5) * 34;
    for (let rank = 0; rank < 5; rank++) {
      gustSeed.push({
        y: y0 + rank * (36 + r() * 12),
        off,
        birth,
        len: len * (1 - rank * 0.09),
        drop: dir * (1 - rank * 0.12),
        lift: -(rank === 0 ? 46 : 24 + rank * 9) * (0.9 + r() * 0.25),
        w: rank === 0 ? 12 : 3.6 + r() * 1.6,
        dy: (r() - 0.5) * 14,
        rank,
      });
    }
  }
  lamps = [
    { c: 1650, w: 230 },
    { c: 1250, w: 200 },
    { c: 880, w: 176 },
    { c: 560, w: 152 },
    { c: 285, w: 130 },
  ];
  base = ctx.still(drawBase, { scale: 1 });
}

function isCream(x, y) {
  const xx = Math.max(0, Math.min(W, x));
  if (x < 330 && y > 292) return false; // 隧道口里
  if (y > lineY(EDGE + 8, xx)) return false; // 轨道坑
  if (y < lineY(CEIL, xx) + 2) return false; // 天花板
  return true;
}

function drawBase(g) {
  paper(g, W, H, P, 71);

  // ---- 天花板：一整块墨，灯管是刻掉的纸 -----------------------------
  mass(g, [
    [-8, -8], [W + 8, -8], [W + 8, CEIL + 2], [0, yL(CEIL)],
  ], P, { amp: 2.6, step: 30, carve: 4.5, seed: 101 });
  for (const { c, w } of lamps) {
    const y = lineY(CEIL, c) + 30 * (0.55 + 0.45 * (c / W));
    const th = 9 + 10 * (c / W);
    g.globalAlpha = 0.9;
    g.fillStyle = P.paper;
    g.fillRect(c - w / 2, y, w, th);
    g.globalAlpha = 0.55;
    g.fillStyle = P.yellow;
    g.fillRect(c - w / 2 + 8, y + th * 0.3, w - 16, th * 0.34);
    g.globalAlpha = 0.5;
    g.strokeStyle = P.ink;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(c - w * 0.3, y);
    g.lineTo(c - w * 0.3, lineY(CEIL, c));
    g.moveTo(c + w * 0.3, y);
    g.lineTo(c + w * 0.3, lineY(CEIL, c));
    g.stroke();
    g.globalAlpha = 1;
  }

  // ---- 墙：瓷砖（横缝与竖缝都向左边收） -----------------------------
  g.strokeStyle = P.mortar;
  g.lineWidth = 2;
  g.globalAlpha = 0.6;
  for (let yR = CEIL + 92; yR < BASE - 24; yR += 84) {
    g.beginPath();
    g.moveTo(W, yR);
    g.lineTo(0, yL(yR));
    g.stroke();
  }
  for (let i = 0; i < 11; i++) {
    const x = W - 168 * i - 4.2 * i * i;
    if (x < -40) break;
    g.beginPath();
    g.moveTo(x, lineY(CEIL, x));
    g.lineTo(x, lineY(BASE, x));
    g.stroke();
  }
  g.globalAlpha = 1;

  // ---- 墙上的线路图：锈红版，纸色刻线 -------------------------------
  const poster = (x0, x1, f0, f1) => {
    const top = (x) => lineY(CEIL, x) + (lineY(BASE, x) - lineY(CEIL, x)) * f0;
    const bot = (x) => lineY(CEIL, x) + (lineY(BASE, x) - lineY(CEIL, x)) * f1;
    return [[x0, top(x0)], [x1, top(x1)], [x1, bot(x1)], [x0, bot(x0)]];
  };
  const map = poster(360, 690, 0.2, 0.82);
  mass(g, map, P, { amp: 1.8, step: 22, carve: 3, seed: 111, fill: 'rust' });
  g.save();
  poly(g, map);
  g.clip();
  g.strokeStyle = P.paper;
  g.lineWidth = 3.2;
  g.globalAlpha = 0.95;
  g.beginPath();
  g.moveTo(392, 430);
  g.lineTo(500, 396);
  g.lineTo(668, 372);
  g.stroke();
  g.beginPath();
  g.moveTo(392, 470);
  g.lineTo(520, 446);
  g.lineTo(668, 438);
  g.stroke();
  g.fillStyle = P.paper;
  for (const [x, y, r0] of [[420, 422, 5], [500, 396, 6], [592, 380, 5], [668, 372, 5], [452, 460, 4], [592, 442, 4], [668, 438, 4]]) {
    g.beginPath();
    g.arc(x, y, r0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // 海报一角被风掀起：一块纸色三角（静态，用来暗示上一阵风）
  g.save();
  g.fillStyle = P.paper;
  g.strokeStyle = P.ink;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(690, 404);
  g.lineTo(690, 468);
  g.lineTo(636, 486);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();

  // ---- 吊牌：从天花板吊下来的一块墨板 ---------------------------------
  const px = 1006;
  const py = lineY(CEIL, px) + 46;
  g.strokeStyle = P.ink;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(px + 26, py);
  g.lineTo(px + 26, lineY(CEIL, px + 26));
  g.moveTo(px + 158, py);
  g.lineTo(px + 158, lineY(CEIL, px + 158));
  g.stroke();
  plate(g, P, { x: px, y: py, w: 184, h: 96, skew: 5, seed: 115 });

  // ---- 站台地面：向左边收的一小条 ------------------------------------
  const plat = [[W + 4, BASE], [W + 4, EDGE + 6], [-4, yL(EDGE + 6)], [-4, yL(BASE)]];
  g.save();
  poly(g, plat);
  g.clip();
  g.strokeStyle = P.mortar;
  g.globalAlpha = 0.42;
  g.lineWidth = 1.8;
  for (let x = 120; x < W; x += 210) {
    g.beginPath();
    g.moveTo(x, lineY(BASE, x));
    g.lineTo(x - 60, lineY(EDGE + 6, x - 60));
    g.stroke();
  }
  hatch(g, { x: 0, y: 700, w: W, h: 220, gap: 46, angle: 42, width: 1.4, color: P.mortar, alpha: 0.22, clip: plat });
  g.restore();

  // ---- 黄线 ----------------------------------------------------------
  mass(g, [[W + 4, EDGE], [W + 4, EDGE + 26], [-4, yL(EDGE + 26)], [-4, yL(EDGE)]], P, {
    amp: 1.6, step: 24, carve: 2.4, seed: 121, fill: 'yellow',
  });

  // ---- 轨道坑：前景的黑 ----------------------------------------------
  const pit = [[W + 4, EDGE + 24], [W + 4, H + 8], [-8, H + 8], [-8, yL(EDGE + 24)]];
  mass(g, pit, P, { amp: 2.4, step: 26, carve: 3.4, seed: 123 });
  g.save();
  poly(g, pit);
  g.clip();
  // 钢轨：两条纸色线，跟着地面一起收
  for (const yR of [1010, 1054]) {
    g.strokeStyle = P.paper;
    g.globalAlpha = 0.72;
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(W + 4, yR);
    g.lineTo(-8, yL(yR));
    g.stroke();
  }
  // 枕木
  g.globalAlpha = 0.2;
  g.lineWidth = 9;
  for (let x = W; x > -60; x -= 82) {
    const t = 1 - x / W;
    const y0 = lineY(EDGE + 26, x);
    g.beginPath();
    g.moveTo(x, y0 + 8 + t * 2);
    g.lineTo(x - 12, y0 + 62);
    g.stroke();
  }
  g.restore();

  // ---- 隧道口：最左边的大黑拱 ----------------------------------------
  const tunnel = () => {
    g.beginPath();
    g.moveTo(-90, 1040);
    g.lineTo(-90, 470);
    g.quadraticCurveTo(-90, 300, 118, 300);
    g.quadraticCurveTo(322, 300, 322, 470);
    g.lineTo(322, 1040);
    g.closePath();
  };
  g.save();
  tunnel();
  g.fillStyle = P.ink;
  g.fill();
  g.strokeStyle = P.paper;
  g.lineWidth = 7;
  g.stroke();
  g.restore();
  // 洞里：一条更黑的底、一盏锈红信号灯
  g.save();
  tunnel();
  g.clip();
  g.fillStyle = P.ink;
  g.fillRect(-90, 300, 420, 760);
  g.globalAlpha = 0.8;
  g.strokeStyle = P.paper;
  g.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.moveTo(180 + i * 22, 330);
    g.lineTo(180 + i * 22, 1040);
    g.globalAlpha = 0.05 + i * 0.02;
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = P.rust;
  g.beginPath();
  g.arc(196, 604, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = P.paper;
  g.globalAlpha = 0.5;
  g.beginPath();
  g.arc(196, 604, 15, 0, Math.PI * 2);
  g.lineWidth = 2;
  g.strokeStyle = P.paper;
  g.stroke();
  g.restore();

  // ---- 长椅（靠墙，右半边） -------------------------------------------
  const bench = [[1430, 800], [1740, 790], [1740, 816], [1430, 828]];
  mass(g, bench, P, { amp: 1.4, step: 20, carve: 2.4, seed: 131 });
  mass(g, [[1430, 766], [1740, 758], [1740, 768], [1430, 778]], P, { amp: 1.1, step: 18, carve: 0, seed: 133 });
  g.save();
  g.strokeStyle = P.ink;
  g.lineWidth = 6;
  for (const bx of [1446, 1718]) {
    g.beginPath();
    g.moveTo(bx, 806);
    g.lineTo(bx + 2, 862);
    g.stroke();
  }
  g.restore();

  // ---- 人落在地上的淡墨（人本身在 render 里画） ------------------------
  g.save();
  g.globalAlpha = 0.15;
  g.fillStyle = P.ink;
  g.beginPath();
  g.ellipse(1216, 846, 118, 17, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  grain(g, W, H, 77);
}

// ---------------------------------------------------------------- render

function drawCup(g, x, y, rot, sc) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(sc, sc);
  mass(g, [[-18, -28], [18, -28], [12, 28], [-12, 28]], P, { amp: 0.9, step: 12, carve: 0, seed: 201, fill: 'paper', edge: P.ink, edgeW: 2.6 });
  g.strokeStyle = P.ink;
  g.lineWidth = 3.2;
  g.beginPath();
  g.moveTo(-18, -28);
  g.quadraticCurveTo(0, -22, 18, -28);
  g.stroke();
  g.save();
  g.beginPath();
  g.rect(-19, -8, 38, 26);
  g.clip();
  hatch(g, { x: -19, y: -8, w: 38, h: 26, gap: 5, angle: 42, width: 1.5, color: P.ink, alpha: 0.7 });
  g.restore();
  g.restore();
}

function drawPaper(g, cx, cy, u, rot, sc) {
  const w = 126 * sc;
  const h = 82 * sc;
  const lift = u;
  const pts = [
    [cx - w / 2, cy - h / 2 - lift * 30],
    [cx + w / 2, cy - h / 2 - lift * 54],
    [cx + w / 2 - lift * 18, cy + h / 2 - lift * 12],
    [cx - w / 2 + lift * 12, cy + h / 2],
  ];
  g.save();
  g.translate(cx, cy);
  g.rotate(rot);
  g.translate(-cx, -cy);
  mass(g, pts, P, { amp: 1.4, step: 16, carve: 0, seed: 205, fill: 'paper', edge: P.ink, edgeW: 2.6 });
  g.strokeStyle = P.ink;
  g.globalAlpha = 0.8;
  g.lineWidth = 1.7;
  for (let i = 0; i < 4; i++) {
    const yy = cy - h / 2 + 15 + i * 15;
    g.beginPath();
    g.moveTo(cx - w / 2 + 14, yy);
    g.lineTo(cx + w / 2 - 22 - i * 7, yy - 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();
}

const easeOut = (v) => 1 - (1 - clamp01(v)) ** 2;

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.drawImage(base, 0, 0, W, H);

  // 吊牌上的数字（全片唯一一处字）
  ctx.drawText('platform', {
    x: 1016, y: lineY(CEIL, 1006) + 68, w: 164, size: 62, weight: 700, family: 'mono', align: 'center',
    color: P.paper, lineHeight: 1, letterSpacing: 6,
  });

  // 报纸：1.5s 起一角翻，2.3s 起离地往右飘
  const pu = clamp01((t - 1.5) / 1.5);
  const pfly = clamp01((t - 2.3) / 1.1);
  const px = 636 + pfly * 320;
  drawPaper(g, px, lineY(EDGE + 4, px) - 40 - smooth(pu) * 40 - easeOut(pfly) * 108, pu, pfly * 0.55, 1 + pfly * 0.1);

  // 纸杯：1.0s 起被推着滚，越滚越快
  const cu = clamp01((t - 1.0) / 2.3);
  const cx = 380 + 640 * cu ** 1.5;
  const bob = -Math.abs(Math.sin(cu * 15)) * 5 * cu;
  drawCup(g, cx, lineY(EDGE + 4, cx) - 34 + bob, cu * 7.6, 1.28 + cu * 0.26);

  // 人：围巾 1.3s 起抬，大衣下摆 2.0s 起鼓
  const lift = smooth((t - 1.3) / 1.9);
  figureBack(g, P, {
    x: 1210, footY: 840, h: 448,
    scarfAngle: lerp(84, -4, lift),
    scarfLen: lerp(0.28, 0.42, lift),
    scarfPhase: t * 5.4,
    scarfAmp: lerp(3, 17, lift),
    flap: 0.013 * smooth((t - 2.0) / 1.2),
    scarfSide: 1,
    seed: 41,
  });

  // 风：从隧道那边推过来的粗刻痕。压在白处用墨、压在黑处用纸。
  // 每一笔有自己的"起风时刻"，所以风是逐渐到的，不是一开始就满屏。
  for (let i = 0; i < gustSeed.length; i++) {
    const s = gustSeed[i];
    const age = t - s.birth;
    if (age < 0) continue;
    const gate = clamp01(age / 0.45);
    const ph = (age * 0.5 + s.off * 0.55 + s.rank * 0.018) % 1.35;
    const x = 90 + ph * 1900;
    const y = s.y + ph * s.dy + Math.sin(ph * 2.4 + i * 1.7) * 9;
    const len = s.len * (0.62 + ph * 0.8);
    const pts = windPath(x, y, len, s.drop, s.lift * (0.55 + ph * 0.8));
    const dark = isCream(x + len * 0.45, y + 6);
    windStroke(g, P, { pts, width: s.w * (0.6 + ph * 0.55), dark, alpha: (s.rank === 0 ? 0.95 : 0.72) * gate });
  }

  // 灰：始终有一点在飘
  for (const m of motes) {
    const x = ((m.x + m.v * t) % (W + 220)) - 110;
    const y = m.y + Math.sin(t * 1.6 + m.x) * 7;
    g.globalAlpha = m.a;
    g.fillStyle = P.ink;
    g.beginPath();
    g.ellipse(x, y, m.s * 2.6, m.s * 0.95, 0.25, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}
