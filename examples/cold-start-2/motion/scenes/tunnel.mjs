// 镜头二：隧道口（3.4–7.2s）
//
// 机位搬到轨道里，正对洞口。物：隧道拱、拱圈的锈红楔石、道床与两条钢轨、站台的一角。
// 动作：黑洞口里的车头灯从针尖涨满，把洞壁的肋一道一道点出来；
//       然后车头从灯的四周**长出来**——黑包着白，朝镜头压过来。
// 缓推 1.00→1.09。风在这镜里只剩痕和飞过的碎纸，人不在。

import { W, H, DEG, pal, mk, paper, grain, mass, hatch, poly, windStroke, windPath, plate, clamp01, smooth, lerp } from './_print.mjs';

export const id = 'tunnel';

const CX = 720; // 拱心
const SPRING = 700; // 拱脚线
const R_IN = 452; // 拱内半径
const LAMP = { x: 700, y: 790 }; // 车头灯（还在洞里，比道床高一点）

let ctx;
let P;
let base = null;
let debris = [];
let motes = [];
let wind = [];

export function mount(context) {
  ctx = context;
  P = pal(ctx);
  const r = mk(517);
  debris = [];
  for (let i = 0; i < 9; i++) {
    debris.push({ y: 300 + r() * 760, s: 0.5 + r() * 1.1, off: r(), rot: r() * 6.28, spin: (r() - 0.5) * 9, v: 0.55 + r() * 0.6 });
  }
  motes = [];
  for (let i = 0; i < 40; i++) {
    motes.push({ x: r() * W, y: 200 + r() * 880, s: 1 + r() * 2.6, v: 90 + r() * 260, a: 0.1 + r() * 0.3 });
  }
  wind = [];
  for (let i = 0; i < 12; i++) {
    wind.push({ y: 240 + r() * 800, off: r(), birth: 0.35 + r() * 3, len: 240 + r() * 420, lift: -20 - r() * 70, w: 4 + r() * 5 });
  }
  base = ctx.still(drawBase, { scale: 1 });
}

function arch(g) {
  g.beginPath();
  g.moveTo(CX - R_IN, H + 20);
  g.lineTo(CX - R_IN, SPRING);
  g.arc(CX, SPRING, R_IN, Math.PI, 0);
  g.lineTo(CX + R_IN, H + 20);
  g.closePath();
}

function drawBase(g) {
  paper(g, W, H, P, 71);

  // ---- 洞外的那面墙：瓷砖 -------------------------------------------
  g.strokeStyle = P.mortar;
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  for (let y = 210; y < H; y += 96) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  for (let x = 40; x < W; x += 104) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, H);
    g.stroke();
  }
  g.globalAlpha = 1;

  // ---- 天花：一条墨带压住顶 ------------------------------------------
  mass(g, [[-8, -8], [W + 8, -8], [W + 8, 132], [-8, 108]], P, { amp: 2.6, step: 30, carve: 4, seed: 301 });
  // 灯管
  for (const [x, w] of [[250, 210], [880, 230], [1520, 240]]) {
    g.fillStyle = P.paper;
    g.fillRect(x - w / 2, 156, w, 12);
    g.fillStyle = P.yellow;
    g.globalAlpha = 0.6;
    g.fillRect(x - w / 2 + 8, 159, w - 16, 5);
    g.globalAlpha = 1;
  }

  // ---- 拱圈：一圈锈红楔石 --------------------------------------------
  const ring = () => {
    g.beginPath();
    g.arc(CX, SPRING, R_IN + 54, Math.PI, 0);
    g.lineTo(CX + R_IN, SPRING);
    g.arc(CX, SPRING, R_IN, 0, Math.PI, true);
    g.closePath();
  };
  g.save();
  ring();
  g.fillStyle = P.rust;
  g.fill();
  g.strokeStyle = P.ink;
  g.lineWidth = 3;
  g.stroke();
  g.restore();
  // 楔石的缝：从拱心放射出去
  g.save();
  ring();
  g.clip();
  g.strokeStyle = P.paper;
  g.lineWidth = 2.4;
  g.globalAlpha = 0.85;
  for (let i = 0; i <= 26; i++) {
    const a = Math.PI + (i / 26) * Math.PI;
    g.beginPath();
    g.moveTo(CX + Math.cos(a) * (R_IN + 2), SPRING + Math.sin(a) * (R_IN + 2));
    g.lineTo(CX + Math.cos(a) * (R_IN + 56), SPRING + Math.sin(a) * (R_IN + 56));
    g.stroke();
  }
  g.restore();

  // ---- 洞口：黑 ------------------------------------------------------
  g.save();
  arch(g);
  g.fillStyle = P.ink;
  g.fill();
  g.strokeStyle = P.paper;
  g.lineWidth = 5;
  g.stroke();
  g.restore();

  // ---- 道床：枕木和两条钢轨，往洞里收 --------------------------------
  g.save();
  arch(g);
  g.clip();
  g.fillStyle = P.ink;
  g.fillRect(0, 0, W, H);
  // 洞壁的肋（只有被灯照到才看得见，render 里再画亮的）
  g.restore();

  // 洞外的道砟 + 枕木
  mass(g, [[-8, 1012], [W + 8, 992], [W + 8, H + 8], [-8, H + 8]], P, { amp: 2.2, step: 24, carve: 3, seed: 305 });
  // 钢轨：两根，从脚下一路收进洞里
  for (const side of [-1, 1]) {
    g.save();
    g.strokeStyle = P.paper;
    g.globalAlpha = 0.8;
    g.lineWidth = 4.4;
    g.beginPath();
    g.moveTo(LAMP.x + side * 560, H + 20);
    g.lineTo(LAMP.x + side * 30, LAMP.y + 26);
    g.stroke();
    g.restore();
  }
  g.save();
  g.beginPath();
  g.rect(-8, 990, W + 16, H);
  g.clip();
  g.strokeStyle = P.paper;
  g.globalAlpha = 0.22;
  g.lineWidth = 10;
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const y = 1040 - t * 34;
    const x = 300 + t * 220;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 700 - t * 300, y - 20 + t * 18);
    g.stroke();
  }
  g.restore();

  // ---- 站台边（右下角的一小条，够认地方就行） ------------------------
  mass(g, [[1240, 986], [W + 8, 958], [W + 8, 1030], [1240, 1058]], P, { amp: 1.8, step: 22, carve: 2.4, seed: 307, fill: 'yellow' });
  mass(g, [[1240, 1056], [W + 8, 1028], [W + 8, H + 8], [1240, H + 8]], P, { amp: 2, step: 24, carve: 2.6, seed: 308 });
  g.save();
  g.strokeStyle = P.mortar;
  g.globalAlpha = 0.5;
  g.lineWidth = 2;
  for (let x = 1260; x < W; x += 92) {
    g.beginPath();
    g.moveTo(x, 760);
    g.lineTo(x, 980);
    g.stroke();
  }
  g.restore();

  // ---- 信号灯（洞里的锈红点） ----------------------------------------
  g.fillStyle = P.rust;
  g.beginPath();
  g.arc(268, 700, 8, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.65;
  g.strokeStyle = P.paper;
  g.lineWidth = 2;
  g.beginPath();
  g.arc(268, 700, 17, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;

  grain(g, W, H, 78);
}

// ---------------------------------------------------------------- render

function isWall(x, y) {
  const dx = x - CX;
  const dy = y - SPRING;
  const r = Math.hypot(dx, dy);
  const inside = y > SPRING ? Math.abs(dx) < R_IN : r < R_IN;
  if (inside) return false;
  if (y > 1012) return false;
  if (y < 140) return false;
  return true;
}

function drawDebris(g, x, y, rot, s) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  mass(g, [[-16, -11], [17, -13], [14, 12], [-15, 9]], P, { amp: 1, step: 10, carve: 0, seed: 211, fill: 'paper', edge: P.ink, edgeW: 2.2 });
  g.strokeStyle = P.ink;
  g.globalAlpha = 0.7;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-9, -3);
  g.lineTo(8, -4);
  g.moveTo(-9, 3);
  g.lineTo(6, 2);
  g.stroke();
  g.restore();
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.clearRect(0, 0, W, H);

  // 缓推
  const push = 1 + 0.088 * smooth(t / 3.8);
  g.save();
  g.translate(CX * 0.75, SPRING * 1.05);
  g.scale(push, push);
  g.translate(-CX * 0.75, -SPRING * 1.05);
  g.drawImage(base, 0, 0, W, H);

  const lit = smooth((t - 0.9) / 2.55);
  const R = 40 + 250 * lit ** 1.4;
  const RX = R * 1.42;
  const RY = R * 0.5;

  // ---- 洞里被点亮的部分（裁在拱里） ---------------------------------
  if (lit > 0) {
    g.save();
    arch(g);
    g.clip();
    g.save();
    g.beginPath();
    g.ellipse(LAMP.x, LAMP.y + 10, RX, RY, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = P.yellow;
    g.fillRect(0, 0, W, H);
    // 洞壁的肋：被灯一道道点出来
    g.strokeStyle = P.ink;
    g.lineWidth = 3;
    g.globalAlpha = 0.16;
    for (let i = 1; i <= 4; i++) {
      g.beginPath();
      g.arc(LAMP.x, LAMP.y, 210 + i * 168, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    g.restore();
  }

  // ---- 光沿着两条钢轨铺到脚下 ----------------------------------------
  if (lit > 0.02) {
    for (const side of [-1, 1]) {
      g.save();
      g.beginPath();
      g.moveTo(LAMP.x + side * 26, LAMP.y + 20);
      g.lineTo(LAMP.x + side * 560, H + 20);
      g.lineTo(LAMP.x + side * 640, H + 20);
      g.lineTo(LAMP.x + side * 58, LAMP.y + 20);
      g.closePath();
      g.fillStyle = P.yellow;
      g.globalAlpha = 0.55 + 0.45 * lit;
      g.fill();
      g.restore();
    }
  }

  // ---- 车头：黑从灯的四周长出来（压在光柱上） -------------------------
  const nose = smooth((t - 2.35) / 1.35);
  if (nose > 0) {
    const nw = lerp(120, 1080, nose);
    const nh = lerp(90, 900, nose);
    const ncx = LAMP.x - 6;
    const top = H + 40 - nh;
    const pts = [
      [ncx - nw / 2, H + 60], [ncx - nw / 2, top + 100], [ncx - nw / 2 + 26, top + 40],
      [ncx - nw / 2 + 132, top + 6], [ncx + nw / 2 - 132, top + 6], [ncx + nw / 2 - 26, top + 40],
      [ncx + nw / 2, top + 100], [ncx + nw / 2, H + 60],
    ];
    mass(g, pts, P, { amp: 2.8, step: 30, carve: 4.5, seed: 313 });
    // 车头正面的一道横沟 + 下面的排障器
    g.save();
    g.strokeStyle = P.paper;
    g.lineWidth = 3;
    g.globalAlpha = 0.85;
    g.beginPath();
    g.moveTo(ncx - nw / 2 + 40, top + 168);
    g.lineTo(ncx + nw / 2 - 40, top + 168);
    g.stroke();
    g.restore();
    if (nose > 0.42) {
      const bw = lerp(36, 330, (nose - 0.42) / 0.58);
      mass(g, [[ncx - bw / 2, top + 92], [ncx + bw / 2, top + 92], [ncx + bw / 2, top + 132], [ncx - bw / 2, top + 132]], P, {
        amp: 1.6, step: 18, carve: 2.6, seed: 315, fill: 'yellow',
      });
      g.save();
      g.strokeStyle = P.paper;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(ncx - bw / 2 + 10, top + 112);
      g.lineTo(ncx + bw / 2 - 10, top + 112);
      g.stroke();
      g.restore();
    }
    // 两侧的小灯
    if (nose > 0.55) {
      for (const side of [-1, 1]) {
        g.fillStyle = P.yellow;
        g.beginPath();
        g.arc(ncx + side * nw * 0.3, top + 210, 9 + nose * 7, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  // ---- 灯本身：纸白的心，一圈点阵边（画在车头上，因为灯就在车头上） ----
  if (lit > 0) {
    const lr = 9 + 74 * lit;
    g.save();
    g.fillStyle = P.yellow;
    g.globalAlpha = 0.95;
    g.beginPath();
    g.arc(LAMP.x, LAMP.y, lr + 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = P.paper;
    g.beginPath();
    g.arc(LAMP.x, LAMP.y, lr, 0, Math.PI * 2);
    g.fill();
    // 横向眩光：车灯是横的一道，不是一颗球
    g.fillStyle = P.paper;
    const gl = 90 + 430 * lit;
    for (let i = 0; i < 26; i++) {
      const t0 = i / 25;
      const w0 = (1 - t0) ** 1.6;
      g.globalAlpha = 0.55 * w0;
      g.fillRect(LAMP.x - gl * t0, LAMP.y - 5 * w0, gl * 0.045, 10 * w0);
      g.fillRect(LAMP.x + gl * t0, LAMP.y - 5 * w0, gl * 0.045, 10 * w0);
    }
    g.fillStyle = P.yellow;
    const n = 96;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = lr + 30 + Math.sin(i * 2.7) * 7;
      g.globalAlpha = 0.9;
      g.beginPath();
      g.arc(LAMP.x + Math.cos(a) * rr, LAMP.y + Math.sin(a) * rr, 4.4 + Math.sin(i * 1.9) * 1.4, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // ---- 风声：洞外画墨，洞里画纸 --------------------------------------
  for (let i = 0; i < wind.length; i++) {
    const s = wind[i];
    const age = t - s.birth;
    if (age < 0) continue;
    const ph = (age * 0.46 + s.off * 0.4) % 1.3;
    const x = -60 + ph * 2200;
    const y = s.y + Math.sin(ph * 2.2 + i) * 16;
    const pts = windPath(x, y, s.len * (0.6 + ph * 0.7), 22, s.lift * (0.5 + ph));
    const dark = isWall(x + 120, y);
    windStroke(g, P, { pts, width: s.w * (0.6 + ph * 0.6), dark, alpha: 0.88 * clamp01(age / 0.4) });
  }

  // ---- 碎纸：被风顶着往右跑，穿过光 --------------------------------
  for (const d of debris) {
    const age = t - 0.55;
    if (age < 0) continue;
    const ph = (age * 0.42 * d.v + d.off) % 1.25;
    const x = -100 + ph * 2200;
    const y = d.y + Math.sin(ph * 5 + d.rot) * 40 - ph * 60;
    drawDebris(g, x, y, d.rot + ph * d.spin, d.s * (0.7 + 0.5 * Math.sin(ph * 3)));
  }

  // ---- 灰 ------------------------------------------------------------
  for (const m of motes) {
    const x = ((m.x + m.v * t) % (W + 200)) - 100;
    g.globalAlpha = m.a * (0.4 + 0.6 * smooth(t / 2.4));
    g.fillStyle = P.ink;
    g.beginPath();
    g.ellipse(x, m.y + Math.sin(t * 2 + m.x) * 8, m.s * 2.8, m.s * 1, 0.2, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.restore();
}
