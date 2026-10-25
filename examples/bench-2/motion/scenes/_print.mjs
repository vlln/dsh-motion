// scenes/_print.mjs — 夜间丝网印（三块版）
//
// 这套画法只有三条规则：
//   1. 形是平涂块，硬边，不渐变、不模糊；
//   2. 光只用网点画（点大=亮，点小=暗）；网点 sprite 在 mount() 里预渲染；
//   3. 三块版对不准：骨白偏 (-3,-2)，钠黄偏 (+5,-3)，错开的地方露出底下的墨。
//
// 全片共用一个色板、一个纸边、一个套印偏移量。

export const W = 1920;
export const H = 1080;

export const C = {
  ink: '#12100f', // 墨：底
  deep: '#0a0908', // 更深的墨：洞、车体阴影
  struct: '#2a221e', // 结构中间调：墙
  structLite: '#2f2620', // 地面（比墙亮一点）
  flat: '#1a1512', // 车体、暗块
  grout: '#4a3a2d', // 瓷砖缝
  amber: '#f0a63c', // 钠黄：光
  amberDim: '#a4661f', // 黄版的暗面 / 套印鬼影
  bone: '#f4ecdd', // 骨白：亮边、纸、围巾、风痕
  boneDim: '#c9bda6', // 骨白的第二级
  red: '#8a2f22', // 哑红：只做小面积
  paper: '#b3a68f', // 印张的纸边
};

// --- 数 -------------------------------------------------------------------

export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const lerp = (a, b, p) => a + (b - a) * p;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => clamp(v, 0, 1);
export const smooth = (p) => {
  const x = clamp01(p);
  return x * x * (3 - 2 * x);
};
export const easeOut = (p) => 1 - (1 - clamp01(p)) ** 3;
export const easeInOut = (p) => {
  const x = clamp01(p);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
/** 0→1→0 的窗：rise 秒进，hold 秒停，fall 秒出。 */
export function win(t, at, rise = 0.2, hold = 0.4, fall = 0.3) {
  if (t < at) return 0;
  const d = t - at;
  if (d < rise) return smooth(d / rise);
  if (d < rise + hold) return 1;
  if (d < rise + hold + fall) return 1 - smooth((d - rise - hold) / fall);
  return 0;
}

// --- 网点 -----------------------------------------------------------------

/**
 * 一张网点光斑：中心点大、边缘点小，中心压一个实心的高光核。
 * 只建一次，render 里 drawImage —— 每帧不重算。
 */
export function makeGlow({
  w = 640,
  h = 640,
  step = 14,
  angle = 0.28,
  color = C.amber,
  hot = C.bone,
  hotR = 0.26,
  power = 0.62,
  jitter = 0.22,
  seed = 7,
} = {}) {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w);
  cv.height = Math.ceil(h);
  const g = cv.getContext('2d');
  const rng = mulberry32(seed);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  g.fillStyle = color;
  const reach = Math.max(w, h);
  for (let gy = -reach; gy < reach * 2; gy += step) {
    for (let gx = -reach; gx < reach * 2; gx += step) {
      const dx0 = gx - cx;
      const dy0 = gy - cy;
      const x = cx + dx0 * ca - dy0 * sa;
      const y = cy + dx0 * sa + dy0 * ca;
      if (x < -step || y < -step || x > w + step || y > h + step) continue;
      const d = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (d >= 1) continue;
      // 边缘点随机缺席：光斑的边不能是一个规整的圆
      if (d > 0.78 && rng() < (d - 0.78) * 3.4) continue;
      const r = step * 0.73 * Math.pow(1 - d, power) * (1 + (rng() - 0.5) * jitter);
      if (r < 0.3) continue;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  // 高光核：一块实心骨白，边缘故意留几个缺口（版子边）
  if (hotR > 0) {
    g.fillStyle = hot;
    g.beginPath();
    const n = 46;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const k = 1 + (rng() - 0.5) * 0.16;
      const px = cx + Math.cos(a) * rx * hotR * k;
      const py = cy + Math.sin(a) * ry * hotR * k;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.closePath();
    g.fill();
  }
  return cv;
}

/** 把 sprite 的中心放在 (cx,cy)，缩放 s。 */
export function blit(g, cv, cx, cy, s = 1, alpha = 1) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha *= alpha;
  g.drawImage(cv, cx - (cv.width * s) / 2, cy - (cv.height * s) / 2, cv.width * s, cv.height * s);
  g.restore();
}

/** 一张 k 倍大的底图；draw 用设计坐标 0..W / 0..H。 */
export function stillAt(ctx, k, draw) {
  return ctx.still((g) => draw(g), { scale: k });
}

/** 底图按镜头缩放贴回：z=1 原样，z>1 推近。 */
export function plate(g, base, { z = 1, cx = W / 2, cy = H / 2 } = {}) {
  g.save();
  g.translate(cx, cy);
  g.scale(z, z);
  g.translate(-cx, -cy);
  g.drawImage(base, 0, 0, W, H);
  g.restore();
}

// --- 形 -------------------------------------------------------------------

/** 带抖动的多边形：amp 是版子边的毛刺，不是装饰。 */
export function fillPoly(g, pts, color, { amp = 0, seed = 1, close = true } = {}) {
  const rng = mulberry32(seed);
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = amp ? (rng() - 0.5) * amp : 0;
    const jy = amp ? (rng() - 0.5) * amp : 0;
    i ? g.lineTo(x + jx, y + jy) : g.moveTo(x + jx, y + jy);
  });
  if (close) g.closePath();
  g.fillStyle = color;
  g.fill();
}

/** 锥形刀痕：风的基本笔画。 */
export function taper(g, x1, y1, x2, y2, w1, w2, color, alpha = 1) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (L < 0.5) return;
  const nx = -dy / L;
  const ny = dx / L;
  g.save();
  g.globalAlpha *= alpha;
  g.beginPath();
  g.moveTo(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);
  g.lineTo(x2 + (nx * w2) / 2, y2 + (ny * w2) / 2);
  g.lineTo(x2 - (nx * w2) / 2, y2 - (ny * w2) / 2);
  g.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.restore();
}

/** 纸边：画面四周的印张出血线。全片一样宽。 */
export function paperEdge(g, w = 14) {
  g.fillStyle = C.paper;
  g.fillRect(0, 0, W, w);
  g.fillRect(0, H - w, W, w);
  g.fillRect(0, 0, w, H);
  g.fillRect(W - w, 0, w, H);
}

// --- 纸片 -----------------------------------------------------------------

/**
 * 一张纸：骨白的四边形 + 一道折痕 + 三行印上去的假字。
 * 折痕用黄的暗面，等于第二块版。
 */
export function scrap(g, x, y, s, rot = 0, flip = 1, { color = C.bone, ink = C.ink, fold = C.amberDim, squash = 1, lines = true } = {}) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, flip * s * squash);
  fillPoly(g, [
    [-50, -34],
    [50, -40],
    [44, 36],
    [-52, 30],
  ], color, { amp: 3, seed: 11 });
  fillPoly(g, [
    [10, -38],
    [50, -40],
    [44, 36],
  ], fold, { amp: 2, seed: 12 });
  if (lines) {
    g.strokeStyle = ink;
    g.lineWidth = 3;
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.moveTo(-36, -14 + i * 18);
      g.lineTo(i === 1 ? 4 : 24, -14 + i * 18);
      g.stroke();
    }
  }
  g.restore();
}
