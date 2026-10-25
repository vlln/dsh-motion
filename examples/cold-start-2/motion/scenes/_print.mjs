// 画法：木刻／麻胶版画，三色套印。
//
// 形不是"描边再填充"，是**一整块墨，再从上头刻掉要白的地方**：
//   mass()  画一块有刀口抖动的墨块，顺手沿着轮廓刻一道纸色的沟；
//   hatch() 平行排线，角度全片固定 42°（刀的方向不换，换的只有密度）；
//   ribbon()/figureBack() 是人身上的形，宽度收尖、边缘有缺口；
//   paper()  纸纤维垫底；dots() 是给"光"用的点阵（黄版压在纸上）。
//
// 这个文件只属于本片：不往引擎里加，也不改 kit/。

export const W = 1920;
export const H = 1080;
export const DEG = Math.PI / 180;

export function pal(ctx) {
  return {
    paper: ctx.color('bg'),
    ink: ctx.color('fg'),
    yellow: ctx.color('accent'),
    rust: ctx.color('panel'),
    grey: ctx.color('muted'),
    mortar: ctx.color('grid'),
  };
}

/** Deterministic LCG. render(t) is a pure function, so nothing here may use Math.random. */
export function mk(seed = 1) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 8) & 0xffffff) / 0x1000000;
  };
}

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smooth = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
export const easeOut = (v) => 1 - (1 - clamp01(v)) ** 2.2;
export const lerp = (a, b, t) => a + (b - a) * t;

const FIBRE_DARK = 'rgba(112,98,72,0.055)';
const FIBRE_LIGHT = 'rgba(255,250,235,0.05)';
const INK_PIT = 'rgba(232,224,203,0.07)';

/** 纸：米色底 + 5200 根纤维 + 落墨点。一次画好，之后只贴。 */
export function paper(g, w, h, P, seed = 7) {
  g.fillStyle = P.paper;
  g.fillRect(0, 0, w, h);
  const r = mk(seed);
  g.lineCap = 'round';
  for (let i = 0; i < 5200; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = (r() - 0.5) * 0.9 + (r() < 0.5 ? 0.35 : -0.35);
    const len = 5 + r() * 24;
    g.strokeStyle = r() < 0.55 ? FIBRE_DARK : FIBRE_LIGHT;
    g.lineWidth = 0.8 + r() * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.6 ? FIBRE_DARK : FIBRE_LIGHT;
    g.beginPath();
    g.arc(r() * w, r() * h, 0.6 + r() * 1.3, 0, Math.PI * 2);
    g.fill();
  }
}

/** 一整块墨上再落一层纸点点：油墨没吃满的地方，只在底图上用一次。 */
export function grain(g, w, h, seed = 3) {
  const r = mk(seed);
  g.globalAlpha = 0.8;
  g.fillStyle = INK_PIT;
  for (let i = 0; i < 1700; i++) {
    g.beginPath();
    g.arc(r() * w, r() * h, 0.5 + r() * 1.4, 0, Math.PI * 2);
    g.fill();
  }
}

/** 点阵：给"光"用。预生成一张，render 里裁切着贴。 */
export function dotField(w, h, gap, radius, color, seed = 5) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const r = mk(seed);
  g.fillStyle = color;
  for (let y = gap * 0.5; y < h; y += gap) {
    for (let x = gap * 0.5; x < w; x += gap) {
      const rr = radius * (0.72 + r() * 0.5);
      g.beginPath();
      g.arc(x + (r() - 0.5) * 2, y + (r() - 0.5) * 2, rr, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

/** 沿多边形边界重采样并抖动：木刻的边没有一条是直的。 */
export function roughen(pts, step, amp, rand) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.round(d / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      out.push([a[0] + (b[0] - a[0]) * t + (rand() - 0.5) * amp, a[1] + (b[1] - a[1]) * t + (rand() - 0.5) * amp]);
    }
  }
  return out;
}

export function poly(g, pts) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/**
 * 一块墨。fill 后沿轮廓刻一道纸色沟（carve）——这就是版画里"线"的来源。
 */
export function mass(g, pts, P, { amp = 2.4, step = 26, carve = 3.6, seed = 1, fill = 'ink', alpha = 1, edge = null, edgeW = 2.4 } = {}) {
  const r = mk(seed);
  const p = roughen(pts, step, amp, r);
  g.save();
  g.globalAlpha = alpha;
  poly(g, p);
  g.fillStyle = P[fill];
  g.fill();
  if (carve > 0) {
    g.strokeStyle = P.paper;
    g.lineWidth = carve;
    g.lineJoin = 'round';
    g.stroke();
  }
  if (edge) {
    g.strokeStyle = edge;
    g.lineWidth = edgeW;
    g.lineJoin = 'round';
    g.stroke();
  }
  g.restore();
}

/** 平行排线（刀痕）。clip 传一个多边形，线只留在里面。 */
export function hatch(g, { x, y, w, h, gap = 10, angle = 42, width = 2, color, alpha = 1, clip = null, dash = 0 }) {
  g.save();
  if (clip) {
    poly(g, clip);
    g.clip();
  }
  g.translate(x + w / 2, y + h / 2);
  g.rotate(angle * DEG);
  const R = Math.hypot(w, h) / 2 + 2;
  g.beginPath();
  for (let d = -R; d <= R; d += gap) {
    const s = dash ? (d / gap) % 2 : 0;
    if (dash && Math.abs((d / gap) % 2) > 1) continue;
    g.moveTo(d, -R + s * 6);
    g.lineTo(d, R);
  }
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineWidth = width;
  g.stroke();
  g.restore();
}

/**
 * 风：一笔粗的。压在白处用墨，压在黑处用纸 —— 不是"白边黑芯"那种细线，
 * 那种线在版画里读成划痕，读不出风。
 * pts 是中心线；width 为笔宽；dark 决定这一笔是墨还是纸。
 */
export function windStroke(g, P, { pts, width = 12, dark = true, alpha = 0.95, head = 0 }) {
  if (pts.length < 2) return;
  const left = [];
  const right = [];
  for (let i = 0; i < pts.length; i++) {
    const s = i / (pts.length - 1);
    // 笔锋：起笔细、走笔粗、收笔尖
    const w = width * (0.18 + 0.82 * Math.sin(Math.PI * Math.min(1, s * 1.06)) ** 0.55) * (1 - head * (1 - s) * 0.5);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    left.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]);
    right.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
  }
  const body = [...left, ...right.reverse()];
  g.save();
  g.globalAlpha = alpha;
  poly(g, body);
  g.fillStyle = dark ? P.ink : P.paper;
  g.fill();
  g.restore();
}

/** 一笔风折成 pts：从 (x,y) 向右上走，末端翘起来。 */
export function windPath(x, y, len, drop, lift, n = 10) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    pts.push([x + len * s, y + drop * s + lift * s * s]);
  }
  return pts;
}

/** 一条布：中心线走 angle、法向按正弦摆，宽度两端收尖。 */
export function ribbon(g, { x, y, len, angle, w0, w1, waves = 1.6, amp = 14, phase = 0, color, edge, seed = 9, taper = 0.35 }) {
  const n = 16;
  const pts = [];
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const off = Math.sin(s * waves * Math.PI * 2 + phase) * amp * s ** 0.75;
    pts.push([x + Math.cos(angle) * len * s + nx * off, y + Math.sin(angle) * len * s + ny * off]);
  }
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    const w = lerp(w0, w1, s) * Math.min(1, s * 7 + 0.15) * Math.min(1, (1 - s) * (1 / taper) + 0.1);
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    left.push([pts[i][0] - (dy / l) * w, pts[i][1] + (dx / l) * w]);
    right.push([pts[i][0] + (dy / l) * w, pts[i][1] - (dx / l) * w]);
  }
  const body = [...left, ...right.reverse()];
  const r = mk(seed);
  const carved = roughen(body, 15, 1.7, r);
  g.save();
  // 套色错位：锈红版整体偏 (+3,−2)，墨线还在原位 —— 错开的地方露纸。
  g.translate(3, -2);
  poly(g, carved);
  g.fillStyle = color;
  g.fill();
  g.restore();
  if (edge) {
    poly(g, carved);
    g.strokeStyle = edge;
    g.lineWidth = 2.2;
    g.lineJoin = 'round';
    g.stroke();
  }
}

/** 背影男人：后脑、肩、大衣、围巾、腿、靴。没有脸，没有转身。 */
export function figureBack(g, P, { x, footY, h, flap = 0, lean = 0, seed = 21, scarfAngle = 84, scarfLen = 0.42, scarfPhase = 0, scarfAmp = 10, scarfW = 9, scarfSide = 1 }) {
  const u = (v) => v * h;
  const p = (px, py) => [x + u(px) + lean * u(-py - 0.6), footY + u(py)];

  // 腿：两条收尖的柱，靴子压在最下面
  for (const s of [-1, 1]) {
    const a = 0.062 * s;
    mass(g, [p(a - 0.043, -0.39), p(a + 0.043, -0.39), p(a + 0.05, -0.03), p(a - 0.05, -0.03)], P, {
      amp: 1.6, step: 22, carve: 2, seed: seed + s,
    });
    mass(g, [p(a - 0.056, -0.035), p(a + 0.062, -0.035), p(a + 0.075, 0.0), p(a - 0.07, 0.0)], P, {
      amp: 1.4, step: 18, carve: 0, seed: seed + 7 + s,
    });
  }

  // 大衣：肩 → 下摆（下摆被风顶起来 → flap）
  const coat = [
    p(-0.128, -0.795), p(-0.104, -0.862), p(0, -0.884), p(0.104, -0.862), p(0.128, -0.795),
    p(0.138, -0.7), p(0.163 + flap, -0.43), p(0.158 + flap * 0.8, -0.383),
    p(0.05, -0.372), p(-0.05, -0.372), p(-0.158, -0.383), p(-0.163, -0.43), p(-0.138, -0.7),
  ];
  mass(g, coat, P, { amp: 2.4, step: 24, carve: 3.4, seed: seed + 1 });

  // 大衣里刻几道沟：脊线、肩胛、下摆的褶
  g.save();
  g.strokeStyle = P.paper;
  g.lineWidth = 2.6;
  g.lineCap = 'round';
  for (const [x0, y0, x1, y1, x2, y2] of [
    [-0.09, -0.78, -0.11, -0.68, -0.12, -0.6],
    [0.09, -0.78, 0.112, -0.68, 0.118, -0.6],
    [-0.07, -0.44, -0.05, -0.47, -0.03, -0.5],
  ]) {
    g.beginPath();
    g.moveTo(...p(x0, y0));
    g.quadraticCurveTo(...p(x1, y1), ...p(x2, y2));
    g.stroke();
  }
  g.restore();

  // 后脑：一块墨，顶上刻出帽子的一道弧
  mass(g, [
    p(-0.072, -0.9), p(-0.062, -0.962), p(0, -0.982), p(0.062, -0.962), p(0.072, -0.9),
    p(0.06, -0.845), p(0, -0.828), p(-0.06, -0.845),
  ], P, { amp: 1.8, step: 16, carve: 2.6, seed: seed + 2 });
  g.save();
  g.strokeStyle = P.paper;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(...p(-0.066, -0.925));
  g.quadraticCurveTo(...p(0, -0.947), ...p(0.066, -0.925));
  g.stroke();
  g.restore();

  // 围巾：一圈锈红压在肩上（错位套色），尾巴从左边甩出去
  const knot = p(0.105 * scarfSide, -0.843);
  if (scarfLen > 0) {
    ribbon(g, {
      x: knot[0], y: knot[1], len: u(scarfLen), angle: scarfAngle * DEG,
      w0: scarfW, w1: scarfW * 0.62, waves: 1.7, amp: scarfAmp, phase: scarfPhase,
      color: P.rust, edge: P.ink, seed: seed + 4,
    });
  }
  ribbon(g, {
    x: x - u(0.112), y: footY - u(0.858), len: u(0.232), angle: -1.5 * DEG,
    w0: 7.5, w1: 6.5, waves: 0.3, amp: 1.6, phase: 0, color: P.rust, edge: P.ink, seed: seed + 5, taper: 0.45,
  });
}

/** 站台吊牌：一块墨板，纸色的数字由 drawText 画上去（不画字，只画板）。 */
export function plate(g, P, { x, y, w, h, skew = 0, seed = 31 }) {
  mass(g, [[x, y + skew], [x + w, y], [x + w, y + h], [x, y + h + skew]], P, { amp: 1.6, step: 20, carve: 3, seed });
  // 板上一道刻沟，像框
  g.save();
  g.strokeStyle = P.paper;
  g.lineWidth = 1.6;
  g.globalAlpha = 0.75;
  g.strokeRect(x + 7, y + 7 + skew * 0.6, w - 14, h - 14);
  g.restore();
}
