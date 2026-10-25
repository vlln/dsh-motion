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
  figure, egyptian, capsule, cast, jar,
  wallTexture, frescoSurface, specks,
} from './_egypt.mjs';

export const id = 'egypt';
export const kind = 'canvas2d';
export const slots = {};
// 主角由生图给（见 howto/角色.md），墙和器物仍由代码画。
export const assets = ['kid'];

const W = 1920;
const H = 1080;

// 栏带（照参考量的比例）
const TOP = { y: 0, h: 54 };
const UPPER = { y: 66, h: 500 };       // 神界：象形字 + 池塘 + 日轮
const MID = { y: 578, h: 24 };         // 齿带
const LOWER = { y: 612, h: 300 };      // 人间：走路的少女 + 供桌
const BOTTOM = { y: 648, h: 356 };     // 水带：通栏，不是画框
const FOOT = { y: 1032, h: 48 };

const BANK = 640;                      // 岸线：水带的上沿，人和陈设都站在这条线上

let ctx;
let base = null;
let surface = null;
let speck = null;
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
      x: 60 + rand() * (W - 120),
      y: BOTTOM.y + 70 + rand() * (BOTTOM.h - 140),
      s: 2.1 + rand() * 1.0,
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
    { x: 240, y: BOTTOM.y + 70, s: 1.5 },
    { x: 960, y: BOTTOM.y + 96, s: 1.3 },
    { x: 1640, y: BOTTOM.y + 62, s: 1.4 },
  ];

  base = ctx.still(drawBase, { scale: 1 });
  surface = frescoSurface(W, H);
  speck = specks(W, H);
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
  // 墙就是一张 fBm 纹理，不是平涂（照参考：P.texture）
  g.drawImage(wallTexture(W, H, { base: C.wall, dark: C.wallDk, seed: 1 }), 0, 0);

  beadBand(g, 0, TOP.y, W, TOP.h, 46);
  g.strokeStyle = C.line;
  g.lineWidth = 3;
  g.strokeRect(0, UPPER.y, W, UPPER.h);

  drawGlyphRows(g);

  // 岸带：一条通栏的砖砌岸，水在它下面，人和陈设都站在这条线上
  g.fillStyle = C.wallDk;
  g.fillRect(0, BANK - 26, W, 26);
  g.strokeStyle = C.line;
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(0, BANK - 26);
  g.lineTo(W, BANK - 26);
  g.moveTo(0, BANK);
  g.lineTo(W, BANK);
  g.stroke();
  g.strokeStyle = C.line;
  g.lineWidth = 1.6;
  for (let x = 8; x < W; x += 34) {
    g.beginPath();
    g.moveTo(x, BANK - 26);
    g.lineTo(x, BANK);
    g.stroke();
  }

  // 岸上：三只大雁，大小不一，站在岸线上
  fowl(g, 470, BANK + 10, 1.5, 0);
  fowl(g, 700, BANK + 12, 1.15, 0);
  fowl(g, 1330, BANK + 8, 1.35, 0);
  // 两端纸莎草大扇形
  papyrus(g, 96, BANK - 8, 7, 210, 91);
  papyrus(g, 1830, BANK - 8, 7, 230, 92);
  // 上栏空中：四只飞鸟，把大片空白填掉
  for (const [bx, by, bs] of [[560, 250, 0.9], [690, 205, 0.7], [1240, 240, 0.8], [1370, 190, 0.65]]) {
    ink(g, (q) => {
      q.beginPath();
      q.moveTo(bx - 26 * bs, by);
      q.quadraticCurveTo(bx - 10 * bs, by - 16 * bs, bx, by);
      q.quadraticCurveTo(bx + 10 * bs, by - 16 * bs, bx + 26 * bs, by);
    }, null, { lw: 2.6 });
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

  // 水带：通栏，上沿就是岸线
  waterLine(g, { x: 0, y: BOTTOM.y, w: W, h: BOTTOM.h }, lt, 0);
  for (const f of poolFish) {
    const span = W + 160;
    const x = -80 + (((f.x + lt * f.speed) % span) + span) % span;
    fish(g, x, f.y + Math.sin(lt * 2 + f.x) * 3, f.s, f.dir, f.col);
  }
  for (const l of lilies) {
    const sway = Math.sin(lt * 1.6 + l.x) * 0.12;
    ink(g, (q) => {
      const petals = 5;
      for (let i = 0; i < petals; i++) {
        const ang = -Math.PI / 2 + (i - (petals - 1) / 2) * 0.42 + sway;
        const len = 26 * l.s;
        const bx = l.x + Math.cos(ang) * len;
        const by = l.y + Math.sin(ang) * len;
        q.moveTo(l.x, l.y + 6);
        q.quadraticCurveTo(l.x + Math.cos(ang - 0.2) * len * 0.6, l.y + Math.sin(ang - 0.2) * len * 0.6, bx, by);
        q.quadraticCurveTo(l.x + Math.cos(ang + 0.2) * len * 0.6, l.y + Math.sin(ang + 0.2) * len * 0.6, l.x, l.y + 6);
      }
    }, null, { lw: 2.4 });
  }

  // 会动的水纹字
  const wp = Math.floor(lt * 12) * 0.5;
  cols.filter((q) => q.name === 'water').forEach((q) => drawGlyph(g, q, wp + q.ph));

  scarab(g, lt);

  // 走路的少女：白帽子是"穿越"的那一个
  const walkX = 900 + lt * 26;
  // 生图给的主角：底边踩在地面线上，按 3:4 的框放进去
  const kidH = 300;
  const kidW = kidH * 0.833;
  ctx.image('kid', { x: walkX - kidW * 0.32, y: BANK - kidH * 0.94, w: kidW, h: kidH, fit: 'contain' });

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

  // 表面：一张 fBm multiply 层（含发丝裂纹）+ 一层稀疏颗粒。
  // 这一步是"壁画"和"矢量图"的分界，照参考 02_egypt.js 的 surface()/specks()。
  g.save();
  g.globalCompositeOperation = "multiply";
  g.drawImage(surface, 0, 0);
  g.restore();
  g.drawImage(speck, 0, 0);
}
