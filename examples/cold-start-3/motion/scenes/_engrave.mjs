// 铜版画（intaglio）画法：这个片子自己的画法，不属于引擎。
//
// 签名三条决定这里的一切：
//   1. 明暗由排线密度承担，没有 blur、没有发光、没有柔边。
//   2. 暖米纸底 + 深赭墨线 + 纸白高光；全片没有纯黑纯白。
//   3. 运动的表达是**重复轮廓线**：同一枚币在不同自转相位的几条轮廓，而不是残影。
//
// 硬币不是贴图，是一个真的三维薄圆盘：
//   盘面基 e1/e2，法线 n，厚度 TH。自转是绕世界 Y 轴转；倾角 beta 让盘面从竖直倒向桌面。
//   所有点用一台针孔相机投影，所以透视、遮挡、影子是同一套几何算出来的。

export const W = 1920;
export const H = 1080;
export const R = 1;
export const TH = 0.11;

/** 指向光源的方向（从物体指向光）——左、上、略偏后。 */
export const LIGHT = norm([-0.72, 0.62, -0.2]);

// ---------- 向量 ----------
function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function addv(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function mul(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function smooth(u) { u = clamp01(u); return u * u * (3 - 2 * u); }

// ---------- 颜色：内部用 [r,g,b]，画的时候再变 css ----------
function hexRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
export function palette(ctx) {
  return {
    paper: hexRgb(ctx.color('bg')),
    ink: hexRgb(ctx.color('fg')),
    sepia: hexRgb(ctx.color('muted')),
    ochre: hexRgb(ctx.color('accent')),
    cold: hexRgb(ctx.color('grid')),
    light: hexRgb(ctx.color('panel')),
  };
}
export function mixC(a, b, t) {
  t = clamp01(t);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
export function css(c, a = 1) {
  const r = Math.round(c[0]), g = Math.round(c[1]), b = Math.round(c[2]);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

// ---------- 相机 ----------
export function makeCam(pos, target, fov = 26) {
  const f = norm(sub(target, pos));
  const r = norm(cross(f, [0, 1, 0]));
  const u = cross(r, f);
  return { pos, target, fov, f, r, u, focal: (H / 2) / Math.tan((fov * Math.PI) / 360) };
}
function toView(cam, p) {
  const v = sub(p, cam.pos);
  return [dot(v, cam.r), dot(v, cam.u), dot(v, cam.f)];
}
function screenOf(cam, v) {
  return [W / 2 + (cam.focal * v[0]) / v[2], H / 2 - (cam.focal * v[1]) / v[2], v[2]];
}
export function project(cam, p) { return screenOf(cam, toView(cam, p)); }

const NEAR = 0.05;

/** 3D 闭合多边形 → canvas path（近平面裁一刀）。返回是否画得出来。 */
export function path3(g, cam, pts, close = true) {
  const vs = pts.map((p) => toView(cam, p));
  const out = [];
  const n = vs.length;
  for (let i = 0; i < n; i++) {
    const a = vs[i], b = vs[(i + 1) % n];
    const ain = a[2] > NEAR, bin = b[2] > NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]);
    }
  }
  if (out.length < 3) return false;
  g.beginPath();
  for (let i = 0; i < out.length; i++) {
    const s = screenOf(cam, out[i]);
    if (i) g.lineTo(s[0], s[1]);
    else g.moveTo(s[0], s[1]);
  }
  if (close) g.closePath();
  return true;
}

/** 3D 线段 → 当前 path 的 moveTo/lineTo（近平面裁剪）。 */
export function line3(g, cam, A, B) {
  let a = toView(cam, A), b = toView(cam, B);
  if (a[2] <= NEAR && b[2] <= NEAR) return;
  if (a[2] <= NEAR) {
    const t = (NEAR - a[2]) / (b[2] - a[2]);
    a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR];
  } else if (b[2] <= NEAR) {
    const t = (NEAR - b[2]) / (a[2] - b[2]);
    b = [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t, NEAR];
  }
  const sa = screenOf(cam, a), sb = screenOf(cam, b);
  g.moveTo(sa[0], sa[1]);
  g.lineTo(sb[0], sb[1]);
}

// ---------- 动作：全片一条时间线，三个镜头只是三台相机 ----------
// 自转 p 是「已经转了多少圈 / 8」，p 在 8.57s 精确到 1，所以币面正好朝着镜头立起来。
const PHI = [
  { s: 0, v: 0, d: 0.265 },
  { s: 3.43, v: 0.675, d: 0.19 },
  { s: 6.86, v: 0.891, d: 0.085 },
  { s: 8.0, v: 0.99, d: 0.035 },
  { s: 8.57, v: 1, d: 0 },
  { s: 10.8, v: 1, d: 0 },
];
const BETA = [
  { s: 0, v: 0.055, d: 0.018 },
  { s: 3.43, v: 0.115, d: 0.05 },
  { s: 6.86, v: 0.34, d: 0.11 },
  { s: 8.0, v: 0.84, d: 0.55 },
  { s: 8.57, v: Math.PI / 2, d: 0 },
  { s: 10.8, v: Math.PI / 2, d: 0 },
];

function hermite(keys, s) {
  if (s <= keys[0].s) return keys[0].v;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (s <= b.s) {
      const h = b.s - a.s;
      const t = (s - a.s) / h;
      const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * a.v + (t3 - 2 * t2 + t) * h * a.d
        + (-2 * t3 + 3 * t2) * b.v + (t3 - t2) * h * b.d;
    }
  }
  return keys[keys.length - 1].v;
}

/** 硬币在某个全局秒的姿态。纯函数。 */
export function pose(s) {
  const p = hermite(PHI, s);
  let beta = hermite(BETA, s);
  // 撞击之后一点点回弹（不改变 p，币面仍然是正的）
  if (s > 8.57) {
    const τ = s - 8.57;
    beta += 0.045 * Math.exp(-τ / 0.16) * Math.sin(τ * Math.PI * 2 * 4.2);
  }
  const phi = p * 8 * Math.PI * 2;
  const e1 = [Math.cos(phi), 0, Math.sin(phi)];
  const e2 = [Math.sin(phi) * Math.sin(beta), Math.cos(beta), -Math.cos(phi) * Math.sin(beta)];
  const n = [-Math.sin(phi) * Math.cos(beta), Math.sin(beta), Math.cos(phi) * Math.cos(beta)];
  const cy = Math.cos(beta) * R + (TH / 2) * Math.sin(beta);
  const wander = 0.035 * Math.sin(beta);
  const cx = wander * Math.sin(phi * 0.5 + 0.4);
  const cz = 0.02 + wander * Math.cos(phi * 0.5 + 0.4);
  return { s, p, phi, beta, e1, e2, n, c: [cx, cy, cz] };
}

/** 盘面朝向镜头的那个面。 */
export function nearFace(st, cam) {
  const front = dot(st.n, sub(cam.pos, st.c)) > 0;
  const m = front ? st.n : mul(st.n, -1);
  const u = st.e1;
  const v = front ? st.e2 : mul(st.e2, -1);
  const center = addv(st.c, mul(m, TH / 2));
  return { front, m, u, v, center };
}

export function facePoint(f, x, y) {
  return addv(f.center, addv(mul(f.u, x), mul(f.v, y)));
}

// ---------- 相机：三个镜头三种运动 ----------
export function camUpright(t) {
  const u = clamp01(t / 3.43);
  const e = smooth(u);
  return makeCam(
    [0.55 - 0.32 * e, 1.28 - 0.02 * e, 6.45 - 0.8 * e],
    [0.04, 0.95, 0],
    26,
  );
}
export function camWobble(t) {
  const u = clamp01(t / 3.43);
  const e = smooth(u);
  return makeCam(
    [0.38 - 0.12 * e, 2.6 + 0.55 * e, 7.0 + 1.15 * e],
    [0.12, 0.74 - 0.28 * e, 0.2 + 0.2 * e],
    28,
  );
}
export function camSettle(t) {
  const u = clamp01(t / 3.94);
  // 先跟着币落下去（镜头下沉、推近），再抬起来看币面。
  const fall = smooth(clamp01(u / 0.434));
  const rise = smooth(clamp01((u - 0.42) / 0.48));
  const breath = clamp01((u - 0.8) / 0.2);
  const z = 5.8 - 1.6 * fall - 0.7 * rise + 0.18 * breath * breath;
  const y = 2.5 - 0.4 * fall + 0.9 * rise - 0.08 * breath * breath;
  const ty = 0.8 - 0.55 * fall - 0.2 * rise;
  return makeCam(
    [0.55 - 0.13 * fall - 0.2 * rise, y, z],
    [0.02, ty, 0.03],
    30,
  );
}

// ---------- 纸、墙、桌 ----------
function paperBase(g, P) {
  g.fillStyle = css(P.paper);
  g.fillRect(0, 0, W, H);
}

function drawWall(g, cam, P, s) {
  const z = -9.0;
  const quad = [[-18, 0, z], [18, 0, z], [18, 12, z], [-18, 12, z]];
  if (!path3(g, cam, quad)) return;
  g.fillStyle = css(mixC(P.paper, P.ochre, 0.1));
  g.fill();
  g.save();
  g.clip();

  // 光不是画上去的，是**少画线**画出来的：窗光落在墙上一块椭圆里，
  // 排线在椭圆里断开，纸白就露出来。铜版画的亮部就是没上墨的纸。
  const pool = { x: -6.2, y: 2.5, rx: 5.6, ry: 2.7 };
  const yRange = (x) => {
    const dx = (x - pool.x) / pool.rx;
    if (Math.abs(dx) >= 1) return null;
    const dy = pool.ry * Math.sqrt(1 - dx * dx);
    return [pool.y - dy, pool.y + dy];
  };
  const xRange = (y) => {
    const dy = (y - pool.y) / pool.ry;
    if (Math.abs(dy) >= 1) return null;
    const dx = pool.rx * Math.sqrt(1 - dy * dy);
    return [pool.x - dx, pool.x + dx];
  };

  // 竖排线：主调子。亮部断掉，暗部密。
  g.beginPath();
  const faint = [];
  for (let x = -13; x <= 13; x += 0.045) {
    const yr = yRange(x);
    if (!yr) {
      line3(g, cam, [x, 0, z], [x, 9.5, z]);
    } else {
      if (yr[0] > 0.05) line3(g, cam, [x, 0.02, z], [x, yr[0], z]);
      if (yr[1] < 9.45) line3(g, cam, [x, yr[1], z], [x, 9.45, z]);
      faint.push([x, yr[0], yr[1]]);
    }
  }
  g.strokeStyle = css(P.ink, 0.22);
  g.lineWidth = 1.1;
  g.stroke();
  g.beginPath();
  for (const [x, a, b] of faint) line3(g, cam, [x, a, z], [x, b, z]);
  g.strokeStyle = css(P.ink, 0.055);
  g.lineWidth = 0.9;
  g.stroke();

  // 横排线：穿过光斑的地方也断开
  g.beginPath();
  const faintH = [];
  for (let y = 0.18; y < 11; y += 0.17) {
    const xr = xRange(y);
    if (!xr) {
      line3(g, cam, [-13, y, z], [13, y, z]);
    } else {
      line3(g, cam, [-13, y, z], [xr[0], y, z]);
      line3(g, cam, [xr[1], y, z], [13, y, z]);
      faintH.push([y, xr[0], xr[1]]);
    }
  }
  g.strokeStyle = css(P.ink, 0.1);
  g.lineWidth = 1.05;
  g.stroke();
  g.beginPath();
  for (const [y, a, b] of faintH) line3(g, cam, [a, y, z], [b, y, z]);
  g.strokeStyle = css(P.ink, 0.045);
  g.lineWidth = 0.9;
  g.stroke();

  // 斜排线：让墙不是灯芯绒；也是暗角
  g.beginPath();
  for (let x = -12.5; x <= 12.5; x += 0.34) {
    line3(g, cam, [x, 0, z], [x + 1.6, 9.2, z]);
  }
  g.strokeStyle = css(P.ink, 0.09);
  g.lineWidth = 1.0;
  g.stroke();

  // 再把光斑整块「擦白」：亮部是没上墨的纸，边界清楚。
  const poolPts = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const wob = 1 + 0.035 * Math.sin(3 * a + 0.7) + 0.02 * Math.sin(5 * a + 2.1);
    poolPts.push([pool.x + Math.cos(a) * pool.rx * wob, pool.y + Math.sin(a) * pool.ry * wob, z + 0.03]);
  }
  if (path3(g, cam, poolPts)) {
    g.fillStyle = css(mixC(P.paper, P.ochre, 0.1));
    g.fill();
  }

  // 上面的暗角：横向加密
  g.beginPath();
  for (let y = 4.6; y < 11; y += 0.16) line3(g, cam, [-13, y, z], [13, y, z]);
  g.strokeStyle = css(P.ink, 0.075);
  g.lineWidth = 1.2;
  g.stroke();

  // 光斑里再补几根极淡的线，纸白不至于死白
  g.beginPath();
  for (let x = pool.x - pool.rx * 0.8; x < pool.x + pool.rx * 0.8; x += 0.34) {
    const yr = yRange(x);
    if (yr) line3(g, cam, [x, yr[0] + 0.1, z], [x, yr[1] - 0.1, z]);
  }
  g.strokeStyle = css(P.ink, 0.04);
  g.lineWidth = 0.8;
  g.stroke();

  g.restore();

  // 墙根：一道压深的线，再加一道更细的
  g.beginPath();
  line3(g, cam, [-14, 0, z], [14, 0, z]);
  g.strokeStyle = css(P.ink, 0.7);
  g.lineWidth = 2.0;
  g.stroke();
  g.beginPath();
  line3(g, cam, [-14, 0.075, z], [14, 0.075, z]);
  g.strokeStyle = css(P.ink, 0.22);
  g.lineWidth = 0.9;
  g.stroke();
}

function drawTable(g, cam, P, s) {
  const zNear = cam.pos[2] - 0.35;
  const quad = [[-15, 0, -9], [15, 0, -9], [15, 0, zNear], [-15, 0, zNear]];
  if (!path3(g, cam, quad)) return;
  g.fillStyle = css(mixC(P.paper, P.ochre, 0.16));
  g.fill();

  g.save();
  g.clip();

  // 桌面的光也是一块「少画线」的椭圆
  const pool = { x: 0.25, z: 0.2, rx: 1.35, rz: 0.95 };
  const xRange = (z) => {
    const dz = (z - pool.z) / pool.rz;
    if (Math.abs(dz) >= 1) return null;
    const dx = pool.rx * Math.sqrt(1 - dz * dz);
    return [pool.x - dx, pool.x + dx];
  };

  // 木纹：一根一根算，但按 6 组一起描。这样线可以很密，也不慢。
  const N = 180;
  const styles = [
    { a: 0.18, w: 1.0 }, { a: 0.28, w: 1.5 }, { a: 0.4, w: 1.2 },
    { a: 0.5, w: 2.2 }, { a: 0.24, w: 1.8 }, { a: 0.34, w: 1.3 },
  ];
  for (let band = 0; band < styles.length; band++) {
    g.beginPath();
    for (let i = band; i < N; i += styles.length) {
      const t = i / (N - 1);
      const zb = (zNear - 0.3) - (zNear - 0.3 + 9) * Math.pow(t, 0.62);
      const phase = i * 1.37;
      const gapA = ((i * 7) % 13) - 6.5;
      const gapW = 0.9 + ((i * 5) % 7) * 0.25;
      const xr = xRange(zb);
      const pts = [];
      for (let x = -15; x <= 15.01; x += 1.1) {
        const zz = zb + 0.034 * Math.sin(x * 0.5 + phase) + 0.017 * Math.sin(x * 1.9 + phase * 1.7)
          + 0.006 * Math.sin(x * 5.1 + phase * 0.6);
        pts.push([x, 0, zz, Math.abs(x - gapA) < gapW, xr && x > xr[0] && x < xr[1]]);
      }
      for (let k = 0; k < pts.length - 1; k++) {
        if (pts[k][3] || pts[k + 1][3] || pts[k][4] || pts[k + 1][4]) continue;
        line3(g, cam, pts[k], pts[k + 1]);
      }
    }
    g.strokeStyle = css(P.ink, styles[band].a);
    g.lineWidth = styles[band].w;
    g.stroke();
  }

  // 整张桌子再压一层 45° 交叉排线。暗部的调子主要靠它。
  g.beginPath();
  for (let d = -H; d < W + H; d += 7) {
    g.moveTo(d, 0);
    g.lineTo(d + H * 0.55, H);
  }
  g.strokeStyle = css(P.ink, 0.16);
  g.lineWidth = 1.25;
  g.stroke();
  g.beginPath();
  for (let d = -H; d < W + H; d += 11) {
    g.moveTo(d, H);
    g.lineTo(d + H * 0.5, 0);
  }
  g.strokeStyle = css(P.ink, 0.08);
  g.lineWidth = 1.0;
  g.stroke();

  // 擦出光斑：亮部是纸，边界是清楚的，不是柔光。
  const poolPts = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const wob = 1 + 0.04 * Math.sin(3 * a + 1.1) + 0.022 * Math.sin(5 * a + 2.7);
    poolPts.push([pool.x + Math.cos(a) * pool.rx * wob, 0.003, pool.z + Math.sin(a) * pool.rz * wob]);
  }
  if (path3(g, cam, poolPts)) {
    g.fillStyle = css(mixC(P.paper, P.ochre, 0.16));
    g.fill();
  }

  // 光斑里的几根淡木纹
  g.beginPath();
  for (let i = 0; i < 11; i++) {
    const zz = pool.z - 0.9 + i * 0.18;
    const xr = xRange(zz);
    if (xr) line3(g, cam, [xr[0] + 0.05, 0, zz], [xr[1] - 0.05, 0, zz]);
  }
  g.strokeStyle = css(P.ink, 0.08);
  g.lineWidth = 0.9;
  g.stroke();

  // 近处再压几根粗线，桌子才有前后
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const zz = zNear - 0.7 - i * 0.4;
    const xr = xRange(zz);
    if (!xr) {
      line3(g, cam, [-14, 0, zz], [14, 0, zz + 0.03]);
    } else {
      line3(g, cam, [-14, 0, zz], [xr[0], 0, zz]);
      line3(g, cam, [xr[1], 0, zz], [14, 0, zz + 0.03]);
    }
  }
  g.strokeStyle = css(P.ink, 0.24);
  g.lineWidth = 2.2;
  g.stroke();

  // 前景的交叉排线：只压屏幕最下面一条，别在桌面上切出几何块
  g.save();
  g.beginPath();
  g.rect(0, H * 0.8, W, H * 0.2);
  g.clip();
  g.beginPath();
  for (let d = -H; d < W + H; d += 8) {
    g.moveTo(d, H);
    g.lineTo(d + H * 0.35, H * 0.72);
  }
  g.strokeStyle = css(P.ink, 0.16);
  g.lineWidth = 1.15;
  g.stroke();
  g.beginPath();
  for (let d = -H; d < W + H; d += 11) {
    g.moveTo(d, H * 0.72);
    g.lineTo(d + H * 0.28, H);
  }
  g.strokeStyle = css(P.ink, 0.09);
  g.lineWidth = 1.0;
  g.stroke();
  // 最底下再密一层
  g.beginPath();
  for (let d = -H; d < W + H; d += 5) {
    g.moveTo(d, H);
    g.lineTo(d + H * 0.28, H * 0.86);
  }
  g.strokeStyle = css(P.ink, 0.09);
  g.lineWidth = 1.2;
  g.stroke();
  g.restore();

  // 桌面上的细小脏点：刻刀痕
  g.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = -6 + ((i * 2.17) % 12);
    const zz = -6 + ((i * 3.31) % 12);
    const p = project(cam, [x, 0.002, zz]);
    g.moveTo(p[0], p[1]);
    g.lineTo(p[0] + 3 + (i % 4) * 2, p[1] + 1.5 * Math.sin(i));
  }
  g.strokeStyle = css(P.ink, 0.22);
  g.lineWidth = 1.0;
  g.stroke();

  g.restore();
}

function drawShadow(g, cam, st, P) {
  // 把币的边缘圆环沿光线投到桌面 y=0 上——这是真的投影，倾斜时自然变长。
  const pts = [];
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    // 边缘故意有点毛：手刻的轮廓不是完美的椭圆
    const rr = R * (1 + 0.006 * Math.sin(i * 2.7) + 0.004 * Math.sin(i * 5.3 + 1.1));
    const p = addv(st.c, addv(mul(st.e1, Math.cos(a) * rr), mul(st.e2, Math.sin(a) * rr)));
    const t = p[1] / LIGHT[1];
    pts.push([p[0] - LIGHT[0] * t, 0.002, p[2] - LIGHT[2] * t]);
  }
  const center = pts.reduce((acc, p) => addv(acc, p), [0, 0, 0]);
  const c = mul(center, 1 / pts.length);
  // 影子：最里面是实墨，外面交给交叉排线。没有柔边。
  if (path3(g, cam, pts)) {
    g.fillStyle = css(mixC(P.ink, P.sepia, 0.5), 0.14);
    g.fill();
  }
  const core = pts.map((p) => addv(c, mul(sub(p, c), 0.55)));
  if (path3(g, cam, core)) {
    g.fillStyle = css(mixC(P.ink, P.sepia, 0.4), 0.34);
    g.fill();
  }
  if (!path3(g, cam, pts)) return;
  g.strokeStyle = css(P.ink, 0.55);
  g.lineWidth = 1.6;
  g.stroke();

  // 影子里的交叉排线：先裁进影子，再画屏幕空间斜线
  g.save();
  if (!path3(g, cam, pts)) { g.restore(); return; }
  g.clip();
  const xs = pts.map((p) => project(cam, p)[0]);
  const ys = pts.map((p) => project(cam, p)[1]);
  const x0 = Math.min(...xs) - 30, x1 = Math.max(...xs) + 30;
  const y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30;
  const w = x1 - x0, h = y1 - y0;
  g.beginPath();
  for (let y = y0 - h * 0.6; y < y1 + h * 0.6; y += 3.8) {
    g.moveTo(x0 - 20, y);
    g.lineTo(x1 + 20, y + h * 0.45);
  }
  g.strokeStyle = css(P.ink, 0.32);
  g.lineWidth = 1.15;
  g.stroke();
  g.beginPath();
  for (let x = x0 - w * 0.4; x < x1 + w * 0.4; x += 8) {
    g.moveTo(x, y0 - 20);
    g.lineTo(x + w * 0.5, y1 + 20);
  }
  g.strokeStyle = css(P.ink, 0.15);
  g.lineWidth = 1;
  g.stroke();
  g.restore();
}

// ---------- 币面浮雕 ----------
function faceToScreen(f, cam, x, y) {
  return project(cam, facePoint(f, x, y));
}

function facePolyline(g, f, cam, pts, close = true) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const s = faceToScreen(f, cam, pts[i][0], pts[i][1]);
    if (i) g.lineTo(s[0], s[1]);
    else g.moveTo(s[0], s[1]);
  }
  if (close) g.closePath();
}

function faceCircle(cx, cy, r, n = 56) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

const NUMERAL = [
  // 竖笔
  [[-0.042, -0.30], [0.042, -0.30], [0.042, 0.22], [-0.042, 0.22]],
  // 左上那一撇：从顶端向左下，是「1」不是「T」
  [[-0.042, 0.22], [-0.215, 0.075], [-0.16, 0.005], [-0.042, 0.115]],
  // 底座
  [[-0.185, -0.30], [0.185, -0.30], [0.185, -0.225], [-0.185, -0.225]],
];

function starPts(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

// 币面上的刻刀痕：固定种子，纯函数
const MARKS = (() => {
  let s = 9137;
  const rnd = () => ((s = (s * 1664525 + 1013904223) | 0), ((s >>> 8) & 0xffffff) / 0x1000000);
  const out = [];
  for (let i = 0; i < 78; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.18 + rnd() * 0.74;
    const len = 0.012 + rnd() * 0.042;
    const ang = a + Math.PI / 2 + (rnd() - 0.5) * 1.3;
    out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, dx: Math.cos(ang) * len, dy: Math.sin(ang) * len });
  }
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 0.15 + rnd() * 0.55;
    const len = 0.22 + rnd() * 0.25;
    const ang = a + Math.PI / 2 + (rnd() - 0.5) * 0.5;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    out.push({ x: x - Math.cos(ang) * len / 2, y: y - Math.sin(ang) * len / 2, dx: Math.cos(ang) * len, dy: Math.sin(ang) * len, light: true });
  }
  return out;
})();

/** 币面设计：外圈、珠圈、桂冠、数字 1、星。 */
function drawFaceDesign(g, f, cam, P, px) {
  const ink = css(P.ink, 0.95);
  const paper = css(P.light);
  const shapes = [];

  // 外圈双线
  shapes.push({ pts: faceCircle(0, 0, 0.962, 72), closed: true, stroke: 0.007, fill: false });
  shapes.push({ pts: faceCircle(0, 0, 0.918, 64), closed: true, stroke: 0.0035, fill: false });

  // 桂冠：两枝从底部向上，开口朝上
  for (const dir of [-1, 1]) {
    const stem = [];
    for (let i = 0; i <= 32; i++) {
      const a = -Math.PI / 2 + dir * (i / 32) * 2.35;
      const r = 0.6 + 0.014 * Math.sin(i * 0.8);
      stem.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    shapes.push({ pts: stem, closed: false, stroke: 0.011, fill: false });
    const veins = [];
    for (let i = 0; i < 11; i++) {
      const t = (i + 0.55) / 11.4;
      const a = -Math.PI / 2 + dir * t * 2.3;
      const r = 0.66;
      const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
      const alongA = a + (dir * Math.PI) / 2 + dir * 0.22;
      const acrossA = alongA + Math.PI / 2;
      const len = i > 8 ? 0.12 : 0.155;
      const wid = 0.026;
      const pts = [];
      for (let k = 0; k <= 7; k++) {
        const u = (k / 7 - 0.5) * len;
        const w = wid * Math.pow(Math.sin((k / 7) * Math.PI), 0.65);
        pts.push([cx + Math.cos(alongA) * u + Math.cos(acrossA) * w,
          cy + Math.sin(alongA) * u + Math.sin(acrossA) * w]);
      }
      for (let k = 7; k >= 0; k--) {
        const u = (k / 7 - 0.5) * len;
        const w = wid * Math.pow(Math.sin((k / 7) * Math.PI), 0.65);
        pts.push([cx + Math.cos(alongA) * u - Math.cos(acrossA) * w,
          cy + Math.sin(alongA) * u - Math.sin(acrossA) * w]);
      }
      shapes.push({ pts, closed: true, stroke: 0.005, fill: true, leaf: true });
      for (const side of [-1, 1]) {
        const w = side * 0.010;
        veins.push([[cx - Math.cos(alongA) * len * 0.32 + Math.cos(acrossA) * w,
          cy - Math.sin(alongA) * len * 0.32 + Math.sin(acrossA) * w],
        [cx + Math.cos(alongA) * len * 0.32 + Math.cos(acrossA) * w,
          cy + Math.sin(alongA) * len * 0.32 + Math.sin(acrossA) * w]]);
      }
    }
    shapes.push({ veins });
  }

  // 数字 1
  for (const n of NUMERAL) shapes.push({ pts: n, closed: true, stroke: 0.006, fill: true });
  // 顶上、底下各一颗小星
  shapes.push({ pts: starPts(0, 0.79, 0.05), closed: true, stroke: 0.003, fill: true });
  shapes.push({ pts: starPts(0, -0.81, 0.028), closed: true, stroke: 0.003, fill: true });

  // 1) 右下的一线墨影（只露一弯，不是整块灰）
  for (const sh of shapes) {
    if (!sh.pts) continue;
    const moved = sh.pts.map(([x, y]) => [x + 0.009, y - 0.01]);
    facePolyline(g, f, cam, moved, sh.closed);
    if (sh.fill) { g.fillStyle = css(P.ink, 0.62); g.fill(); }
    if (sh.stroke) {
      g.strokeStyle = css(P.ink, 0.6);
      g.lineWidth = Math.max(0.5, sh.stroke * px);
      g.stroke();
    }
  }
  // 2) 纸白的浮雕
  for (const sh of shapes) {
    if (!sh.pts) continue;
    facePolyline(g, f, cam, sh.pts, sh.closed);
    if (sh.fill) {
      g.fillStyle = sh.leaf ? css(mixC(P.light, P.ochre, 0.16)) : paper;
      g.fill();
    }
    if (sh.stroke) {
      g.strokeStyle = ink;
      g.lineWidth = Math.max(0.6, sh.stroke * px);
      g.lineJoin = 'round';
      g.stroke();
    }
  }
  // 叶脉
  for (const sh of shapes) {
    if (!sh.veins) continue;
    for (const v of sh.veins) {
      facePolyline(g, f, cam, v, false);
      g.strokeStyle = css(P.ink, 0.6);
      g.lineWidth = Math.max(0.9, 0.0055 * px);
      g.stroke();
    }
  }

  // 数字 1 的右侧压一道暗边，再横着排几根线：浮雕才有厚度
  facePolyline(g, f, cam, [[0.036, -0.29], [0.036, 0.22]], false);
  g.strokeStyle = css(P.ink, 0.45);
  g.lineWidth = Math.max(0.6, 0.004 * px);
  g.stroke();
  for (let y = -0.26; y < 0.2; y += 0.052) {
    facePolyline(g, f, cam, [[-0.03, y], [0.028, y]], false);
    g.strokeStyle = css(P.ink, 0.38);
    g.lineWidth = Math.max(0.8, 0.0035 * px);
    g.stroke();
  }
  for (let i = 0; i < 3; i++) {
    const y = -0.268 + i * 0.012;
    facePolyline(g, f, cam, [[-0.165, y], [0.16, y]], false);
    g.strokeStyle = css(P.ink, 0.32);
    g.lineWidth = Math.max(0.8, 0.0035 * px);
    g.stroke();
  }

  // 珠圈：圆点用虚线圆画，一次成形
  facePolyline(g, f, cam, faceCircle(0, 0, 0.872, 64), true);
  g.setLineDash([0.008 * px, 0.036 * px]);
  g.lineCap = 'round';
  g.strokeStyle = css(P.ink, 0.85);
  g.lineWidth = Math.max(0.8, 0.022 * px);
  g.stroke();
  g.setLineDash([]);
  g.lineCap = 'butt';
}

function drawFace(g, cam, st, P) {
  const f = nearFace(st, cam);
  const ring = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    ring.push(facePoint(f, Math.cos(a), Math.sin(a)));
  }
  if (!path3(g, cam, ring)) return;

  const sc = project(cam, f.center);
  const sx = project(cam, addv(f.center, mul(f.u, 0.1)));
  const px = Math.hypot(sx[0] - sc[0], sx[1] - sc[1]) * 10; // 一个币半径的屏幕像素
  if (px < 1) return;

  // 币面底色：比纸更亮一点，才衬得出纸白的浮雕和暗部的排线
  g.fillStyle = css(mixC(P.light, P.paper, 0.15));
  g.fill();

  g.save();
  if (!path3(g, cam, ring)) { g.restore(); return; }
  g.clip();

  // 屏幕空间的一次上色：左上亮、右下暗（手绘版的阴影，不是柔光）
  const ss = ring.map((p) => project(cam, p));
  const x0 = Math.min(...ss.map((p) => p[0])), x1 = Math.max(...ss.map((p) => p[0]));
  const y0 = Math.min(...ss.map((p) => p[1])), y1 = Math.max(...ss.map((p) => p[1]));
  // 不用渐变。整张币面就是一块纸白，暗部全交给下面的排线。
  g.fillStyle = css(mixC(P.light, P.paper, 0.06));
  g.fillRect(x0 - 10, y0 - 10, x1 - x0 + 20, y1 - y0 + 20);

  // 暗部排线：屏幕空间斜线，越靠右下越密越深
  const diag = Math.hypot(x1 - x0, y1 - y0) || 1;
  const count = 32;
  g.lineWidth = Math.max(1.2, diag * 0.0018);
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const off = t * diag * 1.05;
    g.strokeStyle = css(P.ink, 0.03 + Math.pow(t, 1.5) * 0.55);
    g.beginPath();
    g.moveTo(x0 - 12 + off, y0 - 12);
    g.lineTo(x0 - 12 + off - diag * 0.95, y1 + 12);
    g.stroke();
  }
  // 另一组交叉线，只在最暗的一角
  for (let i = 0; i < 18; i++) {
    const t = i / 17;
    const off = diag * (0.45 + t * 0.6);
    g.strokeStyle = css(P.ink, 0.04 + t * 0.26);
    g.beginPath();
    g.moveTo(x0 - 12 + off, y1 + 12);
    g.lineTo(x0 - 12 + off + diag * 0.9, y0 - 12);
    g.stroke();
  }

  // 车床纹：一圈圈同心线。币面不是一块平色，是车出来的金属。
  for (let i = 0; i < 28; i++) {
    const r = 0.685 + i * 0.0097;
    facePolyline(g, f, cam, faceCircle(0, 0, r, 64), true);
    g.strokeStyle = css(P.ink, 0.09 + (i % 3) * 0.02);
    g.lineWidth = 0.8;
    g.stroke();
  }
  // 外圈那一带做点放射状刻线
  g.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const a0 = faceToScreen(f, cam, Math.cos(a) * 0.895, Math.sin(a) * 0.895);
    const a1 = faceToScreen(f, cam, Math.cos(a) * 0.955, Math.sin(a) * 0.955);
    g.moveTo(a0[0], a0[1]);
    g.lineTo(a1[0], a1[1]);
  }
  g.strokeStyle = css(P.ink, 0.2);
  g.lineWidth = 0.9;
  g.stroke();

  // 币面的刻刀痕 / 划痕
  g.beginPath();
  for (const m of MARKS) {
    const a = faceToScreen(f, cam, m.x, m.y);
    const b = faceToScreen(f, cam, m.x + m.dx, m.y + m.dy);
    g.moveTo(a[0], a[1]);
    g.lineTo(b[0], b[1]);
  }
  g.strokeStyle = css(P.ink, 0.15);
  g.lineWidth = 1;
  g.stroke();

  // 币面浮雕
  drawFaceDesign(g, f, cam, P, px);

  // 纸白高光：左上角顺着圈口几笔，像被擦亮的铜
  for (let k = 0; k < 3; k++) {
    const r = 0.945 - k * 0.035;
    const arc = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (0.62 + (i / 14) * 0.36);
      arc.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    facePolyline(g, f, cam, arc, false);
    g.strokeStyle = css(P.paper, 0.7 - k * 0.16);
    g.lineWidth = Math.max(1, px * (0.012 - k * 0.002));
    g.lineCap = 'round';
    g.stroke();
  }
  g.lineCap = 'butt';
  g.restore();

  // 硬边
  if (path3(g, cam, ring)) {
    g.strokeStyle = css(P.ink, 1);
    g.lineWidth = Math.max(1.4, px * 0.007);
    g.lineJoin = 'round';
    g.stroke();
  }
}

// ---------- 整枚硬币 ----------
export function drawCoin(g, cam, st, P, { ghost = false, alpha = 1 } = {}) {
  const f = nearFace(st, cam);
  const n = f.m;

  // 可见面边缘环（在可见面的平面上）
  const ring = [];
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    ring.push(addv(addv(f.center, mul(f.u, Math.cos(a) * R)), mul(f.v, Math.sin(a) * R)));
  }
  // 另一侧的环（厚度）
  const back = ring.map((p) => addv(p, mul(n, -TH)));

  if (ghost) {
    // 只画轮廓：这就是「重复轮廓线」的运动语言
    g.save();
    g.globalAlpha = alpha;
    if (path3(g, cam, ring)) {
      g.strokeStyle = css(P.sepia, 0.7);
      g.lineWidth = 1.45;
      g.stroke();
    }
    if (path3(g, cam, back)) {
      g.strokeStyle = css(P.sepia, 0.35);
      g.lineWidth = 1.0;
      g.stroke();
    }
    g.restore();
    return;
  }

  // 1) 齿边（厚度带）：每一格按它的外法线受光上色
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2, b = ((i + 1) / 96) * Math.PI * 2;
    const rdir = addv(mul(f.u, Math.cos((a + b) / 2)), mul(f.v, Math.sin((a + b) / 2)));
    const lit = Math.max(0, dot(rdir, LIGHT));
    let col = mixC(mixC(P.ink, P.sepia, 0.16), P.ochre, 0.05 + Math.pow(lit, 1.05) * 0.9);
    if (lit > 0.9) col = mixC(col, P.light, 0.6);
    const A1 = addv(addv(f.center, mul(f.u, Math.cos(a) * R)), mul(f.v, Math.sin(a) * R));
    const A2 = addv(addv(f.center, mul(f.u, Math.cos(b) * R)), mul(f.v, Math.sin(b) * R));
    const B1 = addv(A1, mul(n, -TH)), B2 = addv(A2, mul(n, -TH));
    if (path3(g, cam, [A1, A2, B2, B1], true)) {
      g.fillStyle = css(col);
      g.fill();
    }
  }

  // 2) 齿边刻线（会被正面盖掉，剩下的就是可见那一条）
  g.beginPath();
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const p = addv(addv(f.center, mul(f.u, Math.cos(a) * R)), mul(f.v, Math.sin(a) * R));
    line3(g, cam, p, addv(p, mul(n, -TH)));
  }
  g.strokeStyle = css(P.ink, 0.85);
  g.lineWidth = 1.25;
  g.stroke();
  // 再压一排更细的，齿边才有金属的密
  g.beginPath();
  for (let i = 0; i < 96; i++) {
    const a = ((i + 0.5) / 96) * Math.PI * 2;
    const p = addv(addv(f.center, mul(f.u, Math.cos(a) * R)), mul(f.v, Math.sin(a) * R));
    line3(g, cam, addv(p, mul(n, -TH * 0.18)), addv(p, mul(n, -TH * 0.82)));
  }
  g.strokeStyle = css(P.ink, 0.4);
  g.lineWidth = 0.8;
  g.stroke();

  // 受光那一侧的齿边压一道纸白
  g.beginPath();
  for (let i = 0; i < 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    const rdir = addv(mul(f.u, Math.cos(a)), mul(f.v, Math.sin(a)));
    if (dot(rdir, LIGHT) < 0.88) continue;
    const p = addv(addv(f.center, mul(f.u, Math.cos(a) * R)), mul(f.v, Math.sin(a) * R));
    line3(g, cam, p, addv(p, mul(n, -TH)));
  }
  g.strokeStyle = css(P.light, 0.55);
  g.lineWidth = 1.5;
  g.stroke();

  // 3) 远侧轮廓（剪影的外缘）
  if (path3(g, cam, back)) {
    g.strokeStyle = css(P.ink, 0.7);
    g.lineWidth = 1.2;
    g.stroke();
  }

  // 4) 正面
  drawFace(g, cam, st, P);
}

// ---------- 尘粒 ----------
export function makeMotes(rand) {
  const out = [];
  for (let i = 0; i < 26; i++) {
    out.push({
      x: -2.8 + rand() * 5.4,
      y: 0.25 + rand() * 2.1,
      z: -1.0 + rand() * 3.4,
      r: 1.1 + rand() * 1.9,
      ph: rand() * Math.PI * 2,
      sp: 0.1 + rand() * 0.22,
      bright: rand() > 0.35,
    });
  }
  return out;
}

function drawMotes(g, cam, P, s, motes) {
  for (const m of motes) {
    const t = s * m.sp + m.ph;
    const p = [m.x + 0.09 * Math.sin(t * 0.8), m.y + 0.06 * Math.sin(t * 1.3 + 1), m.z + 0.07 * Math.cos(t * 0.7)];
    const v = toView(cam, p);
    if (v[2] < 0.3) continue;
    const sp = screenOf(cam, v);
    if (sp[0] < 40 || sp[0] > W - 40 || sp[1] < 40 || sp[1] > H - 40) continue;
    g.beginPath();
    g.arc(sp[0], sp[1], m.r * (1 + (s % 7) * 0.01), 0, Math.PI * 2);
    g.fillStyle = m.bright ? css(P.paper, 0.42) : css(P.ink, 0.13);
    g.fill();
  }
}

// ---------- 版痕：全片同一道 ----------
function plateFrame(g, P) {
  const m = 27;
  g.fillStyle = css(P.paper);
  g.fillRect(0, 0, W, m);
  g.fillRect(0, H - m, W, m);
  g.fillRect(0, 0, m, H);
  g.fillRect(W - m, 0, m, H);

  g.strokeStyle = css(P.ink, 0.55);
  g.lineWidth = 1.4;
  g.beginPath();
  const jit = (i) => 0.9 * Math.sin(i * 12.9898) * Math.cos(i * 4.1414);
  let k = 0;
  for (let x = m; x <= W - m; x += 36) { g.moveTo(x, m + jit(k++)); g.lineTo(Math.min(x + 36, W - m), m + jit(k++)); }
  for (let y = m; y <= H - m; y += 36) { g.moveTo(W - m + jit(k++), y); g.lineTo(W - m + jit(k++), Math.min(y + 36, H - m)); }
  for (let x = W - m; x >= m; x -= 36) { g.moveTo(x, H - m + jit(k++)); g.lineTo(Math.max(x - 36, m), H - m + jit(k++)); }
  for (let y = H - m; y >= m; y -= 36) { g.moveTo(m + jit(k++), y); g.lineTo(m + jit(k++), Math.max(y - 36, m)); }
  g.stroke();

  // 纸边上的几点脏
  for (let i = 0; i < 18; i++) {
    const t = (i + 0.5) / 18;
    const edge = i % 4;
    const x = edge < 2 ? m + t * (W - 2 * m) : edge === 2 ? 14 : W - 14;
    const y = edge < 2 ? (edge === 0 ? 14 : H - 14) : m + t * (H - 2 * m);
    g.beginPath();
    g.arc(x, y, 0.7 + 1.1 * Math.abs(Math.sin(i * 3.7)), 0, Math.PI * 2);
    g.fillStyle = css(P.ink, 0.16);
    g.fill();
  }
}

// ---------- 一帧 ----------
export function drawScene(ctx, P, { s, cam, motes, companion = false, ghosts = true }) {
  const g = ctx.canvas.getContext('2d');
  paperBase(g, P);
  drawWall(g, cam, P, s);
  drawTable(g, cam, P, s);

  const st = pose(s);
  drawShadow(g, cam, st, P);

  if (companion) {
    // 另一枚平放的币：尺度参照，也让「旋转」有东西对照
    const cs = {
      s,
      phi: 0.075 * Math.PI * 2,
      beta: Math.PI / 2,
      e1: [Math.cos(0.075 * Math.PI * 2), 0, Math.sin(0.075 * Math.PI * 2)],
      e2: [Math.sin(0.075 * Math.PI * 2), 0, -Math.cos(0.075 * Math.PI * 2)],
      n: [0, 1, 0],
      c: [-2.75, TH / 2, 0.45],
    };
    drawShadow(g, cam, cs, P);
    drawCoin(g, cam, cs, P);
  }

  drawCoin(g, cam, st, P);

  if (ghosts) {
    // 高速自转：同一枚币在几个更早相位的轮廓
    // p 是「已经转了多少圈的 1/8」，换成 rev/s 才是真正的转速
    const speed = ((pose(s).p - pose(Math.max(0, s - 0.02)).p) / 0.02) * 8;
    const amt = clamp01((speed - 0.2) / 1.8);
    if (amt > 0.02) {
      for (let k = 1; k <= 5; k++) {
        const gs = pose(Math.max(0, s - k * 0.014));
        drawCoin(g, cam, gs, P, { ghost: true, alpha: 0.7 * amt * (1 - k / 8) });
      }
    }
  }

  drawMotes(g, cam, P, s, motes);
  plateFrame(g, P);
}
