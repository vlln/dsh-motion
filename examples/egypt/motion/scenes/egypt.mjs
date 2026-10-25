// 镜头：花园里的池塘（1350 BC，底比斯）
//
// 构图规则用的是这个风格自己的：**栏带**。上栏是神的世界（象形字、日轮、圣甲虫），
// 下栏是人的世界（池塘、水鸟、供桌、走路的少女），最底一条水带。
// 没有透视、没有渐变、没有笔触——只有平涂和等宽线。
//
// 密度是这个风格的一半：空白处要填满小母题，但每个母题都要能被一眼认出来。

import {
  C, rng, ink, poly, beadBand, toothBand, column, drawGlyph, water, fish, fowl, papyrus, figure, flatten, PALETTE,
} from './_egypt.mjs';

export const id = 'egypt';
export const kind = 'canvas2d';
export const slots = {};

const W = 1920;
const H = 1080;

// 栏带（照参考量的比例）
const TOP = { y: 0, h: 54 };
const UPPER = { y: 66, h: 500 };       // 神界：象形字 + 池塘 + 日轮
const MID = { y: 578, h: 24 };         // 齿带
const LOWER = { y: 612, h: 300 };      // 人间：走路的少女 + 供桌
const BOTTOM = { y: 924, h: 100 };     // 水带
const FOOT = { y: 1032, h: 48 };

const POOL = { x: 430, y: 120, w: 1000, h: 330 };
const BANK = LOWER.y + 286;            // 人走的地面线（把人和陈设压在下栏里）

let ctx;
let base = null;
let cols = [];
let poolFish = [];
let bandFish = [];
let lilies = [];

export function mount(context) {
  ctx = context;

  cols = [
    ...column({ x: 74, y: 96, w: 126, h: 440, seed: 1350 }),
    ...column({ x: 214, y: 96, w: 126, h: 440, seed: 1351 }),
    ...column({ x: 1720, y: 96, w: 126, h: 440, seed: 1352 }),
    ...column({ x: 1580, y: 96, w: 126, h: 440, seed: 1353 }),
  ];

  const rand = rng(4242);
  const COLS = [C.turq, C.gold, C.cream, C.turq, C.red];
  poolFish = [];
  for (let i = 0; i < 12; i++) {
    poolFish.push({
      x: POOL.x + 40 + rand() * (POOL.w - 80),
      y: POOL.y + 70 + rand() * (POOL.h - 130),
      s: 1.05 + rand() * 0.95,
      dir: rand() < 0.5 ? 1 : -1,
      speed: 16 + rand() * 34,
      col: COLS[(rand() * COLS.length) | 0],
    });
  }
  bandFish = [
    { x: 300, y: 970, s: 0.9, dir: 1, speed: 48, col: C.gold },
    { x: 780, y: 980, s: 0.8, dir: -1, speed: 40, col: C.cream },
    { x: 1200, y: 966, s: 0.85, dir: 1, speed: 44, col: C.turq },
    { x: 1580, y: 982, s: 0.8, dir: -1, speed: 34, col: C.gold },
  ];
  lilies = [
    { x: POOL.x + 90, y: POOL.y + POOL.h - 34, s: 1.6 },
    { x: POOL.x + POOL.w - 110, y: POOL.y + POOL.h - 40, s: 1.4 },
    { x: POOL.x + POOL.w * 0.45, y: POOL.y + POOL.h - 26, s: 1.2 },
    { x: POOL.x + POOL.w * 0.7, y: POOL.y + 60, s: 1.1 },
  ];

  base = ctx.still(drawBase, { scale: 1 });
}

function drawGlyphRows(g) {
  g.strokeStyle = C.red;
  g.lineWidth = 2.4;
  for (const x of [70, 212, 352, 1576, 1716, 1856]) {
    g.beginPath();
    g.moveTo(x, UPPER.y + 14);
    g.lineTo(x, UPPER.y + UPPER.h - 14);
    g.stroke();
  }
  // 静态层的字：水纹字留给 render（它会动）
  for (const q of cols) if (q.name !== 'water') drawGlyph(g, q, q.ph);
}

function drawBase(g) {
  g.fillStyle = C.wall;
  g.fillRect(0, 0, W, H);

  beadBand(g, 0, TOP.y, W, TOP.h, 46);
  g.strokeStyle = C.line;
  g.lineWidth = 3;
  g.strokeRect(0, UPPER.y, W, UPPER.h);

  drawGlyphRows(g);

  // 池岸：先铺一圈砖岸，池子才是园池，不是挂在墙上的画框
  g.fillStyle = C.wallDk;
  g.fillRect(POOL.x - 46, POOL.y - 42, POOL.w + 92, POOL.h + 92);
  g.strokeStyle = C.line;
  g.lineWidth = 2.6;
  g.strokeRect(POOL.x - 46, POOL.y - 42, POOL.w + 92, POOL.h + 92);
  // 岸砖：一排短竖线，密一点，读成砌筑
  g.strokeStyle = C.line;
  g.lineWidth = 1.6;
  for (let x = POOL.x - 40; x < POOL.x + POOL.w + 44; x += 34) {
    g.beginPath();
    g.moveTo(x, POOL.y - 42);
    g.lineTo(x, POOL.y - 18);
    g.moveTo(x + 17, POOL.y + POOL.h + 18);
    g.lineTo(x + 17, POOL.y + POOL.h + 46);
    g.stroke();
  }
  // 池塘：深色边框 + 水底。水面每帧画
  g.fillStyle = C.line;
  g.fillRect(POOL.x - 16, POOL.y - 16, POOL.w + 32, POOL.h + 32);
  g.fillStyle = C.blueDk;
  g.fillRect(POOL.x, POOL.y, POOL.w, POOL.h);
  g.strokeStyle = C.gold;
  g.lineWidth = 3;
  g.strokeRect(POOL.x - 16, POOL.y - 16, POOL.w + 32, POOL.h + 32);

  // 池岸两侧：水鸟与纸莎草，把上栏的空白填掉
  fowl(g, 396, 500, 1.18, 0);
  fowl(g, 1428, 512, 1.02, 0);
  papyrus(g, 360, 520, 4, 110, 91);
  papyrus(g, 1560, 520, 4, 120, 92);

  // 莲叶（静态底座）
  for (const l of lilies) {
    ink(g, (g2) => {
      g2.beginPath();
      g2.ellipse(l.x, l.y + 16, 26 * l.s, 8 * l.s, 0, 0, Math.PI * 2);
    }, C.green, { lw: 2 });
  }

  toothBand(g, 0, MID.y, W, MID.h);

  // 人间：地面线
  g.strokeStyle = C.line;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, BANK);
  g.lineTo(W, BANK);
  g.stroke();

  // 左：一排陶罐（填空，也是密度）
  for (let i = 0; i < 4; i++) {
    const x = 150 + i * 82;
    const h = 96 - (i % 2) * 14;
    ink(g, (g2) => {
      g2.beginPath();
      g2.moveTo(x - 14, BANK - h);
      g2.lineTo(x + 14, BANK - h);
      g2.quadraticCurveTo(x + 34, BANK - h * 0.45, x + 22, BANK);
      g2.lineTo(x - 22, BANK);
      g2.quadraticCurveTo(x - 34, BANK - h * 0.45, x - 14, BANK - h);
      g2.closePath();
    }, i % 2 ? C.red : C.gold, { lw: 2.2 });
    g.strokeStyle = C.line;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - 22, BANK - h * 0.42);
    g.lineTo(x + 22, BANK - h * 0.42);
    g.stroke();
  }

  // 中左：矮供桌 + 面包（填空白，也是密度）
  g.save();
  g.translate(560, BANK);
  ink(g, (g2) => poly(g2, [[-64, 0], [64, 0], [70, -10], [-70, -10]]), C.gold, { lw: 2.8 });
  ink(g, (g2) => poly(g2, [[-52, -10], [52, -10], [40, -34], [-40, -34]]), C.cream, { lw: 2.8 });
  for (let i = -1; i <= 1; i++) {
    ink(g, (g2) => {
      g2.beginPath();
      g2.ellipse(i * 26, -40, 13, 8, 0, Math.PI, Math.PI * 2);
    }, C.gold, { lw: 2.4 });
  }
  g.restore();

  // 右：供桌（静态）
  g.save();
  g.translate(1560, BANK);
  ink(g, (g2) => poly(g2, [[-80, 0], [80, 0], [88, -10], [-88, -10]]), C.gold, { lw: 2.4 });
  ink(g, (g2) => poly(g2, [[-64, -10], [64, -10], [48, -36], [-48, -36]]), C.red, { lw: 2.4 });
  for (let i = -2; i <= 2; i++) {
    ink(g, (g2) => {
      g2.beginPath();
      g2.arc(i * 26, -42, 9, 0, Math.PI * 2);
    }, i % 2 ? C.gold : C.green, { lw: 2 });
  }
  g.restore();

  // 右中：纸莎草与两只小鸟，把人物右边的空墙填掉
  papyrus(g, 1180, BANK, 5, 120, 131);
  fowl(g, 1280, BANK - 26, 0.5, 0);

  // 右下：再来一排小罐，密度要一直铺到边上
  for (let i = 0; i < 3; i++) {
    const x = 1120 + i * 58;
    ink(g, (g2) => {
      g2.beginPath();
      g2.moveTo(x - 10, BANK - 58);
      g2.lineTo(x + 10, BANK - 58);
      g2.quadraticCurveTo(x + 24, BANK - 28, x + 16, BANK);
      g2.lineTo(x - 16, BANK);
      g2.quadraticCurveTo(x - 24, BANK - 28, x - 10, BANK - 58);
      g2.closePath();
    }, i % 2 ? C.turq : C.gold, { lw: 2.4 });
  }

  // 底部水带与脚带
  g.strokeStyle = C.line;
  g.lineWidth = 3.5;
  g.strokeRect(0, BOTTOM.y, W, BOTTOM.h);
  beadBand(g, 0, FOOT.y, W, FOOT.h, 40);
}

/** 圣甲虫推日球：横向匀速，轮子按走过的弧长转。 */
function scarab(g, lt) {
  const span = W - 520;
  const x = 300 + ((lt * 210) % span);
  const y = BANK - 26;
  const r = 24;
  ink(g, (g2) => {
    g2.beginPath();
    g2.arc(x - 40, y - 10, r, 0, Math.PI * 2);
  }, C.redBr, { lw: 3 });
  g.save();
  g.translate(x - 40, y - 10);
  g.rotate(x / r);
  g.strokeStyle = C.gold;
  g.lineWidth = 2.6;
  g.beginPath();
  g.arc(0, 0, r * 0.5, 0.4, 2.2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r * 0.5, 3.6, 5.4);
  g.stroke();
  g.restore();

  g.save();
  g.translate(x, y);
  ink(g, (g2) => {
    g2.beginPath();
    g2.ellipse(0, 10, 16, 21, 0, 0, Math.PI * 2);
  }, C.blue, { lw: 2.8 });
  ink(g, (g2) => {
    g2.beginPath();
    g2.arc(0, -13, 10, 0, Math.PI * 2);
  }, C.blueDk, { lw: 2.6 });
  const step = Math.floor(lt * 15) % 2;
  g.strokeStyle = C.line;
  g.lineWidth = 2.6;
  for (const s of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const lift = (k + step) % 2 ? 6 : -2;
      g.beginPath();
      g.moveTo(s * 13, 2 + k * 9);
      g.lineTo(s * 26, 8 + k * 9 + lift);
      g.stroke();
    }
  }
  g.restore();
}

function waterLine(g, rect, lt, phase = 0) {
  water(g, rect.x, rect.y, rect.w, rect.h, Math.floor(lt * 12) + phase);
}

export function render(t) {
  const lt = t;
  const g = ctx.canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(base, 0, 0);

  // 池塘：水 + 鱼
  g.save();
  g.beginPath();
  g.rect(POOL.x, POOL.y + 10, POOL.w, POOL.h - 10);
  g.clip();
  waterLine(g, { x: POOL.x, y: POOL.y, w: POOL.w, h: POOL.h }, lt, 0);
  for (const f of poolFish) {
    const span = POOL.w + 120;
    const x = POOL.x - 60 + (((f.x - POOL.x + 60 + lt * f.speed) % span) + span) % span;
    fish(g, x, f.y + Math.sin(lt * 2 + f.x) * 3, f.s, f.dir, f.col);
  }
  g.restore();

  // 水面上浮着的三只水鸟：跟着水一起动
  for (let i = 0; i < 3; i++) {
    const dx = POOL.x + 160 + i * 300 + Math.sin(lt * 0.6 + i) * 24;
    fowl(g, dx, POOL.y + POOL.h - 26 + Math.sin(lt * 1.5 + i * 2) * 2, 0.62, 0);
  }

  // 池心莲花：花瓣缓慢开合
  for (const l of lilies) {
    const sway = Math.sin(lt * 1.6 + l.x) * 0.12;
    ink(g, (g2) => {
      const petals = 5;
      for (let i = 0; i < petals; i++) {
        const a = -Math.PI / 2 + (i - (petals - 1) / 2) * 0.42 + sway;
        const len = 26 * l.s;
        const bx = l.x + Math.cos(a) * len;
        const by = l.y + 12 + Math.sin(a) * len;
        g2.moveTo(l.x, l.y + 14);
        g2.quadraticCurveTo(l.x + Math.cos(a - 0.2) * len * 0.6, l.y + 12 + Math.sin(a - 0.2) * len * 0.6, bx, by);
        g2.quadraticCurveTo(l.x + Math.cos(a + 0.2) * len * 0.6, l.y + 12 + Math.sin(a + 0.2) * len * 0.6, l.x, l.y + 14);
      }
    }, null, { lw: 2.2 });
    g.fillStyle = C.blue;
    g.beginPath();
    g.arc(l.x, l.y + 10, 5 * l.s, 0, 7);
    g.fill();
    g.strokeStyle = C.line;
    g.lineWidth = 1.6;
    g.stroke();
  }
  g.strokeStyle = C.line;
  g.lineWidth = 3;
  g.strokeRect(POOL.x, POOL.y, POOL.w, POOL.h);

  // 会动的水纹字
  const wp = Math.floor(lt * 12) * 0.5;
  cols.filter((q) => q.name === 'water').forEach((q) => drawGlyph(g, q, wp + q.ph));

  scarab(g, lt);

  // 走路的少女：白帽子是"穿越"的那一个
  const stride = Math.sin(lt * 3.4) * 0.5;
  const walkX = 900 + lt * 26;
  const hands = figure(g, { x: walkX, y: BANK, h: 300, face: 1, hat: C.white, stride });
  g.save();
  g.translate(hands.hand[0] + 10, hands.hand[1] + 22);
  ink(g, (g2) => {
    g2.beginPath();
    g2.moveTo(-30, -6);
    g2.lineTo(30, -6);
    g2.quadraticCurveTo(25, 22, 0, 22);
    g2.quadraticCurveTo(-25, 22, -30, -6);
  }, C.gold, { lw: 2.2 });
  for (const [dx, col] of [[-16, C.red], [0, C.green], [16, C.gold]]) {
    ink(g, (g2) => {
      g2.beginPath();
      g2.arc(dx, -13, 8, 0, Math.PI * 2);
    }, col, { lw: 1.8 });
  }
  g.restore();

  // 底部水带
  waterLine(g, { x: 0, y: BOTTOM.y + 2, w: W, h: BOTTOM.h - 4 }, lt, 1);
  for (const f of bandFish) {
    const span = W + 160;
    const x = -80 + (((f.x + lt * f.speed) % span) + span) % span;
    fish(g, x, f.y + Math.sin(lt * 2.4 + f.x) * 2, f.s, f.dir, f.col);
  }
  g.strokeStyle = C.line;
  g.lineWidth = 3.5;
  g.strokeRect(0, BOTTOM.y, W, BOTTOM.h);

  // 最后一道：压到闭合色板。边缘变硬，整幅读成"画上去的"。
  flatten(g, W, H, PALETTE);
}
