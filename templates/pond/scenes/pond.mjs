// 黄昏的池塘。整幅没有一条直线，也没有一个矩形。
//
// 三层，和参考实现一样：
//   ① 底图：只铺颜色分布（天、树线、水、岸），画一次，缓存；
//   ② 笔触层：网格从底图取色，水面横笔、芦苇竖笔、天空近乎平笔，
//      每 1/6 秒整层重抖一次，两次之间缓存；
//   ③ 动的东西：睡莲漂、涟漪扩、水光闪——都画在笔触层之上。
//
// 底图不在乎好不好看：它只是"这块该是什么颜色"。好看是笔触层给的。

export const id = 'pond';
export const slots = {};
export const textUsage = {};

const BOIL = 0; // 整幅不沸腾。全屏每 1/6 秒重随机 = 逐帧跳变，看着头晕。
const CELL = 9;

let ctx;
let base = null;
let layer = null;
let layerStep = -1;

const W = 1920;
const H = 1080;
const HORIZON = H * 0.46;

// 睡莲：位置固定，各自漂
const PADS = [];
{
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 26; i++) {
    PADS.push({
      x: W * (0.08 + rand() * 0.84),
      y: HORIZON + H * (0.1 + rand() * 0.52),
      rx: 26 + rand() * 34,
      ry: 9 + rand() * 8,
      notch: rand() * Math.PI * 2,
      flower: rand() < 0.35,
      ph: rand() * Math.PI * 2,
      k: i % 3,
    });
  }
}

/** ① 底图：色块、椭圆、渐变。没有线段。 */
function drawBase(g, w, h) {
  // 天：黄昏由紫到橙
  const sky = g.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#2a3350');
  sky.addColorStop(0.55, '#5b4a6b');
  sky.addColorStop(0.82, '#b5735f');
  sky.addColorStop(1, '#e0a271');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, HORIZON);

  // 太阳还没落净：一团暖光压在树线后面
  const sun = g.createRadialGradient(w * 0.63, HORIZON * 0.92, 8, w * 0.63, HORIZON * 0.92, w * 0.2);
  sun.addColorStop(0, 'rgba(255,214,150,0.55)');
  sun.addColorStop(0.5, 'rgba(232,150,110,0.16)');
  sun.addColorStop(1, 'rgba(232,150,110,0)');
  g.fillStyle = sun;
  g.fillRect(0, 0, w, HORIZON + 40);

  // 远树线：一团团椭圆叠出来的边，没有一条直线
  for (let i = 0; i < 140; i++) {
    const x = (i * 173) % (w + 200) - 100;
    const r = 40 + ((i * 37) % 70);
    g.fillStyle = i % 3 ? '#2f3b34' : '#26332f';
    g.beginPath();
    g.ellipse(x, HORIZON - r * 0.25, r, r * 0.72, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 近处树影，更暗更高
  for (let i = 0; i < 24; i++) {
    const x = (i * 311) % (w + 240) - 120;
    const r = 90 + ((i * 53) % 90);
    g.fillStyle = '#1b2624';
    g.beginPath();
    g.ellipse(x, HORIZON - r * 0.18, r, r * 0.9, 0, 0, Math.PI * 2);
    g.fill();
  }

  // 水：近处暗、远处暖，横向分层（横向的椭圆，不是矩形）
  const water = g.createLinearGradient(0, HORIZON, 0, h);
  water.addColorStop(0, '#c98f6c');
  water.addColorStop(0.18, '#7f6f78');
  water.addColorStop(0.5, '#3c4a55');
  water.addColorStop(1, '#22303a');
  g.fillStyle = water;
  g.fillRect(0, HORIZON, w, h - HORIZON);

  // 水面上的横向色带：宽扁椭圆，越近越大
  for (let i = 0; i < 40; i++) {
    const t = i / 40;
    const y = HORIZON + (h - HORIZON) * t * t;
    const rx = w * (0.08 + t * 0.3);
    const ry = 6 + t * 26;
    g.fillStyle = i % 4 === 0 ? 'rgba(214,168,140,0.10)' : i % 4 === 1 ? 'rgba(60,90,110,0.16)' : 'rgba(30,45,55,0.12)';
    g.beginPath();
    g.ellipse(w * (0.15 + ((i * 137) % 700) / 1000), y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }

  // 右岸：一块圆角石岸，用椭圆堆出来
  for (let i = 0; i < 16; i++) {
    const x = w * (0.72 + (i % 4) * 0.06);
    const y = h * (0.78 + Math.floor(i / 4) * 0.05);
    g.fillStyle = i % 2 ? '#5a5348' : '#6b6255';
    g.beginPath();
    g.ellipse(x, y, 90 + (i % 3) * 26, 44 + (i % 2) * 18, 0.15, 0, Math.PI * 2);
    g.fill();
  }
  // 岸边的暗影
  const bank = g.createLinearGradient(0, h * 0.72, 0, h);
  bank.addColorStop(0, 'rgba(18,26,28,0)');
  bank.addColorStop(1, 'rgba(18,26,28,0.55)');
  g.fillStyle = bank;
  g.fillRect(w * 0.62, h * 0.7, w * 0.38, h * 0.3);
}

/** ② 笔触层：方向按区域，颜色按区域，整层随 boil 重抖。 */

/** 区域由底图这一点的**颜色**决定，不按 y 切——按 y 切会切出一条笔直的边。 */
function zoneOf(r, g, b, x, y) {
  const green = g > r + 6 && g > b - 10;
  const dark = (r + g + b) / 3 < 78;
  if (green && (dark || Math.abs(y - HORIZON) < 100)) return 2; // 芦苇 / 树线
  if (y > H * 0.78 && x > W * 0.6 && Math.abs(r - g) < 26 && r > 66) return 3; // 石岸（只在下右）
  if (y < HORIZON) return 0; // 天
  return 1; // 水
}

/**
 * 低分辨率的区域图：一次采样，给 mask 和 palette 共用。
 * 直接把"按颜色分区域"这件事做成数据，比在每根笔里判断便宜得多。
 */
function zoneMap() {
  const bctx = base.getContext('2d', { willReadFrequently: true });
  const data = bctx.getImageData(0, 0, base.width, base.height).data;
  const step = 8;
  const w = Math.ceil(base.width / step);
  const h = Math.ceil(base.height / step);
  const map = new Uint8Array(w * h);
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const px = Math.min(base.width - 1, gx * step);
      const py = Math.min(base.height - 1, gy * step);
      const i = (py * base.width + px) * 4;
      map[gy * w + gx] = zoneOf(data[i], data[i + 1], data[i + 2], (px / base.width) * W, (py / base.height) * H);
    }
  }
  return { map, w, h, step };
}

function getLayer(t) {
  const step = Math.floor(t * BOIL);
  if (step === layerStep && layer) return layer;
  layerStep = step;

  const { map, w: mw, h: mh, step: ms } = zoneMap();
  const at = (x, y) => {
    const gx = Math.min(mw - 1, Math.max(0, (x / (W * 1.15)) * mw | 0));
    const gy = Math.min(mh - 1, Math.max(0, (y / (H * 1.15)) * mh | 0));
    return map[gy * mw + gx];
  };

  const water = ctx.paint.swatch(['#5b6fb5', '#7d8fd0', '#9db5e0', '#6aa0a8', '#b7a6d8', '#d9c8e8'], 0.42);
  const sky = ctx.paint.swatch(['#c98fa0', '#e0a271', '#8a7fa8', '#b5735f', '#6a6a92', '#e8c8a8'], 0.38);
  const reed = ctx.paint.swatch(['#3f5a3a', '#6f7a3c', '#2f4a3a', '#8a8a4a', '#4a5a30', '#7a8a5a'], 0.4);
  const stone = ctx.paint.swatch(['#6b6255', '#8a8070', '#4a4640', '#a89a82'], 0.4);

  const ANGLE = [0.02, 0.02, -1.3, -1.15]; // 天、水、芦苇、岸
  const ANGLE_JITTER = [0.12, 0.22, 0.26, 0.2];

  const pass = (opts) =>
    ctx.paint.strokes(base, {
      boil: BOIL,
      t,
      jitter: 20,
      outline: 0.28,
      outlineColor: '#101820',
      outlineMix: 0.5,
      ...opts,
    });

  // 第一遍：整幅。方向与色板都按区域，交界处靠笔触自己化开。
  const first = pass({
    cell: CELL,
    len: 30,
    width: 8,
    seed: 31,
    angle: (x, y) => {
      const z = at(x, y);
      return ANGLE[z] + Math.sin(x * 0.01 + y * 0.006) * ANGLE_JITTER[z];
    },
    palette: (x, y, col, rand) => {
      const z = at(x, y);
      if (z === 0) return sky(col, rand);
      if (z === 2) return reed(col, rand);
      if (z === 3) return stone(col, rand);
      // 近岸的水留住底图里的暖反光：越靠近地平线，越让底色说话
      const k = Math.max(0, 1 - (y / (H * 1.15) - HORIZON / H) * 2.2);
      const c = water(col, rand);
      return [c[0] + (col[0] - c[0]) * k * 0.55, c[1] + (col[1] - c[1]) * k * 0.45, c[2] + (col[2] - c[2]) * k * 0.3];
    },
  });

  // 第二遍：只给芦苇和石岸，竖笔更密——不然那几个区域会被横笔抹平。
  const second = pass({
    cell: CELL + 2,
    len: 34,
    width: 7,
    seed: 37,
    angle: (x, y) => -1.34 + 0.16 * Math.sin(x * 0.012),
    mask: (x, y) => at(x, y) >= 2,
    palette: (x, y, col, rand) => {
      const z = at(x, y);
      return z === 3 ? stone(col, rand) : reed(col, rand);
    },
  });

  const merged = document.createElement('canvas');
  merged.width = first.width;
  merged.height = first.height;
  const mg = merged.getContext('2d');
  mg.drawImage(first, 0, 0);
  mg.drawImage(second, 0, 0);
  layer = merged;
  return layer;
}

/** ③ 会动的东西：画在笔触层之上，用画面坐标。 */
function drawLife(g, w, h, t) {
  // 机位：极慢的推近（缓入缓出），不是匀速平移。平移交给元素自己的漂。
  const push = 1 + 0.055 * (0.5 - 0.5 * Math.cos((Math.PI * t) / 12));
  const camX = 0;

  // 睡莲：不是椭圆——沿叶缘和叶面画短笔，和整幅一个质感
  for (const p of PADS) {
    const x = p.x - camX + Math.sin(t * 0.8 + p.ph) * 18;
    const y = p.y + Math.sin(t * 1.1 + p.ph * 1.4) * 8;
    const wob = Math.sin(t * 0.7 + p.ph) * 0.05;
    g.save();
    g.translate(x, y);
    g.rotate(wob);
    g.lineCap = 'round';
    // 叶面：一圈一圈往里收的短笔
    for (let ring = 0; ring < 3; ring++) {
      const k = 1 - ring * 0.3;
      const n = 14 - ring * 3;
      for (let i = 0; i < n; i++) {
        const a = p.notch + 0.4 + (i / n) * (Math.PI * 2 - 0.8);
        const rx = p.rx * k;
        const ry = p.ry * k;
        const px = Math.cos(a) * rx;
        const py = Math.sin(a) * ry;
        const len = 6 + ((i + ring) % 3) * 3;
        g.strokeStyle = ring === 0 ? (p.k === 0 ? '#4f7a4a' : '#6a9455') : p.k === 1 ? '#5f8a4e' : '#456f44';
        g.lineWidth = 3.4;
        g.beginPath();
        g.moveTo(px - len * 0.5, py);
        g.lineTo(px + len * 0.5, py + (ring - 1) * 1.2);
        g.stroke();
      }
    }
    if (p.flower) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        g.strokeStyle = i % 2 ? '#f2c4d0' : '#f8e0e8';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(Math.cos(a) * 3, -8 + Math.sin(a) * 3);
        g.lineTo(Math.cos(a) * 14, -8 + Math.sin(a) * 7);
        g.stroke();
      }
      g.fillStyle = '#f7e6b0';
      g.beginPath();
      g.ellipse(0, -9, 5, 4, 0.2, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  // 水面在流：几道宽而软的亮带，各自速度不同，连续滑动（不是逐帧换位置）。
  // 这是"水在动"和一帧一帧跳的分界：位移是连续的，只有高光是离散的。
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const depth = (i + 1) / 6;
    const y = HORIZON + (h - HORIZON) * depth;
    const speed = 10 + depth * 40;
    const x0 = ((t * speed) % (w + 600)) - 300;
    const ry = 26 + depth * 70;
    const grd = g.createLinearGradient(x0 - 420, 0, x0 + 420, 0);
    grd.addColorStop(0, 'rgba(255,230,190,0)');
    grd.addColorStop(0.45, `rgba(255,226,186,${0.10 + depth * 0.12})`);
    grd.addColorStop(0.55, `rgba(255,238,210,${0.08 + depth * 0.10})`);
    grd.addColorStop(1, 'rgba(255,230,190,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(x0, y, 420, ry, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // 水光：每一道都有自己的流速和呼吸，**连续地走**，不换位置。
  // 离散换位置是"跳"，连续滑动是"流"——这两者在 24fps 下看起来完全不同。
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < 200; i++) {
    const r1 = Math.abs(Math.sin(i * 37.7));
    const r2 = Math.abs(Math.sin(i * 91.3));
    const r3 = Math.abs(Math.sin(i * 17.3));
    const depth = r2;
    const speed = 9 + depth * 26; // 近处快、远处慢：水面的视差
    const x = ((r1 * w + t * speed) % (w + 140)) - 70;
    const y = HORIZON + 24 + depth * (h - HORIZON - 52);
    const breathe = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * (1.1 + r3 * 1.8) + i * 1.7));
    g.strokeStyle = i % 4 === 0 ? '#ffe0d0' : i % 4 === 1 ? '#fff4dc' : '#cfe0f8';
    g.globalAlpha = 0.16 + 0.34 * breathe;
    g.lineWidth = 3 + depth * 6;
    const len = 18 + r1 * 46;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len, y + Math.sin(i + t * 0.8) * 1.5);
    g.stroke();
  }
  g.restore();

  // 涟漪：三组，用短笔拼，不画整圈
  g.save();
  for (let k = 0; k < 3; k++) {
    const cx = w * [0.3, 0.55, 0.78][k] - camX;
    const cy = HORIZON + (h - HORIZON) * [0.45, 0.62, 0.78][k];
    for (let j = 0; j < 3; j++) {
      const q = (t * 0.5 + j / 3 + k * 0.2) % 1;
      const rx = 20 + q * 120;
      const ry = rx * 0.2;
      const alpha = 0.5 * (1 - q);
      g.strokeStyle = '#e8f0f8';
      g.lineWidth = 2.5;
      // 一圈由 18 段短弧拼成，段与段之间留缝
      for (let i = 0; i < 18; i++) {
        if (i % 3 === 0) continue;
        const a0 = (i / 18) * Math.PI * 2;
        g.globalAlpha = alpha;
        g.beginPath();
        g.ellipse(cx, cy, rx, ry, 0, a0, a0 + 0.16);
        g.stroke();
      }
    }
  }
  g.restore();
  g.globalAlpha = 1;
}

export function mount(context) {
  ctx = context;
  base = ctx.still((g, w, h) => drawBase(g, w, h), { scale: 1.15 });
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  const plate = getLayer(t);
  // 一层推就是全部推：底板和元素用同一个变换，才不会互相漂移
  const push = 1 + 0.055 * (0.5 - 0.5 * Math.cos((Math.PI * t) / 12));
  const pw = w * push;
  const ph = h * push;
  const ox = -(pw - w) * 0.5;
  const oy = -(ph - h) * 0.55;
  g.drawImage(plate, ox, oy, pw, ph);

  g.save();
  g.setTransform((pw / plate.width), 0, 0, (ph / plate.height), ox, oy);
  drawLife(g, plate.width, plate.height, t);
  g.restore();
}
