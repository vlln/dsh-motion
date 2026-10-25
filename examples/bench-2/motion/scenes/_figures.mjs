// scenes/_figures.mjs — 人只给背影：远处站着的背影、后颈和肩、围巾。
//
// 没有脸、没有五官、没有手指。按 howto/角色.md 的降级条款：没有生图能力就只出手和背影。
// 轮廓靠「骨白版偏移 -3,-2 → 墨版压在上面」做出亮边，这就是套印没对准的那一线。

import { C, lerp, fillPoly } from './_print.mjs';

/** 一条由点到点、从深到浅（宽到窄）的带子。围巾、纸带都用它。 */
export function ribbon(g, pts, w0, w1, color, { taperPow = 0.85, alpha = 1 } = {}) {
  const n = pts.length;
  if (n < 2) return;
  const L = [];
  const R = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1;
    const w = lerp(w0, w1, Math.pow(i / (n - 1), taperPow)) / 2;
    L.push([p[0] - (dy / d) * w, p[1] + (dx / d) * w]);
    R.push([p[0] + (dy / d) * w, p[1] - (dx / d) * w]);
  }
  g.save();
  g.globalAlpha *= alpha;
  g.beginPath();
  L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.restore();
}

/**
 * 围巾尾巴的采样点。angle 是从「正左方」往下量的弧度（0=横飞，1.1=垂下）；
 * sag 是中间下垂的量，让布不是一根直线。
 */
export function tailPts(px, py, angle, len, { n = 16, sag = 0, twist = 0 } = {}) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const p = i / n;
    const a = angle * (0.68 + 0.32 * p) + twist * Math.sin(p * Math.PI) * 0.12;
    const r = len * p;
    pts.push([px - Math.cos(a) * r, py + Math.sin(a) * r + sag * Math.sin(Math.PI * p)]);
  }
  return pts;
}

/** 远处站着的背影：h 是总高（头顶到脚底）。只给背影，没有脸。 */
export function standBack(g, { x, feetY, h, scarfAngle = 1.1, sway = 0, coat = '#201915' } = {}) {
  const headR = h * 0.053;
  const headY = feetY - h * 0.945;
  const neckY = feetY - h * 0.858;
  const shoulderY = feetY - h * 0.805;
  const hemY = feetY - h * 0.35;
  const s = sway * h * 0.012;

  // 腿和鞋：比大衣再深一档
  fillPoly(g, [
    [x - h * 0.078, hemY - h * 0.01],
    [x - h * 0.012, hemY - h * 0.01],
    [x - h * 0.022, feetY - h * 0.01],
    [x - h * 0.086, feetY - h * 0.01],
  ], '#141110', { amp: 1, seed: 33 });
  fillPoly(g, [
    [x + h * 0.012, hemY - h * 0.01],
    [x + h * 0.078, hemY - h * 0.01],
    [x + h * 0.086, feetY - h * 0.01],
    [x + h * 0.022, feetY - h * 0.01],
  ], '#141110', { amp: 1, seed: 34 });
  fillPoly(g, [[x - h * 0.09, feetY - h * 0.012], [x - h * 0.02, feetY - h * 0.012], [x - h * 0.014, feetY], [x - h * 0.1, feetY]], '#0d0b0a', { amp: 1, seed: 35 });
  fillPoly(g, [[x + h * 0.02, feetY - h * 0.012], [x + h * 0.088, feetY - h * 0.012], [x + h * 0.096, feetY], [x + h * 0.016, feetY]], '#0d0b0a', { amp: 1, seed: 36 });

  // 大衣
  const body = [
    [x - h * 0.128 - s, neckY],
    [x - h * 0.162, shoulderY + h * 0.01],
    [x - h * 0.142, hemY],
    [x + h * 0.152 + s * 1.5, hemY - h * 0.008],
    [x + h * 0.158, shoulderY + h * 0.01],
    [x + h * 0.128 + s, neckY],
  ];
  fillPoly(g, body, coat, { amp: 1.6, seed: 31 });

  // 亮边：只在大衣的左轮廓上一线（灯在左上）
  g.beginPath();
  g.moveTo(x - h * 0.128 - s, neckY);
  g.quadraticCurveTo(x - h * 0.17, shoulderY, x - h * 0.142, hemY);
  g.strokeStyle = C.boneDim;
  g.lineWidth = Math.max(1.6, h * 0.007);
  g.stroke();

  // 头、发髻
  g.beginPath();
  g.ellipse(x, headY, headR * 0.9, headR, 0, 0, Math.PI * 2);
  g.fillStyle = C.ink;
  g.fill();
  g.beginPath();
  g.arc(x + headR * 0.62, headY + headR * 0.1, headR * 0.46, 0, Math.PI * 2);
  g.fillStyle = '#0b0908';
  g.fill();
  g.beginPath();
  g.arc(x, headY, headR * 0.92, Math.PI * 1.02, Math.PI * 1.6);
  g.strokeStyle = C.boneDim;
  g.lineWidth = Math.max(1.4, h * 0.006);
  g.stroke();

  // 围巾：脖子上一条，尾端往左飘。黄版先垫一层鬼影。
  const band = [
    [x - h * 0.085, neckY + h * 0.004],
    [x - h * 0.03, neckY - h * 0.018],
    [x + h * 0.045, neckY - h * 0.019],
    [x + h * 0.088, neckY + h * 0.006],
    [x + h * 0.08, neckY + h * 0.032],
    [x - h * 0.08, neckY + h * 0.03],
  ];
  const tail = tailPts(x - h * 0.06, neckY + h * 0.022, scarfAngle, h * 0.36, { n: 16, sag: h * 0.035 });
  g.save();
  g.translate(3, -2);
  g.globalAlpha = 0.85;
  fillPoly(g, band, C.amberDim, { amp: 1.4, seed: 5 });
  ribbon(g, tail, h * 0.05, h * 0.017, C.amberDim);
  g.restore();
  fillPoly(g, band, C.bone, { amp: 1.4, seed: 5 });
  ribbon(g, tail, h * 0.047, h * 0.015, C.bone);
}

/**
 * 画面右缘的近景背影：肩、后颈、发髻、围巾。其余裁在画外。
 * 围巾从脖子（约 1720,350）飞出去，angle=0 是横飞，>0 是往下垂。
 */
export function croppedBack(g, { scarfAngle = 0.9, flutter = 0, rim = C.bone, body = C.deep } = {}) {
  const coat = [
    [1920, -120],
    [1892, 96],
    [1816, 236],
    [1748, 320],
    [1688, 372],
    [1596, 452],
    [1552, 560],
    [1538, 700],
    [1568, 862],
    [1612, 1000],
    [1642, 1080],
    [1920, 1080],
  ];
  const head = [1816, 168, 138];
  const bun = [1740, 238, 78];

  // 骨白版：整体偏 (-5,-3) —— 画面上只留左上一线，就是灯照出来的边
  g.save();
  g.translate(-5, -3);
  fillPoly(g, coat, rim, { amp: 2.2, seed: 21 });
  g.beginPath();
  g.arc(head[0], head[1], head[2], 0, Math.PI * 2);
  g.fillStyle = rim;
  g.fill();
  g.beginPath();
  g.arc(bun[0], bun[1], bun[2], 0, Math.PI * 2);
  g.fill();
  g.restore();

  // 墨版
  fillPoly(g, coat, body, { amp: 0, seed: 21 });
  g.beginPath();
  g.arc(head[0], head[1], head[2], 0, Math.PI * 2);
  g.fillStyle = body;
  g.fill();
  g.beginPath();
  g.arc(bun[0], bun[1], bun[2], 0, Math.PI * 2);
  g.fillStyle = C.ink;
  g.fill();
  // 发髻上的高光
  g.beginPath();
  g.arc(bun[0] - 22, bun[1] - 26, bun[2] * 0.66, Math.PI * 0.95, Math.PI * 1.55);
  g.strokeStyle = C.amberDim;
  g.lineWidth = 8;
  g.stroke();

  // 肩线上的钠光：一条实心黄
  g.strokeStyle = C.amber;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(1578, 468);
  g.quadraticCurveTo(1660, 392, 1788, 300);
  g.stroke();

  // 围巾：脖子上一坨 + 两条尾巴（黄版先偏 4,-3 垫一层）
  const knot = [
    [1660, 330],
    [1728, 300],
    [1806, 318],
    [1836, 372],
    [1800, 424],
    [1716, 432],
    [1652, 400],
  ];
  const a1 = scarfAngle + flutter;
  const a2 = scarfAngle * 1.18 + 0.1 + flutter * 1.4;
  const t1 = tailPts(1672, 392, a1, 560, { n: 22, sag: 10 + 22 * Math.max(0, scarfAngle) });
  const t2 = tailPts(1666, 372, a2, 372, { n: 18, sag: 14 + 16 * Math.max(0, scarfAngle) });

  g.save();
  g.translate(4, -3);
  g.globalAlpha = 0.92;
  fillPoly(g, knot, C.amberDim, { amp: 2, seed: 5 });
  ribbon(g, t2, 40, 15, C.amberDim);
  g.restore();
  fillPoly(g, knot, C.bone, { amp: 2, seed: 5 });
  ribbon(g, t2, 38, 13, C.boneDim);
  ribbon(g, t1, 46, 18, C.bone);
  // 围巾上的折：一条黄的暗面细线
  const t3 = t1.map(([x, y], i) => [x, y + 7 - i * 0.12]);
  ribbon(g, t3.slice(4), 12, 5, C.amberDim, { alpha: 0.8 });
}
