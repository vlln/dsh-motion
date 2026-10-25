// 埃及墓室壁画的画法（样例，属于这个片子，不属于引擎）。
//
// 三条签名特征决定这里的一切：
//   1. 无透视、平涂、等宽深棕轮廓线（约 2.5px）
//   2. 栏带构图：横向条带 + 彩色方块边框，东西排在里面，不排进纵深
//   3. 象形字作为**纹样密度**：竖栏、逐字排、大小不一
//
// 所以这个文件里没有笔触、没有渐变、没有混色。要的就是干净。

export const C = {
  // 矿物色：埃及蓝是发灰的，赭石是闷的。饱和的"糖果三原色"是数码味的第一来源。
  wall: '#e4d5b4',
  wallDk: '#cdb992',
  line: '#5a2f1e',
  red: '#9c4030',
  redBr: '#a8552f',
  blue: '#3a5a8c',
  blueDk: '#2a4066',
  turq: '#4f8f88',
  green: '#4a6f45',
  gold: '#c19a4e',
  goldLt: '#dcc189',
  cream: '#ece1c8',
  skin: '#c98b5e',
  skinDk: '#a06a42',
  white: '#efe6d2',
};

/** 可复现的随机；render(t) 必须是纯函数。 */
export const rng = (seed) => {
  let s = (seed | 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) | 0), ((s >>> 8) & 0xffffff) / 0x1000000);
};

/** 给一个路径铺平涂 + 等宽深棕描边。埃及壁画里每个形都是这两步。 */
export function ink(g, draw, fill, { lw = 3.1, stroke = C.line } = {}) {
  draw(g);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (lw > 0) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.stroke();
  }
}

export function poly(g, pts) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

/** 彩色方块边框：红蓝黄绿交替，中间米白缝。 */
export function beadBand(g, x, y, w, h, cell = 34, colors = [C.red, C.blue, C.gold, C.green]) {
  g.fillStyle = C.cream;
  g.fillRect(x, y, w, h);
  const n = Math.max(1, Math.round(w / cell));
  const cw = w / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[i % colors.length];
    g.fillRect(x + i * cw + 1.5, y + 2.5, cw - 3, h - 5);
    g.strokeStyle = C.line;
    g.lineWidth = 1.6;
    g.strokeRect(x + i * cw + 1.5, y + 2.5, cw - 3, h - 5);
  }
  g.strokeStyle = C.line;
  g.lineWidth = 2.4;
  g.strokeRect(x, y, w, h);
}

/** 细齿带：一条深蓝带上排小三角，用在栏与栏之间。 */
export function toothBand(g, x, y, w, h, color = C.blueDk) {
  g.fillStyle = color;
  g.fillRect(x, y, w, h);
  const cell = 22;
  g.fillStyle = C.gold;
  for (let i = 0; x + i * cell < x + w; i++) {
    const cx = x + i * cell + cell / 2;
    poly(g, [[cx - cell / 2 + 3, y + h], [cx, y + 4], [cx + cell / 2 - 3, y + h]]);
    g.fill();
  }
  g.strokeStyle = C.line;
  g.lineWidth = 2;
  g.strokeRect(x, y, w, h);
}

// ---------------- 象形字：每个都在 50×60 的框里，原点在中心 ----------------
// 只用线，不用填充，颜色从 glyph palette 里挑——这是壁画的写法。
export const GLYPH = {
  ankh: (g) => {
    g.beginPath();
    g.ellipse(0, -16, 8, 11, 0, 0, 7);
    g.moveTo(-15, -2);
    g.lineTo(15, -2);
    g.moveTo(0, -4);
    g.lineTo(0, 28);
    g.stroke();
  },
  sun: (g) => {
    g.beginPath();
    g.arc(0, 0, 14, 0, 7);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, 3.5, 0, 7);
    g.fill();
  },
  water: (g, ph = 0) => {
    for (let r = -1; r <= 1; r++) {
      g.beginPath();
      for (let i = 0; i <= 14; i++) {
        const x = -21 + i * 3;
        const y = r * 9 + ((i + ph) % 2 < 1 ? -3 : 3);
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  },
  reed: (g) => {
    g.beginPath();
    g.moveTo(-2, 28);
    g.quadraticCurveTo(-11, 0, 1, -27);
    g.quadraticCurveTo(7, -2, 4, 28);
    g.stroke();
  },
  bird: (g) => {
    g.beginPath();
    g.ellipse(4, 4, 12, 8, 0.25, 0, 7);
    g.stroke();
    g.beginPath();
    g.arc(-4, -12, 6, 0, 7);
    g.stroke();
    g.beginPath();
    g.moveTo(-9, -13);
    g.lineTo(-17, -10);
    g.moveTo(6, 11);
    g.lineTo(4, 26);
    g.moveTo(-2, 10);
    g.lineTo(-4, 26);
    g.stroke();
  },
  eye: (g) => {
    g.beginPath();
    g.moveTo(-17, 0);
    g.quadraticCurveTo(0, -11, 17, 0);
    g.quadraticCurveTo(0, 8, -17, 0);
    g.stroke();
    g.beginPath();
    g.arc(0, -1, 4, 0, 7);
    g.fill();
    g.beginPath();
    g.moveTo(-2, 7);
    g.lineTo(-4, 16);
    g.stroke();
  },
  scarab: (g) => {
    g.beginPath();
    g.ellipse(0, 5, 9, 13, 0, 0, 7);
    g.fill();
    g.beginPath();
    g.arc(0, -10, 5.5, 0, 7);
    g.fill();
    for (const s of [-1, 1]) {
      for (const k of [-1, 0, 1]) {
        g.beginPath();
        g.moveTo(s * 8, 4 + k * 7);
        g.lineTo(s * 15, k * 10 + 1);
        g.stroke();
      }
    }
  },
  seated: (g) => {
    g.beginPath();
    g.arc(-2, -20, 6, 0, 7);
    g.fill();
    poly(g, [[-6, -13], [4, -13], [6, 6], [15, 8], [16, 17], [-9, 17], [-9, 2]]);
    g.fill();
    g.beginPath();
    g.moveTo(-5, -8);
    g.lineTo(-16, -15);
    g.stroke();
  },
  jar: (g) => {
    g.beginPath();
    g.moveTo(-6, -20);
    g.lineTo(6, -20);
    g.lineTo(5, -13);
    g.quadraticCurveTo(15, -5, 11, 11);
    g.quadraticCurveTo(7, 20, 0, 20);
    g.quadraticCurveTo(-7, 20, -11, 11);
    g.quadraticCurveTo(-15, -5, -5, -13);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(-9, 0);
    g.lineTo(9, 0);
    g.stroke();
  },
  lotus: (g) => {
    g.beginPath();
    g.moveTo(0, 26);
    g.lineTo(0, -4);
    g.stroke();
    poly(g, [[0, -4], [-11, -16], [-6, -24], [0, -15], [6, -24], [11, -16]]);
    g.stroke();
  },
  feather: (g) => {
    g.beginPath();
    g.moveTo(-2, 27);
    g.quadraticCurveTo(-8, -9, 4, -27);
    g.quadraticCurveTo(11, -16, 5, 0);
    g.quadraticCurveTo(2, 14, 2, 27);
    g.stroke();
  },
  djed: (g) => {
    g.beginPath();
    g.moveTo(-6, 27);
    g.lineTo(-6, -9);
    g.moveTo(6, 27);
    g.lineTo(6, -9);
    for (let k = 0; k < 4; k++) {
      g.moveTo(-12, -11 - k * 5);
      g.lineTo(12, -11 - k * 5);
    }
    g.moveTo(-11, 27);
    g.lineTo(11, 27);
    g.stroke();
  },
  snake: (g) => {
    g.beginPath();
    g.moveTo(20, 7);
    g.bezierCurveTo(9, -4, 4, 12, -5, 5);
    g.bezierCurveTo(-13, -1, -15, -4, -19, -2);
    g.stroke();
    g.beginPath();
    g.moveTo(-19, -2);
    g.lineTo(-22, -8);
    g.stroke();
  },
  basket: (g) => {
    g.beginPath();
    g.moveTo(-18, -4);
    g.lineTo(18, -4);
    g.quadraticCurveTo(16, 11, 0, 11);
    g.quadraticCurveTo(-16, 11, -18, -4);
    g.stroke();
  },
};

export const GLYPH_NAMES = Object.keys(GLYPH);
const COLS = [C.blue, C.green, C.red, C.line, C.turq];

/**
 * 一根象形字栏：竖着往下塞字，同栏不重复相邻，字距随机几像素。
 * 位置在 mount 时算好，每帧只按算好的位置画——这样只有「水纹字」能单独动。
 */
export function column({ x, y, w, h, seed = 1, scale = 1 }) {
  const rand = rng(seed);
  const out = [];
  let cy = y + 10;
  let prev = '';
  while (true) {
    let name;
    let guard = 0;
    do {
      name = GLYPH_NAMES[(rand() * GLYPH_NAMES.length) | 0];
    } while ((name === prev || (name === 'scarab' && rand() < 0.6)) && guard++ < 12);
    prev = name;
    const s = (0.78 + rand() * 0.16) * scale;
    const glyphH = 54 * s;
    if (cy + glyphH > y + h - 8) break;
    out.push({
      name,
      x: x + w / 2 + (rand() - 0.5) * 5,
      y: cy + glyphH / 2,
      s,
      col: COLS[(rand() * COLS.length) | 0],
      ph: (rand() * 4) | 0,
    });
    cy += glyphH + 1 + rand() * 4;
  }
  return out;
}

export function drawGlyph(g, q, ph = 0) {
  g.save();
  g.translate(q.x, q.y);
  g.scale(q.s, q.s);
  g.strokeStyle = q.col;
  g.fillStyle = q.col;
  g.lineWidth = 3.1;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  GLYPH[q.name](g, ph);
  g.restore();
}

/** 水的写法：不是波纹线，是**交错的小齿**铺满，鱼浮在上面。 */
export function water(g, x, y, w, h, phase = 0, { row = 26, amp = 7, color = C.blueDk, deep = C.blue } = {}) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = deep;
  g.fillRect(x, y, w, h);
  g.strokeStyle = color;
  g.lineWidth = 3;
  for (let r = 0; r * row < h + row; r++) {
    g.beginPath();
    const yy = y + r * row;
    for (let i = 0; i <= w / 12 + 1; i++) {
      const xx = x + i * 12;
      const up = (i + r + phase) % 2 < 1;
      const py = yy + (up ? -amp : amp);
      i ? g.lineTo(xx, py) : g.moveTo(xx, py);
    }
    g.stroke();
  }
  g.restore();
}

/** 鱼：一个橄榄形 + 三角尾，一眼是鱼就够。 */
export function fish(g, x, y, s = 1, dir = 1, color = C.turq) {
  g.save();
  g.translate(x, y);
  g.scale(dir * s, s);
  g.beginPath();
  g.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = C.line;
  g.lineWidth = 1.6;
  g.stroke();
  poly(g, [[-10, 0], [-17, -5], [-17, 5]]);
  g.fillStyle = color;
  g.fill();
  g.stroke();
  g.fillStyle = C.line;
  g.beginPath();
  g.arc(6, -1, 1.4, 0, 7);
  g.fill();
  g.restore();
}

/** 鹭／雁：站着的水禽，长颈、长腿、喙向下。 */
export function fowl(g, x, y, s = 1, bob = 0) {
  g.save();
  g.translate(x, y + bob);
  g.scale(s, s);
  ink(g, (g2) => {
    g2.beginPath();
    g2.ellipse(0, 0, 30, 17, -0.15, 0, Math.PI * 2);
  }, C.white, { lw: 2.2 });
  ink(g, (g2) => {
    g2.beginPath();
    g2.moveTo(20, -8);
    g2.quadraticCurveTo(40, -34, 34, -52);
    g2.quadraticCurveTo(31, -60, 24, -58);
    g2.quadraticCurveTo(30, -50, 22, -36);
    g2.quadraticCurveTo(14, -22, 12, -12);
  }, null, { lw: 2.2 });
  ink(g, (g2) => {
    g2.beginPath();
    g2.arc(22, -54, 8, 0, Math.PI * 2);
  }, C.white, { lw: 2.2 });
  g.fillStyle = C.line;
  g.fillRect(18, -58, 2.4, 2.4);
  ink(g, (g2) => {
    poly(g2, [[14, -54], [2, -50], [14, -48]]);
  }, C.gold, { lw: 1.6 });
  ink(g, (g2) => {
    g2.beginPath();
    g2.moveTo(-6, 14);
    g2.lineTo(-8, 34);
    g2.moveTo(8, 14);
    g2.lineTo(10, 34);
  }, null, { lw: 2.2 });
  g.restore();
}

/** 纸莎草／莲花丛：一束竖茎，顶端伞状，疏密不一。 */
export function papyrus(g, x, y, n, h, seed = 3) {
  const rand = rng(seed);
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * (14 + rand() * 8);
    const hh = h * (0.72 + rand() * 0.5);
    const bend = (rand() - 0.5) * 18;
    ink(g, (g2) => {
      g2.beginPath();
      g2.moveTo(x + dx, y);
      g2.quadraticCurveTo(x + dx + bend * 0.4, y - hh * 0.6, x + dx + bend, y - hh);
    }, null, { lw: 2.4 });
    const tipX = x + dx + bend;
    const tipY = y - hh;
    ink(g, (g2) => {
      g2.beginPath();
      g2.moveTo(tipX, tipY);
      g2.quadraticCurveTo(tipX - 16, tipY - 4, tipX - 10, tipY - 20);
      g2.quadraticCurveTo(tipX, tipY - 14, tipX + 10, tipY - 20);
      g2.quadraticCurveTo(tipX + 16, tipY - 4, tipX, tipY);
    }, C.green, { lw: 1.8 });
  }
}

/**
 * 埃及程式的人：侧脸、正面眼、正面肩、平涂、等宽线。
 *
 * 尺寸以 210 为单位，按 h 缩放。返回近侧手的位置，拿东西的往那儿挂。
 *
 * 三处容易画错、这一版是照参考改过的：
 *   · 宽领项圈是**贴着脖子的一圈同心半椭圆**，外圈盖过肩宽，不是横过胸口的一条带子；
 *   · 近侧手臂画在躯干**之上**、轮廓**之外**，否则会被胸挡住；
 *   · 侧面用两段贝塞尔，不用折线——折线远看是鸟喙。
 */
export function figure(g, { x, y, h = 210, face = 1, skin = C.skin, cloth = C.white, hat = null, stride = 0 }) {
  const s = h / 210;
  const L = C.line;
  g.save();
  g.translate(x, y);
  g.scale(s * face, s);

  // 远侧腿（暗一档，错后半步）
  ink(g, (q) => poly(q, [[-22, -76], [-6, -76], [-4 - stride * 12, -9], [-20 - stride * 12, -9]]), C.skinDk, { lw: 2.6 });

  // 近侧腿 + 脚：脚跟、脚背、脚趾，长度够撑住重量
  ink(g, (q) => poly(q, [[2, -76], [18, -76], [21 + stride * 12, -10], [6 + stride * 12, -10]]), skin, { lw: 2.6 });
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(3 + stride * 12, -8);
    q.bezierCurveTo(3 + stride * 12, -2, 10 + stride * 12, 0, 22 + stride * 12, 0);
    q.lineTo(34 + stride * 12, -1);
    q.bezierCurveTo(30 + stride * 12, -6, 24 + stride * 12, -9, 18 + stride * 12, -9);
    q.closePath();
  }, skin, { lw: 2.4 });
  g.strokeStyle = L;
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(30 + stride * 12, -1);
  g.lineTo(31 + stride * 12, -5);
  g.stroke();

  // 裙：上窄下宽 + 一条褶
  ink(g, (q) => poly(q, [[-17, -108], [19, -108], [26, -72], [-24, -72]]), cloth, { lw: 2.8 });
  g.strokeStyle = L;
  g.lineWidth = 1.7;
  g.beginPath();
  g.moveTo(-5, -102);
  g.lineTo(-7, -74);
  g.stroke();

  // 躯干：肩比腰宽；腰上一条红带
  ink(g, (q) => poly(q, [[-27, -158], [29, -158], [19, -106], [-16, -106]]), cloth, { lw: 2.9 });
  g.strokeStyle = C.red;
  g.lineWidth = 5.5;
  g.beginPath();
  g.moveTo(-15, -116);
  g.lineTo(19, -116);
  g.stroke();

  // 宽领项圈：外圈盖过肩，内圈贴脖子
  const cc = [2, -166];
  const bands = [[C.blue, 20, 8], [C.red, 27, 12], [C.gold, 33, 16], [C.blue, 39, 20]];
  for (let i = bands.length - 1; i >= 0; i--) {
    const [col, rx, ry] = bands[i];
    g.beginPath();
    g.ellipse(cc[0], cc[1], rx, ry, 0, 0, Math.PI);
    g.fillStyle = col;
    g.fill();
  }
  g.strokeStyle = L;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(cc[0], cc[1], 39, 20, 0, 0, Math.PI);
  g.stroke();

  // 颈
  ink(g, (q) => poly(q, [[-6, -180], [9, -180], [8, -164], [-5, -164]]), skin, { lw: 2.2 });

  // 头：颅骨大一号；侧脸两段贝塞尔（鼻梁 → 鼻尖 → 人中 → 下巴）
  ink(g, (q) => {
    q.beginPath();
    q.ellipse(3, -198, 17, 19, 0, 0, Math.PI * 2);
  }, skin, { lw: 2.6 });
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(15, -213);
    q.bezierCurveTo(26, -210, 31, -204, 30, -198);
    q.lineTo(26, -194);
    q.bezierCurveTo(26, -188, 18, -183, 7, -181);
    q.lineTo(-2, -183);
  }, skin, { lw: 2.2 });

  // 正面眼 + 拖到太阳穴的眼线 + 眉
  g.fillStyle = C.white;
  g.beginPath();
  g.ellipse(11, -201, 5.6, 3.2, -0.08, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = L;
  g.beginPath();
  g.arc(11, -201, 2.4, 0, 7);
  g.fill();
  g.strokeStyle = L;
  g.lineWidth = 2.7;
  g.beginPath();
  g.moveTo(4, -202);
  g.bezierCurveTo(11, -206, 17, -203, 19, -201);
  g.lineTo(30, -202);
  g.stroke();
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(0, -208);
  g.bezierCurveTo(9, -213, 18, -210, 22, -206);
  g.stroke();

  // 远侧手臂：只露肩下一小条
  ink(g, (q) => poly(q, [[-27, -157], [-20, -156], [-19, -122], [-26, -123]]), C.skinDk, { lw: 2.2 });

  // 近侧手臂：在躯干之上、轮廓之外；肩 → 肘 → 手
  ink(g, (q) => poly(q, [[21, -156], [33, -153], [31 - stride * 3, -130], [20 - stride * 3, -132]]), skin, { lw: 2.6 });
  ink(g, (q) => poly(q, [[21 - stride * 3, -132], [32 - stride * 3, -130], [28 - stride * 4, -106], [18 - stride * 4, -108]]), skin, { lw: 2.6 });
  ink(g, (q) => {
    q.beginPath();
    q.ellipse(23 - stride * 4, -102, 9, 8, 0.2, 0, Math.PI * 2);
  }, skin, { lw: 2.4 });
  g.strokeStyle = L;
  g.lineWidth = 1.3;
  for (const d of [-4, 0, 4]) {
    g.beginPath();
    g.moveTo(19 - stride * 4 + d, -106);
    g.lineTo(20 - stride * 4 + d, -99);
    g.stroke();
  }

  // 帽子：白色宽檐压在颅骨上
  if (hat) {
    ink(g, (q) => poly(q, [[-25, -214], [32, -214], [36, -209], [-29, -209]]), hat, { lw: 2.3 });
    ink(g, (q) => {
      q.beginPath();
      q.ellipse(4, -215, 18, 12, 0, Math.PI, Math.PI * 2);
    }, hat, { lw: 2.3 });
  }

  g.restore();
  return { hand: [x + face * s * 23, y - s * 102] };
}

/**
 * 把整幅画压到一副闭合调色板。
 *
 * 埃及壁画没有抗锯齿：颜料是一块一块平涂的，边缘是硬的。画布默认会把每条曲线
 * 变成一层灰雾，那是"数字感"的来源。压一次色板，边缘就回到"画上去的"。
 *
 * 深色和浅色分开找最近色：不分开的话，2.5px 的描边有一半像素会被判成墙色，
 * 线就断了——这是压色板最容易犯的错。
 */
export function flatten(g, w, h, palette) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const rgb = palette.map((hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  });
  const luma = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const dark = rgb.filter((c) => luma(c) < 110);
  const light = rgb.filter((c) => luma(c) >= 110);
  const near = (r, gg, b, set) => {
    let best = set[0];
    let dist = Infinity;
    for (const c of set) {
      const dd = (r - c[0]) ** 2 + (gg - c[1]) ** 2 + (b - c[2]) ** 2;
      if (dd < dist) {
        dist = dd;
        best = c;
      }
    }
    return best;
  };
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const gg = d[i + 1];
    const b = d[i + 2];
    const q = luma([r, gg, b]) < 110 && dark.length ? near(r, gg, b, dark) : near(r, gg, b, light);
    d[i] = q[0];
    d[i + 1] = q[1];
    d[i + 2] = q[2];
  }
  g.putImageData(img, 0, 0);
}

export const PALETTE = [
  C.wall, C.wallDk, C.line, C.red, C.redBr, C.blue, C.blueDk, C.turq,
  C.green, C.gold, C.goldLt, C.cream, C.skin, C.skinDk, C.white,
];

/**
 * 媒介层：颜料被石灰吃进去。
 *
 * 不是"叠一层噪点"——它做三件具体的事：底层灰泥的斑驳（低频）、
 * 颜料浓度不匀（中频，只在色块内部）、以及零星脱落的针孔。
 * 幅度压在 8% 以内：看得见就够，看不见纹理就说明对了。
 */
export function plaster(g, w, h, seed = 7) {
  const rand = rng(seed);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const p = c.getContext('2d');
  // 低频斑驳
  for (let i = 0; i < 90; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 120 + rand() * 340;
    const grad = p.createRadialGradient(x, y, 0, x, y, r);
    const dark = rand() < 0.5;
    grad.addColorStop(0, dark ? 'rgba(120,96,60,0.10)' : 'rgba(255,250,232,0.10)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    p.fillStyle = grad;
    p.fillRect(0, 0, w, h);
  }
  // 针孔与擦痕
  p.fillStyle = 'rgba(96,76,48,0.20)';
  for (let i = 0; i < 1400; i++) {
    const r = 0.5 + rand() * 1.8;
    p.beginPath();
    p.arc(rand() * w, rand() * h, r, 0, Math.PI * 2);
    p.fill();
  }
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.globalAlpha = 0.9;
  g.drawImage(c, 0, 0);
  g.restore();
}
