// 镜头：花园里的池塘（1350 BC，底比斯）
//
// 构图规则用的是这个风格自己的：**栏带**。上栏是神的世界（象形字、日轮、圣甲虫），
// 下栏是人的世界（池塘、水鸟、供桌、走路的少女），最底一条水带。
// 没有透视、没有渐变、没有笔触——只有平涂和等宽线。
//
// 下栏里有两套人体，别混：墙上的埃及程式人物（egyptian()，侧脸、正面眼、
// 正面双肩、腰以下收窄）和前面那个现代小孩（figure()，白帽、圆眼镜、会走路）。
// 前者属于壁画，后者是"穿越"进来的那一个——两者的比例和画法本来就不一样。
//
// 密度是这个风格的一半：空白处要填满小母题，但每个母题都要能被一眼认出来。

import {
  C, rng, ink, poly, beadBand, toothBand, column, drawGlyph, water, fish, fowl, papyrus,
  figure, egyptian, capsule, cast, jar, flatten, PALETTE,
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

  // ---- 人间：陈设要有大小、有前后、有影子，不是一排等距标签 ----
  // 左边一组罐：五个，高低错开、前后叠一点
  const pots = [
    { x: 108, h: 146, w: 62, fill: C.gold, band: C.turq, kind: 'amphora' },
    { x: 176, h: 96, w: 66, fill: C.red, band: C.gold, kind: 'pot' },
    { x: 232, h: 126, w: 54, fill: C.gold, band: C.redBr, kind: 'amphora' },
    { x: 292, h: 68, w: 62, fill: C.turq, band: C.gold, kind: 'pot' },
    { x: 352, h: 112, w: 50, fill: C.red, band: C.turq, kind: 'amphora' },
  ];
  for (const p of pots) jar(g, { x: p.x, y: BANK, h: p.h, w: p.w, fill: p.fill, band: p.band, kind: p.kind });

  // 人间的第一个人：墙上的埃及程式侍女（侧脸、正面眼、正面双肩），站着提莲花
  egyptian(g, { x: 452, y: BANK, h: 272, face: 1, kind: 'woman' });

  // 供桌：四条腿、桌板、面包、酒壶、一支莲花——每样都落在桌上
  offeringTable(g, 648, BANK, 1);

  // 右中：纸莎草 + 两只小罐，把人物右边的空墙填掉
  papyrus(g, 1168, BANK, 5, 118, 131);
  jar(g, { x: 1218, y: BANK, h: 76, w: 44, fill: C.turq, band: C.gold, kind: 'pot' });
  jar(g, { x: 1262, y: BANK, h: 54, w: 40, fill: C.gold, band: C.red, kind: 'pot' });
  fowl(g, 1352, BANK - 22, 0.44, 0);

  // 右下：圣甲虫推日轮（Khepri）——一个真能读出来的东西
  // 底部水带与脚带  // 底部水带与脚带
  g.strokeStyle = C.line;
  g.lineWidth = 3.5;
  g.strokeRect(0, BOTTOM.y, W, BOTTOM.h);
  beadBand(g, 0, FOOT.y, W, FOOT.h, 40);
}

/**
 * 圣甲虫推日轮（Khepri）：一个真能读出来的东西，不是「红圆盘 + 蓝团块」。
 * 日轮在前滚，甲虫在后推；六条腿抓地，头、胸、鞘翅分开画，底下有影子。
 */
function scarab(g, lt) {
  const y = BANK - 4;
  const x = 1520 + ((lt * 26) % 230);
  // 影子：整组东西压在一条地上
  cast(g, x + 6, y + 1, 78, 8);
  const r = 27;
  // 日轮
  ink(g, (q) => {
    q.beginPath();
    q.arc(x + 34, y - r - 2, r, 0, Math.PI * 2);
  }, C.redBr, { lw: 3 });
  g.strokeStyle = C.gold;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x + 34, y - r - 2, r * 0.62, Math.PI * 0.15 + x * 0.02, Math.PI * 1.25 + x * 0.02);
  g.stroke();
  g.beginPath();
  g.arc(x + 34, y - r - 2, r * 0.30, Math.PI * 1.15 + x * 0.02, Math.PI * 2.25 + x * 0.02);
  g.stroke();

  // 甲虫：头朝日轮
  const bx = x - 4;
  const by = y - 26;
  // 腿：三对，折一下，抓住地
  g.strokeStyle = C.line;
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const ay = by - 6 + k * 9;
      g.beginPath();
      g.moveTo(bx + sgn * 9, ay);
      g.lineTo(bx + sgn * 20, ay + 2 + k * 2);
      g.lineTo(bx + sgn * 25, y + (k === 2 ? 0 : -3));
      g.stroke();
    }
  }
  // 鞘翅：一大一小两片
  ink(g, (q) => {
    q.beginPath();
    q.ellipse(bx, by + 4, 14, 19, 0, 0, Math.PI * 2);
  }, C.blue, { lw: 2.8 });
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(bx, by - 14);
  g.lineTo(bx, by + 22);
  g.stroke();
  // 胸 + 头
  ink(g, (q) => {
    q.beginPath();
    q.ellipse(bx + 3, by - 16, 9, 8, 0.2, 0, Math.PI * 2);
  }, C.blueDk, { lw: 2.4 });
  ink(g, (q) => {
    q.beginPath();
    q.ellipse(bx + 10, by - 24, 7, 5, 0.5, 0, Math.PI * 2);
  }, C.blueDk, { lw: 2.2 });
  // 前肢：顶住日轮
  g.strokeStyle = C.line;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(bx + 12, by - 24);
  g.lineTo(bx + 22, by - 30);
  g.lineTo(bx + 30, by - 28);
  g.stroke();
}

/** 供桌：四条腿撑一块板，板上坐面包、酒壶、莲花。桌腿有影子。 */
function offeringTable(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  cast(g, 4, -2, 104, 9);
  for (const lx of [-74, -46, 46, 74]) {
    ink(g, (q) => poly(q, [[lx - 6, 0], [lx + 6, 0], [lx + 5, -46], [lx - 5, -46]]), C.gold, { lw: 2.2 });
  }
  ink(g, (q) => poly(q, [[-92, -46], [92, -46], [84, -62], [-84, -62]]), C.goldLt, { lw: 2.6 });
  for (const [bx, by, r] of [[-56, -78, 14], [-30, -84, 17], [-4, -80, 15], [20, -85, 12]]) {
    ink(g, (q) => {
      q.beginPath();
      q.ellipse(bx, by, r, r * 0.72, 0, Math.PI, Math.PI * 2);
      q.lineTo(bx + r, by);
      q.closePath();
    }, C.redBr, { lw: 2.2 });
  }
  jar(g, { x: 58, y: -62, h: 46, w: 30, fill: C.cream, band: C.blue, kind: 'pot', lw: 2.2 });
  g.strokeStyle = C.green;
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(40, -62);
  g.quadraticCurveTo(66, -120, 44, -164);
  g.stroke();
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(44, -160);
    q.quadraticCurveTo(24, -168, 30, -188);
    q.quadraticCurveTo(40, -176, 44, -192);
    q.quadraticCurveTo(52, -176, 60, -188);
    q.quadraticCurveTo(66, -168, 44, -160);
    q.closePath();
  }, C.blue, { lw: 2.2 });
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
  const walkX = 900 + lt * 26;
  figure(g, { x: walkX, y: BANK, h: 272, face: 1, hat: C.white, phase: lt * 3.2 });

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
