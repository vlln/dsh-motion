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
export function ink(g, draw, fill, { lw = 5.6, stroke = C.line } = {}) {
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
  g.lineWidth = 4.6;
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
  for (let r = 0; r * row < h + row; r++) {
    g.lineWidth = 3.4 + ((r * 37) % 7) * 0.22;
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
 * 陶罐：不是"剪影 + 一条横线"，是一个有口、有颈、有肩、有脚的东西。
 *
 * 剖面用一条半径曲线采样成多边形：肩宽、腰收、底收，光看轮廓就分得出
 * 高瓶和矮罐。再补：罐口椭圆、颈、肩上的彩色带、脚圈、地上一片影。
 */
export function jar(g, { x, y, h = 110, w = 48, fill = C.gold, band = C.turq, kind = 'amphora', lw = 2.6 }) {
  const R = w;   // 剖面半径以 w 为单位（最大 0.5 → 半宽 w/2）
  // 半径剖面（从底到口）：amphora 是尖底高瓶，pot 是矮胖罐
  const prof = kind === 'amphora'
    ? [[0.00, 0.10], [0.06, 0.30], [0.16, 0.44], [0.34, 0.50], [0.56, 0.48], [0.74, 0.34], [0.86, 0.24], [0.93, 0.21], [1.00, 0.26]]
    : [[0.00, 0.34], [0.05, 0.46], [0.20, 0.50], [0.45, 0.49], [0.70, 0.42], [0.85, 0.30], [0.93, 0.26], [1.00, 0.30]];
  const rad = (t) => {
    for (let i = 1; i < prof.length; i++) {
      if (t <= prof[i][0]) {
        const a = prof[i - 1];
        const b = prof[i];
        const k = (t - a[0]) / (b[0] - a[0] || 1);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return prof[prof.length - 1][1];
  };

  // 影子：往光的那边偏一点，压在地上
  cast(g, x + R * 0.2, y - 1.5, R * 0.72, Math.max(4, h * 0.045), C.wallDk);

  const N = 22;
  g.beginPath();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const px = x + rad(t) * R * (kind === 'amphora' ? 1 : 1);
    const py = y - t * h;
    i ? g.lineTo(px, py) : g.moveTo(px, py);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    g.lineTo(x - rad(t) * R, y - t * h);
  }
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = C.line;
  g.lineWidth = lw;
  g.lineJoin = 'round';
  g.stroke();

  // 罐口：**不画椭圆**。俯视口是透视残留，这个语言里罐口就是一条封口的横带
  g.fillStyle = C.line;
  g.fillRect(x - rad(1) * R, y - h - 1, rad(1) * R * 2, Math.max(3, h * 0.02));

  // 肩上的彩带：跟着罐子的弧度弯，不是一条直杠
  const bandAt = (t0, col, width) => {
    g.strokeStyle = col;
    g.lineWidth = width;
    g.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      const px = x + Math.cos(a) * rad(t0) * R;
      const py = y - t0 * h + Math.sin(a) * rad(t0) * R * 0.12;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  };
  bandAt(kind === 'amphora' ? 0.78 : 0.80, band, Math.max(4, h * 0.055));
  bandAt(kind === 'amphora' ? 0.70 : 0.72, C.cream, Math.max(1.6, h * 0.018));
  // 锯齿：这条带是手画的，不是印的
  g.strokeStyle = C.line;
  g.lineWidth = 1.5;
  g.beginPath();
  for (let i = 0; i <= 9; i++) {
    const a = Math.PI + (i / 9) * Math.PI;
    const t = kind === 'amphora' ? 0.78 : 0.80;
    const px = x + Math.cos(a) * rad(t) * R * 0.98;
    const py = y - t * h + Math.sin(a) * rad(t) * R * 0.12;
    i ? g.lineTo(px, py + (i % 2 ? -3 : 3)) : g.moveTo(px, py);
  }
  g.stroke();
  // 脚：矮罐一圈圈足；高瓶坐在一副交叉的木架上（参考里就是这么立的）
  g.strokeStyle = C.line;
  g.lineWidth = 1.9;
  if (kind === 'amphora') {
    g.beginPath();
    g.moveTo(x - R * 0.30, y - h * 0.06);
    g.lineTo(x - R * 0.34, y);
    g.moveTo(x + R * 0.30, y - h * 0.06);
    g.lineTo(x + R * 0.34, y);
    g.moveTo(x - R * 0.34, y);
    g.lineTo(x + R * 0.10, y - h * 0.10);
    g.moveTo(x + R * 0.34, y);
    g.lineTo(x - R * 0.10, y - h * 0.10);
    g.stroke();
  } else {
    g.beginPath();
    g.moveTo(x - R * 0.40, y - h * 0.04);
    g.lineTo(x + R * 0.40, y - h * 0.04);
    g.stroke();
  }
}

// ---------------- 人体 ----------------
//
// 两套人体，两套画法，别混：
//
//   egyptian()  → 墙上的埃及程式人物：侧脸、正面眼、正面双肩、腰以下收窄、
//                 平涂 + 等宽线。它属于壁画，站在壁画的空气里。
//   kidFigure() → 前面的现代卡通小孩：白帽、圆眼镜、白 T 恤、短裤、球鞋。
//                 关节、重量、影子、手真的握住东西。
//
// 共同的地基是 capsule()：给一条骨架上铺等宽圆头笔画，先描一圈深棕，
// 再铺肉色——两支骨的接头就自然圆过去了，不会出现"矩形管"的直角。

const seg = (g, a, b, w, col) => {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.stroke();
};

/** 骨架 → 一段有锥度、关节圆过去的肢体。pts 为像素坐标。 */
export function capsule(g, pts, widths, fill, lw = 3, line = C.line) {
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < pts.length - 1; i++) seg(g, pts[i], pts[i + 1], widths[i] + lw * 2, line);
  for (let i = 0; i < pts.length - 1; i++) seg(g, pts[i], pts[i + 1], widths[i], fill);
}

/** 脚下一小片赭色影子：不画影子，东西就飘在墙上。 */
export function cast(g, x, y, rx, ry = rx * 0.16, color = C.wallDk) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

/**
 * 埃及程式人物（壁画里那个人），不是主角。
 *
 * 三条不能破的规矩：
 *   头 = 侧脸 + 正面眼；肩 = 正面双肩；腰以下收窄。
 * 量的是 18 格法：全高 1、肩线 0.745、腰 0.545、裙摆 0.42、膝 0.26。
 * 脸只有 0.06 宽的一条侧面，眼睛却有 0.036 宽——这个"不对"正是签名，
 * 所以眼睛必须整个落在脸上，不能被假发压掉。
 *
 * kind: 'woman' 提莲花的侍女 / 'man' 抱罐的仆从
 */
export function egyptian(g, { x, y, h = 252, face = 1, kind = 'woman' }) {
  const u = h;
  const lw = Math.max(2.2, h * 0.0102);
  const P = (px, py) => [px * u, -py * u];
  const skin = C.skin;
  const skinFar = C.skinDk;
  const cloth = C.white;
  const wig = C.line;
  const woman = kind === 'woman';

  // 脚的形状（侧面一只扁脚）：脚跟着地，脚背拱起，脚趾朝前
  const foot = (ax, col, shade) => {
    ink(g, (q) => {
      q.beginPath();
      q.moveTo((ax - 0.035) * u, -0.055 * u);
      q.quadraticCurveTo((ax - 0.05) * u, -0.012 * u, (ax - 0.025) * u, -0.004 * u);
      q.lineTo((ax + 0.10) * u, -0.004 * u);
      q.quadraticCurveTo((ax + 0.128) * u, -0.006 * u, (ax + 0.13) * u, -0.026 * u);
      q.lineTo((ax + 0.055) * u, -0.042 * u);
      q.quadraticCurveTo((ax + 0.015) * u, -0.072 * u, (ax - 0.035) * u, -0.055 * u);
      q.closePath();
    }, col, { lw });
    if (shade) {
      g.strokeStyle = C.line;
      g.lineWidth = lw * 0.6;
      g.beginPath();
      g.moveTo((ax + 0.085) * u, -0.008 * u);
      g.lineTo((ax + 0.035) * u, -0.036 * u);
      g.stroke();
    }
  };

  g.save();
  g.translate(x, y);
  g.scale(face, 1);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // 地上的影子：压扁的椭圆，往背光那侧偏
  cast(g, 0.03 * u, -0.007 * u, 0.2 * u, 0.019 * u);

  // ---- 腿（先画腿，裙子盖上去）----
  // 远侧腿：暗一档，站得靠后
  capsule(g, [P(-0.05, 0.50), P(-0.085, 0.255), P(-0.092, 0.055)], [0.042 * u, 0.030 * u], skinFar, lw);
  foot(-0.092, skinFar, false);
  // 近侧腿：承重腿，脚平踩实
  capsule(g, [P(0.045, 0.50), P(0.062, 0.25), P(0.068, 0.055)], [0.045 * u, 0.032 * u], skin, lw);
  foot(0.068, skin, true);
  // 膝盖：一小段弧，让腿有折
  g.strokeStyle = C.line;
  g.lineWidth = lw * 0.65;
  g.beginPath();
  g.arc(0.062 * u, -0.25 * u, 0.032 * u, Math.PI * 1.2, Math.PI * 1.8);
  g.stroke();

  // ---- 躯干：正面双肩，腰以下收窄 ----
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(-0.132 * u, -0.748 * u);
    q.quadraticCurveTo(-0.152 * u, -0.70 * u, -0.126 * u, -0.63 * u);
    q.quadraticCurveTo(-0.106 * u, -0.59 * u, -0.112 * u, -0.545 * u);
    q.lineTo(0.114 * u, -0.545 * u);
    q.quadraticCurveTo(0.108 * u, -0.60 * u, 0.126 * u, -0.64 * u);
    q.quadraticCurveTo(0.150 * u, -0.71 * u, 0.132 * u, -0.748 * u);
    q.closePath();
  }, skin, { lw });
  // 肚脐：一笔。胸口不横线——上一版那道线读成了挂着的绳子。
  g.fillStyle = C.line;
  g.beginPath();
  g.ellipse(0.006 * u, -0.583 * u, 0.005 * u, 0.007 * u, 0, 0, Math.PI * 2);
  g.fill();

  // ---- 衣服 ----
  if (woman) {
    // 贴身长裙：从胸下到小腿中段，剪影一笔到底
    ink(g, (q) => {
      q.beginPath();
      q.moveTo(-0.125 * u, -0.706 * u);
      q.quadraticCurveTo(-0.145 * u, -0.62 * u, -0.118 * u, -0.545 * u);
      q.quadraticCurveTo(-0.105 * u, -0.35 * u, -0.098 * u, -0.16 * u);
      q.quadraticCurveTo(-0.096 * u, -0.11 * u, -0.088 * u, -0.085 * u);
      q.lineTo(0.098 * u, -0.085 * u);
      q.quadraticCurveTo(0.098 * u, -0.20 * u, 0.105 * u, -0.36 * u);
      q.quadraticCurveTo(0.118 * u, -0.50 * u, 0.120 * u, -0.60 * u);
      q.quadraticCurveTo(0.122 * u, -0.672 * u, 0.128 * u, -0.706 * u);
      q.closePath();
    }, cloth, { lw });
    // 裙褶：两三道竖线，跟着身子走
    g.strokeStyle = C.line;
    g.lineWidth = lw * 0.62;
    for (const dx of [-0.052, 0.008]) {
      g.beginPath();
      g.moveTo(dx * u, -0.66 * u);
      g.quadraticCurveTo((dx + 0.008) * u, -0.35 * u, (dx + 0.012) * u, -0.10 * u);
      g.stroke();
    }
    // 腰带
    g.strokeStyle = C.gold;
    g.lineWidth = 0.014 * u;
    g.beginPath();
    g.moveTo(-0.117 * u, -0.548 * u);
    g.lineTo(0.12 * u, -0.548 * u);
    g.stroke();
    // 腰带上那个结
    ink(g, (q) => {
      q.beginPath();
      q.ellipse(0.005 * u, -0.545 * u, 0.018 * u, 0.013 * u, 0, 0, Math.PI * 2);
    }, C.red, { lw: lw * 0.7 });
  } else {
    // 男仆：短裙 + 前面一片褶
    ink(g, (q) => {
      q.beginPath();
      q.moveTo(-0.122 * u, -0.555 * u);
      q.lineTo(0.125 * u, -0.555 * u);
      q.lineTo(0.108 * u, -0.395 * u);
      q.lineTo(0.062 * u, -0.415 * u);
      q.lineTo(-0.015 * u, -0.395 * u);
      q.lineTo(-0.108 * u, -0.415 * u);
      q.closePath();
    }, cloth, { lw });
    g.strokeStyle = C.line;
    g.lineWidth = lw * 0.7;
    for (const dx of [-0.07, -0.015, 0.04]) {
      g.beginPath();
      g.moveTo(dx * u, -0.545 * u);
      g.lineTo((dx - 0.01) * u, -0.41 * u);
      g.stroke();
    }
    g.strokeStyle = C.gold;
    g.lineWidth = 0.016 * u;
    g.beginPath();
    g.moveTo(-0.124 * u, -0.558 * u);
    g.lineTo(0.127 * u, -0.558 * u);
    g.stroke();
  }

  // ---- 项圈：贴着锁骨往下弯，不是贴上去的一张椭圆 ----
  const nb = -0.752 * u;
  for (const [rx, ry, col] of [[0.062, 0.030, C.blue], [0.082, 0.041, C.gold], [0.101, 0.052, C.turq]]) {
    g.strokeStyle = col;
    g.lineWidth = 0.014 * u;
    g.beginPath();
    g.ellipse(0, nb, rx * u, ry * u, 0, Math.PI * 0.06, Math.PI * 0.94);
    g.stroke();
  }
  g.strokeStyle = C.line;
  g.lineWidth = lw * 0.5;
  g.beginPath();
  g.ellipse(0, nb, 0.108 * u, 0.057 * u, 0, Math.PI * 0.04, Math.PI * 0.96);
  g.stroke();

  // ---- 脖子 ----
  capsule(g, [P(-0.004, 0.822), P(0.002, 0.752)], [0.031 * u], skin, lw * 0.9);

  // ---- 假发：后面那一团，落到肩上；前缘留在眼睛后面 ----
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(0.031 * u, -0.962 * u);
    q.quadraticCurveTo(0.01 * u, -1.0 * u, -0.055 * u, -0.99 * u);
    q.quadraticCurveTo(-0.125 * u, -0.975 * u, -0.152 * u, -0.90 * u);
    q.quadraticCurveTo(-0.17 * u, -0.85 * u, -0.175 * u, -0.775 * u);
    q.quadraticCurveTo(-0.10 * u, -0.755 * u, -0.03 * u, -0.762 * u);
    q.lineTo(0.012 * u, -0.79 * u);
    q.quadraticCurveTo(0.022 * u, -0.87 * u, 0.031 * u, -0.962 * u);
    q.closePath();
  }, wig, { lw });
  // 假发的几缕竖纹：不是一块死板的深色
  g.strokeStyle = C.line;
  g.lineWidth = lw * 0.55;
  for (const dx of [-0.15, -0.12, -0.09]) {
    g.beginPath();
    g.moveTo(dx * u, -0.90 * u);
    g.quadraticCurveTo((dx - 0.012) * u, -0.83 * u, (dx + 0.006) * u, -0.775 * u);
    g.stroke();
  }
  // 额头前的金头带
  g.strokeStyle = C.gold;
  g.lineWidth = 0.011 * u;
  g.beginPath();
  g.moveTo(0.030 * u, -0.952 * u);
  g.quadraticCurveTo(-0.05 * u, -0.936 * u, -0.135 * u, -0.905 * u);
  g.stroke();

  // ---- 脸：额头 → 眉弓 → 鼻 → 人中 → 嘴 → 下巴 → 颌 ----
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(0.030 * u, -0.958 * u);
    q.quadraticCurveTo(0.060 * u, -0.950 * u, 0.068 * u, -0.920 * u);
    q.quadraticCurveTo(0.074 * u, -0.902 * u, 0.073 * u, -0.892 * u);
    q.lineTo(0.116 * u, -0.874 * u);
    q.quadraticCurveTo(0.126 * u, -0.870 * u, 0.118 * u, -0.866 * u);
    q.lineTo(0.080 * u, -0.860 * u);
    q.quadraticCurveTo(0.092 * u, -0.853 * u, 0.086 * u, -0.849 * u);
    q.quadraticCurveTo(0.093 * u, -0.844 * u, 0.087 * u, -0.840 * u);
    q.quadraticCurveTo(0.080 * u, -0.833 * u, 0.070 * u, -0.829 * u);
    q.quadraticCurveTo(0.045 * u, -0.818 * u, 0.014 * u, -0.812 * u);
    q.quadraticCurveTo(-0.004 * u, -0.840 * u, -0.002 * u, -0.876 * u);
    q.quadraticCurveTo(0.002 * u, -0.916 * u, 0.030 * u, -0.958 * u);
    q.closePath();
  }, skin, { lw });

  // 正面眼：杏仁 + 眼线往后拖 + 眉。这一笔是这个风格的身份证。
  const ex = 0.040 * u;
  const ey = -0.879 * u;
  // 眼白：杏仁。线压在轮廓上，瞳孔只占中间一点——不然 10px 的眼睛会糊成一团
  g.fillStyle = C.white;
  g.strokeStyle = C.line;
  g.lineWidth = lw * 0.52;
  g.beginPath();
  g.moveTo(ex - 0.031 * u, ey + 0.003 * u);
  g.quadraticCurveTo(ex - 0.007 * u, ey - 0.018 * u, ex + 0.023 * u, ey - 0.002 * u);
  g.quadraticCurveTo(ex - 0.005 * u, ey + 0.015 * u, ex - 0.031 * u, ey + 0.003 * u);
  g.closePath();
  g.fill();
  g.stroke();
  // 眼线：往后（朝假发）拖一条细尾——正面眼的标准写法
  g.strokeStyle = C.line;
  g.lineWidth = lw * 0.85;
  g.beginPath();
  g.moveTo(ex - 0.031 * u, ey + 0.003 * u);
  g.lineTo(ex - 0.050 * u, ey - 0.002 * u);
  g.stroke();
  // 瞳孔
  g.fillStyle = C.line;
  g.beginPath();
  g.arc(ex + 0.004 * u, ey - 0.001 * u, 0.0056 * u, 0, Math.PI * 2);
  g.fill();
  // 眉：离眼远一点，别和眼线粘在一起
  g.strokeStyle = C.line;
  g.lineWidth = lw * 0.62;
  g.beginPath();
  g.moveTo(ex - 0.032 * u, ey - 0.027 * u);
  g.quadraticCurveTo(ex - 0.004 * u, ey - 0.039 * u, ex + 0.030 * u, ey - 0.022 * u);
  g.stroke();
  // 耳：压在假发前缘上，就在眼后面
  g.strokeStyle = C.line;
  g.lineWidth = lw * 0.7;
  g.beginPath();
  g.moveTo(-0.006 * u, -0.886 * u);
  g.quadraticCurveTo(-0.030 * u, -0.872 * u, -0.004 * u, -0.852 * u);
  g.stroke();

  // ---- 手臂 ----
  // 远侧手臂：弯过来，手搭在腰上
  const farS = P(-0.122, 0.738);
  const farE = P(-0.168, 0.60);
  const farW = P(-0.045, 0.565);
  capsule(g, [farS, farE, farW], [0.025 * u, 0.019 * u], skinFar, lw);

  // 近侧手臂：垂在身侧，稍微往前，手里那支莲花
  const nearS = P(0.126, 0.735);
  const nearE = P(0.152, 0.595);
  const nearW = P(0.152, 0.47);
  capsule(g, [nearS, nearE, nearW], [0.026 * u, 0.020 * u], skin, lw);

  // 手：掌心 + 三根指头
  const hand = (hx, hy, rot = 0, col = skin) => {
    g.save();
    g.translate(hx, hy);
    g.rotate(rot);
    ink(g, (q) => {
      q.beginPath();
      q.ellipse(0, 0.010 * u, 0.019 * u, 0.028 * u, 0, 0, Math.PI * 2);
    }, col, { lw: lw * 0.85 });
    g.strokeStyle = C.line;
    g.lineWidth = lw * 0.5;
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(i * 0.009 * u, 0.022 * u);
      g.lineTo(i * 0.011 * u, 0.040 * u);
      g.stroke();
    }
    g.restore();
  };

  hand(-0.045 * u, -0.565 * u, 0.3, skinFar);

  if (woman) {
    // 莲花：茎从手里长上去，花在肩头；手先画，指头再压到茎上
    penLot(g, 0.152 * u, -0.47 * u, 0.206 * u, -0.795 * u, 0.056 * u);
    hand(0.152 * u, -0.47 * u, -0.25);
    g.strokeStyle = C.line;
    g.lineWidth = lw * 0.55;
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.moveTo((0.140 + i * 0.008) * u, -0.464 * u);
      g.lineTo((0.160 + i * 0.008) * u, -0.472 * u);
      g.stroke();
    }
  } else {
    hand(0.152 * u, -0.47 * u, -0.15);
  }
  g.restore();
}

/** 一支莲花：细茎从手里往上长到 (tx,ty)，花头开在那里。 */
function penLot(g, x, y, tx, ty, size) {
  g.strokeStyle = C.green;
  g.lineWidth = size * 0.5;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + (tx - x) * 0.15 + size * 0.25, y + (ty - y) * 0.55, tx, ty + size * 0.5);
  g.stroke();
  // 花萼：短折，花头就坐在茎尖上
  g.strokeStyle = C.line;
  g.lineWidth = size * 0.28;
  g.beginPath();
  g.moveTo(tx, ty + size * 0.6);
  g.lineTo(tx, ty + size * 0.25);
  g.stroke();
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(tx, ty + size * 0.3);
    q.quadraticCurveTo(tx - size * 1.15, ty + size * 0.15, tx - size * 0.72, ty - size * 0.75);
    q.quadraticCurveTo(tx - size * 0.18, ty - size * 0.35, tx, ty - size * 1.05);
    q.quadraticCurveTo(tx + size * 0.18, ty - size * 0.35, tx + size * 0.72, ty - size * 0.75);
    q.quadraticCurveTo(tx + size * 1.15, ty + size * 0.15, tx, ty + size * 0.3);
    q.closePath();
  }, C.blue, { lw: size * 0.16 });
}


/**
 * 主角：一个会走路的卡通小孩（白帽、圆眼镜、白 T 恤、短裤、球鞋）。
 *
 * 参考片里这个人不是埃及程式的人，是个现代小孩站在壁画里——"穿越"就靠他。
 * 但他必须站得住：
 *
 *   1. 比例是从参考那一格量出来的（全高 282px）：头 3.55u 宽、T 恤 3.16u 宽、
 *      帽檐 4.54u 宽；腿只有 2.16u，头+帽却占 4.5u。矮、胖、大头——不是四头身。
 *   2. 骨架先定，再铺肉：髋 → 膝 → 踝三段有锥度、关节圆过去，不做矩形管。
 *   3. 一条承重腿踩实（整只脚贴地、底下有影子），一条迈步腿在后
 *      （脚跟已经离地、只有脚趾点地）——重心落在前脚上。
 *   4. 篮子挂在手上：柄先进掌心，再画指头压住柄，果子坐在筐里，不浮。
 *
 * phase: 走一步 2π。脚在地上只平移 ±0.12u，不滑步。
 */
export function figure(g, { x, y, h = 272, face = 1, phase = 0, hat = C.white }) {
  const u = h / 10;
  const L = C.line;
  const lw = 0.14 * u;
  const s = Math.sin(phase);
  const skin = C.skin;
  const skinFar = C.skinDk;
  const shirt = C.white;
  const shorts = C.goldLt;
  const U = (px, py) => [px * u, -py * u];

  g.save();
  g.translate(x, y);
  g.scale(face, 1);
  g.lineJoin = 'round';
  g.lineCap = 'round';

  // ---- 地面：一片淡赭影子，承重脚底下最实 ----
  g.fillStyle = C.wallDk;
  g.beginPath();
  g.ellipse(0.55 * u, -0.02 * u, 1.55 * u, 0.14 * u, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(0.80 * u, -0.02 * u, 0.70 * u, 0.11 * u, 0, 0, Math.PI * 2);
  g.fill();

  // ---- 鞋：局部原点在踝，x 向前，y 向下（0 = 踝，0.50 = 鞋底） ----
  const shoe = (ax, ay, rot, fill) => {
    g.save();
    g.translate(ax * u, -ay * u);
    g.rotate(rot);
    // 鞋底：厚，一圈边
    ink(g, (q) => {
      q.beginPath();
      q.moveTo(-0.52 * u, 0.22 * u);
      q.quadraticCurveTo(-0.62 * u, 0.36 * u, -0.52 * u, 0.50 * u);
      q.quadraticCurveTo(-0.40 * u, 0.57 * u, -0.12 * u, 0.57 * u);
      q.lineTo(0.84 * u, 0.57 * u);
      q.quadraticCurveTo(1.20 * u, 0.56 * u, 1.22 * u, 0.36 * u);
      q.quadraticCurveTo(1.22 * u, 0.22 * u, 1.00 * u, 0.22 * u);
      q.closePath();
    }, C.cream, { lw });
    // 鞋面：脚背拱起，踝处收口
    ink(g, (q) => {
      q.beginPath();
      q.moveTo(-0.48 * u, 0.26 * u);
      q.quadraticCurveTo(-0.52 * u, 0.04 * u, -0.28 * u, -0.04 * u);
      q.quadraticCurveTo(-0.08 * u, -0.10 * u, 0.06 * u, 0.02 * u);
      q.quadraticCurveTo(0.32 * u, 0.18 * u, 0.60 * u, 0.17 * u);
      q.quadraticCurveTo(0.94 * u, 0.14 * u, 1.00 * u, 0.26 * u);
      q.closePath();
    }, fill, { lw });
    // 鞋头、鞋带、鞋口
    g.strokeStyle = L;
    g.lineWidth = lw * 0.6;
    g.beginPath();
    g.moveTo(0.64 * u, 0.18 * u);
    g.quadraticCurveTo(0.76 * u, 0.34 * u, 0.70 * u, 0.46 * u);
    g.stroke();
    g.fillStyle = L;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc((0.26 + i * 0.13) * u, 0.24 * u, 0.021 * u, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = L;
    g.lineWidth = lw * 0.7;
    g.beginPath();
    g.moveTo(0.04 * u, 0.02 * u);
    g.quadraticCurveTo(0.20 * u, 0.20 * u, 0.46 * u, 0.17 * u);
    g.stroke();
    g.restore();
  };

  // ---- 步态：一条腿踩在地上（相对身体往后滑 = 身体往前走），另一条抬起来迈 ----
  // 静帧落点要踩实，所以幅度压在 0.30u；抬脚 0.22u 只给摆动相。
  const stepX = 0.22;
  const stepLift = 0.26;
  const gait = (p) => {
    const T = Math.PI * 2;
    const t = ((p % T) + T) % T;
    if (t < Math.PI) {
      const k = t / Math.PI;
      return { x: stepX * (1 - 2 * k), y: 0, rot: 0, air: 0 };
    }
    const k = (t - Math.PI) / Math.PI;
    const e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);
    return { x: -stepX + 2 * stepX * e, y: Math.sin(Math.PI * k) * stepLift, rot: -0.26 * Math.sin(Math.PI * k), air: 1 };
  };
  const gNear = gait(phase);
  const gFar = gait(phase + Math.PI);

  // ---- 迈步腿（远侧，在后）：膝弯，脚跟已经离地 ----
  const farHip = U(-0.48, 2.88);
  const farKnee = U(-0.74 + gFar.x * 0.7, 1.45 + gFar.y * 0.8);
  const farAnkle = U(-0.94 + gFar.x, 0.72 + gFar.y);
  capsule(g, [farHip, farKnee, farAnkle], [0.84 * u, 0.70 * u], skinFar, lw);
  shoe(-0.94 + gFar.x, 0.72 + gFar.y, 0.38 + gFar.rot, C.cream);

  // ---- 远侧手臂：垂在身后，暗一档 ----
  const farShoulder = U(-1.28, 5.38);
  const farElbow = U(-1.66 - s * 0.09, 4.32);
  const farWrist = U(-1.56 - s * 0.13, 3.22);
  capsule(g, [farShoulder, farElbow, farWrist], [0.50 * u, 0.40 * u], skinFar, lw);
  // 黑腕带
  g.strokeStyle = L;
  g.lineWidth = 0.22 * u;
  g.beginPath();
  g.moveTo((-1.56 - s * 0.13 - 0.14) * u, -3.38 * u);
  g.lineTo((-1.56 - s * 0.13 + 0.15) * u, -3.44 * u);
  g.stroke();
  // 手
  ink(g, (q) => {
    q.beginPath();
    q.ellipse((-1.58 - s * 0.13) * u, -3.04 * u, 0.24 * u, 0.29 * u, -0.12, 0, Math.PI * 2);
  }, skinFar, { lw: lw * 0.9 });

  // ---- 承重腿（近侧，在前）：几乎伸直，整只脚踩实 ----
  const nearHip = U(0.48, 2.88);
  const nearKnee = U(0.68 + gNear.x * 0.7, 1.42 + gNear.y * 0.8);
  const nearAnkle = U(0.76 + gNear.x, 0.50 + gNear.y);
  capsule(g, [nearHip, nearKnee, nearAnkle], [0.86 * u, 0.72 * u], skin, lw);
  shoe(0.76 + gNear.x, 0.50 + gNear.y, gNear.rot, shirt);
  // 膝盖骨
  g.strokeStyle = L;
  g.lineWidth = lw * 0.5;
  g.beginPath();
  g.arc((0.68 + gNear.x * 0.7) * u, -(1.42 + gNear.y * 0.8) * u, 0.28 * u, Math.PI * 1.15, Math.PI * 1.85);
  g.stroke();

  // ---- 短裤：腰紧、裤口略外张 ----
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(-1.32 * u, -3.68 * u);
    q.lineTo(1.32 * u, -3.68 * u);
    q.quadraticCurveTo(1.40 * u, -3.10 * u, 1.38 * u, -2.66 * u);
    q.quadraticCurveTo(1.36 * u, -2.44 * u, 1.22 * u, -2.42 * u);
    q.lineTo(0.26 * u, -2.42 * u);
    q.quadraticCurveTo(0.20 * u, -2.72 * u, 0.00 * u, -2.74 * u);
    q.quadraticCurveTo(-0.20 * u, -2.72 * u, -0.26 * u, -2.42 * u);
    q.lineTo(-1.24 * u, -2.42 * u);
    q.quadraticCurveTo(-1.30 * u, -3.10 * u, -1.32 * u, -3.68 * u);
    q.closePath();
  }, shorts, { lw });
  // 裤缝、裤口、口袋
  g.strokeStyle = L;
  g.lineWidth = lw * 0.5;
  g.beginPath();
  g.moveTo(0.00 * u, -2.74 * u);
  g.lineTo(0.00 * u, -2.44 * u);
  g.moveTo(-1.30 * u, -2.56 * u);
  g.quadraticCurveTo(-0.70 * u, -2.50 * u, -0.30 * u, -2.54 * u);
  g.moveTo(0.32 * u, -2.54 * u);
  g.quadraticCurveTo(0.94 * u, -2.50 * u, 1.36 * u, -2.56 * u);
  g.moveTo(0.62 * u, -3.50 * u);
  g.quadraticCurveTo(0.74 * u, -3.28 * u, 1.22 * u, -3.26 * u);
  g.stroke();

  // ---- 白 T 恤：一件衣服一个剪影（肩、袖、摆连成一条线），
  //      袖子和身子分成两块画就会像贴上去的补丁 ----
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(-0.52 * u, -5.52 * u);                                  // 领口左
    q.quadraticCurveTo(-1.18 * u, -5.52 * u, -1.52 * u, -5.16 * u);   // 远肩
    q.quadraticCurveTo(-1.64 * u, -4.96 * u, -1.58 * u, -4.74 * u);   // 远袖外沿
    q.lineTo(-1.20 * u, -4.74 * u);                                  // 远袖口
    q.quadraticCurveTo(-1.24 * u, -4.20 * u, -1.26 * u, -3.62 * u);   // 远侧缝
    q.lineTo(1.34 * u, -3.62 * u);                                   // 下摆
    q.quadraticCurveTo(1.40 * u, -4.20 * u, 1.46 * u, -4.74 * u);     // 近侧缝
    q.lineTo(1.60 * u, -4.74 * u);                                   // 近袖口
    q.quadraticCurveTo(1.68 * u, -4.96 * u, 1.60 * u, -5.14 * u);
    q.quadraticCurveTo(1.24 * u, -5.48 * u, 0.58 * u, -5.54 * u);     // 近肩
    q.quadraticCurveTo(0.02 * u, -5.34 * u, -0.52 * u, -5.52 * u);    // 领口弧
    q.closePath();
  }, shirt, { lw });
  // 内部：领口、袖口、摆线、侧缝
  g.strokeStyle = L;
  g.lineWidth = lw * 0.45;
  g.beginPath();
  g.moveTo(-0.52 * u, -5.50 * u);
  g.quadraticCurveTo(0.02 * u, -5.32 * u, 0.56 * u, -5.52 * u);
  g.stroke();
  g.beginPath();
  g.moveTo(-1.54 * u, -4.92 * u);
  g.quadraticCurveTo(-1.38 * u, -4.96 * u, -1.22 * u, -4.76 * u);
  g.moveTo(1.58 * u, -4.88 * u);
  g.quadraticCurveTo(1.42 * u, -4.94 * u, 1.44 * u, -4.76 * u);
  g.stroke();
  g.beginPath();
  g.moveTo(-1.24 * u, -3.72 * u);
  g.quadraticCurveTo(0.12 * u, -3.66 * u, 1.32 * u, -3.72 * u);
  g.stroke();
  g.beginPath();
  g.moveTo(1.22 * u, -4.24 * u);
  g.quadraticCurveTo(1.30 * u, -4.78 * u, 1.26 * u, -5.14 * u);
  g.stroke();
  g.beginPath();
  g.moveTo(-1.06 * u, -4.30 * u);
  g.quadraticCurveTo(-1.14 * u, -4.76 * u, -1.12 * u, -5.12 * u);
  g.stroke();

  // ---- 脖子：短，但要有——不然脑袋是浮在肩上的 ----
  capsule(g, [U(0.12, 5.30), U(0.24, 6.10)], [0.46 * u], skin, lw);

  // 头整体下移 0.42u：让下巴坐到肩上，眼睛落到帽檐下面
  g.save();
  g.translate(0, 0.42 * u);

  // ---- 头：大圆脑袋，侧脸（额、鼻、唇、下巴要有折）----
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(-1.44 * u, -7.62 * u);
    q.quadraticCurveTo(-1.64 * u, -8.70 * u, -0.72 * u, -9.38 * u);
    q.quadraticCurveTo(0.30 * u, -9.94 * u, 1.24 * u, -9.26 * u);
    q.quadraticCurveTo(1.66 * u, -8.96 * u, 1.76 * u, -8.52 * u);
    q.quadraticCurveTo(1.79 * u, -8.32 * u, 1.74 * u, -8.22 * u);
    q.quadraticCurveTo(1.80 * u, -8.06 * u, 1.86 * u, -7.84 * u);
    q.lineTo(2.28 * u, -7.58 * u);                                    // 鼻尖
    q.quadraticCurveTo(2.38 * u, -7.50 * u, 2.26 * u, -7.44 * u);     // 鼻底
    q.quadraticCurveTo(2.04 * u, -7.40 * u, 2.00 * u, -7.36 * u);     // 人中
    q.quadraticCurveTo(2.12 * u, -7.26 * u, 2.00 * u, -7.18 * u);     // 上唇
    q.quadraticCurveTo(2.10 * u, -7.08 * u, 1.96 * u, -6.96 * u);     // 下唇
    q.quadraticCurveTo(2.06 * u, -6.74 * u, 1.88 * u, -6.62 * u);     // 下巴（最低点）
    q.quadraticCurveTo(1.58 * u, -6.50 * u, 1.10 * u, -6.42 * u);     // 下颌往上收
    q.quadraticCurveTo(0.40 * u, -6.40 * u, -0.26 * u, -6.46 * u);
    q.quadraticCurveTo(-1.06 * u, -6.56 * u, -1.32 * u, -6.98 * u);
    q.quadraticCurveTo(-1.48 * u, -7.30 * u, -1.44 * u, -7.62 * u);
    q.closePath();
  }, skin, { lw });

  // 头发：帽檐下漏出来的一圈（只画帽檐下面看得见的那一段）+ 鬓角
  g.fillStyle = L;
  g.beginPath();
  g.moveTo(-1.46 * u, -7.66 * u);
  g.quadraticCurveTo(-1.40 * u, -8.02 * u, -0.80 * u, -8.16 * u);
  g.quadraticCurveTo(0.20 * u, -8.26 * u, 1.10 * u, -8.16 * u);
  g.quadraticCurveTo(0.60 * u, -8.02 * u, 0.10 * u, -7.94 * u);
  g.quadraticCurveTo(-0.70 * u, -7.86 * u, -1.10 * u, -7.58 * u);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(-1.32 * u, -7.80 * u);
  g.quadraticCurveTo(-1.56 * u, -7.20 * u, -1.22 * u, -6.80 * u);
  g.quadraticCurveTo(-1.06 * u, -7.10 * u, -1.04 * u, -7.50 * u);
  g.closePath();
  g.fill();

  // 耳
  g.strokeStyle = L;
  g.lineWidth = lw * 0.6;
  g.beginPath();
  g.moveTo(-0.62 * u, -7.30 * u);
  g.quadraticCurveTo(-0.90 * u, -7.10 * u, -0.60 * u, -6.88 * u);
  g.stroke();

  // ---- 眼 + 圆眼镜：一片镜片 + 一条镜腿，眼白、瞳孔、上眼睑都分开 ----
  const ex = 1.24 * u;
  const ey = -7.34 * u;
  ink(g, (q) => {
    q.beginPath();
    q.ellipse(ex, ey, 0.35 * u, 0.31 * u, 0, 0, Math.PI * 2);
  }, C.white, { lw: lw * 0.45 });
  g.fillStyle = L;
  g.beginPath();
  g.arc(ex + 0.10 * u, ey, 0.215 * u, 0, Math.PI * 2);
  g.fill();
  // 上眼睑：压得比下眼睑重
  g.strokeStyle = L;
  g.lineWidth = lw * 0.7;
  g.beginPath();
  g.arc(ex, ey, 0.35 * u, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
  // 镜框
  g.lineWidth = 0.105 * u;
  g.beginPath();
  g.arc(ex + 0.03 * u, ey - 0.01 * u, 0.49 * u, 0, Math.PI * 2);
  g.stroke();
  // 镜腿：往后挂到耳上
  g.lineWidth = 0.10 * u;
  g.beginPath();
  g.moveTo(ex - 0.46 * u, ey - 0.22 * u);
  g.lineTo(-0.66 * u, ey - 0.12 * u);
  g.stroke();
  // 鼻梁：从镜框往鼻尖那边伸一小截，读成"架在鼻子上"
  g.lineWidth = 0.10 * u;
  g.beginPath();
  g.moveTo(ex + 0.50 * u, ey - 0.18 * u);
  g.lineTo(ex + 0.68 * u, ey - 0.16 * u);
  g.stroke();
  // 眉
  g.lineWidth = lw * 0.65;
  g.beginPath();
  g.moveTo(ex - 0.44 * u, ey - 0.62 * u);
  g.quadraticCurveTo(ex - 0.02 * u, ey - 0.78 * u, ex + 0.40 * u, ey - 0.56 * u);
  g.stroke();
  // 嘴：在镜片下面，不在镜片里面
  g.lineWidth = lw * 0.5;
  g.beginPath();
  g.moveTo(1.80 * u, -6.74 * u);
  g.quadraticCurveTo(1.94 * u, -6.66 * u, 2.02 * u, -6.76 * u);
  g.stroke();

  g.restore();

  // ---- 帽：宽檐桶帽，帽檐压低、往前塌 ----
  if (hat) {
    // 帽檐：一片压扁的椭圆，用帽顶压住上半
    ink(g, (q) => {
      q.beginPath();
      q.moveTo(-2.52 * u, -7.72 * u);                                  // 左端（布边垂下来）
      q.quadraticCurveTo(-1.30 * u, -8.24 * u, 0.14 * u, -8.32 * u);    // 上缘
      q.quadraticCurveTo(1.56 * u, -8.34 * u, 2.46 * u, -7.62 * u);     // 右端
      q.quadraticCurveTo(1.42 * u, -7.70 * u, 0.14 * u, -7.76 * u);     // 下缘
      q.quadraticCurveTo(-1.26 * u, -7.78 * u, -2.52 * u, -7.72 * u);
      q.closePath();
    }, hat, { lw });
    // 帽顶：低、软
    ink(g, (q) => {
      q.beginPath();
      q.moveTo(-1.84 * u, -8.06 * u);
      q.quadraticCurveTo(-1.94 * u, -9.04 * u, -1.30 * u, -9.70 * u);
      q.quadraticCurveTo(-0.32 * u, -10.02 * u, 0.76 * u, -9.80 * u);
      q.quadraticCurveTo(1.44 * u, -9.70 * u, 1.66 * u, -9.16 * u);
      q.quadraticCurveTo(1.76 * u, -8.76 * u, 1.72 * u, -8.04 * u);
      q.quadraticCurveTo(0.10 * u, -7.84 * u, -1.84 * u, -8.06 * u);
      q.closePath();
    }, hat, { lw });
    g.strokeStyle = L;
    g.lineWidth = lw * 0.45;
    g.beginPath();
    g.moveTo(-1.78 * u, -9.10 * u);
    g.quadraticCurveTo(0.06 * u, -9.50 * u, 1.64 * u, -9.00 * u);
    g.stroke();
    g.beginPath();
    g.moveTo(-1.90 * u, -8.06 * u);
    g.quadraticCurveTo(0.16 * u, -8.28 * u, 1.90 * u, -8.04 * u);
    g.stroke();
  }

  // ---- 篮子：柄 → 掌心 → 指头压在柄上 ----
  const bx = 1.62 * u;
  const rimY = -2.52 * u;
  const wristY = -3.34 * u;
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(bx - 0.74 * u, rimY);
    q.quadraticCurveTo(bx - 0.70 * u, rimY + 0.62 * u, bx - 0.36 * u, rimY + 0.72 * u);
    q.lineTo(bx + 0.36 * u, rimY + 0.72 * u);
    q.quadraticCurveTo(bx + 0.70 * u, rimY + 0.62 * u, bx + 0.74 * u, rimY);
    q.closePath();
  }, C.gold, { lw });
  for (const [dx, dy, r, col] of [[-0.36, 0.06, 0.23, C.red], [0.02, 0.00, 0.25, C.green], [0.38, 0.08, 0.22, C.redBr]]) {
    ink(g, (q) => {
      q.beginPath();
      q.arc(bx + dx * u, rimY - dy * u, r * u, 0, Math.PI * 2);
    }, col, { lw: lw * 0.6 });
  }
  ink(g, (q) => {
    q.beginPath();
    q.ellipse(bx, rimY, 0.76 * u, 0.20 * u, 0, 0, Math.PI * 2);
  }, C.gold, { lw });
  g.strokeStyle = L;
  g.lineWidth = lw * 0.45;
  g.beginPath();
  g.moveTo(bx - 0.68 * u, rimY + 0.28 * u);
  g.quadraticCurveTo(bx, rimY + 0.44 * u, bx + 0.68 * u, rimY + 0.28 * u);
  g.stroke();
  g.beginPath();
  g.moveTo(bx - 0.58 * u, rimY + 0.52 * u);
  g.quadraticCurveTo(bx, rimY + 0.66 * u, bx + 0.58 * u, rimY + 0.52 * u);
  g.stroke();
  // 柄
  g.strokeStyle = C.gold;
  g.lineWidth = 0.11 * u;
  g.beginPath();
  g.moveTo(bx - 0.66 * u, rimY - 0.04 * u);
  g.quadraticCurveTo(bx - 0.36 * u, wristY + 0.12 * u, bx, wristY);
  g.quadraticCurveTo(bx + 0.36 * u, wristY + 0.12 * u, bx + 0.66 * u, rimY - 0.04 * u);
  g.stroke();
  g.strokeStyle = L;
  g.lineWidth = 0.04 * u;
  g.stroke();

  // ---- 近侧手臂：前臂伸到篮柄，掌心包住柄 ----
  const nearShoulder = U(1.22, 5.40);
  const nearElbow = U(1.56, 4.30);
  const nearWrist = [bx, wristY];
  capsule(g, [nearShoulder, nearElbow, nearWrist], [0.50 * u, 0.40 * u], skin, lw);
  // 掌心：盖在柄顶
  ink(g, (q) => {
    q.beginPath();
    q.moveTo(bx - 0.25 * u, wristY - 0.18 * u);
    q.quadraticCurveTo(bx, wristY - 0.30 * u, bx + 0.25 * u, wristY - 0.16 * u);
    q.lineTo(bx + 0.23 * u, wristY + 0.22 * u);
    q.quadraticCurveTo(bx, wristY + 0.28 * u, bx - 0.23 * u, wristY + 0.20 * u);
    q.closePath();
  }, skin, { lw: lw * 0.75 });
  // 指头压在柄上
  g.strokeStyle = L;
  g.lineWidth = lw * 0.4;
  for (let i = 0; i < 3; i++) {
    const fx = bx + (i - 1) * 0.14 * u;
    g.beginPath();
    g.moveTo(fx, wristY + 0.04 * u);
    g.quadraticCurveTo(fx + 0.02 * u, wristY + 0.16 * u, fx, wristY + 0.25 * u);
    g.stroke();
  }
  // 拇指绕到柄的另一侧
  ink(g, (q) => {
    q.beginPath();
    q.ellipse(bx - 0.25 * u, wristY + 0.12 * u, 0.10 * u, 0.15 * u, -0.4, 0, Math.PI * 2);
  }, skin, { lw: lw * 0.5 });

  g.restore();
}




const LUT = {};

export function flatten(g, w, h, palette) {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const luma = (r, gg, b) => 0.2126 * r + 0.7152 * gg + 0.0722 * b;

  // 一次性建两张 32k 查找表（5 bit/通道）。15 色的最近色不逐像素算——
  // 逐像素算的话 1920×1080 要 65ms，查表是 30ms 的零头。
  if (!LUT.rgb) {
    const rgb = palette.map((hex) => {
      const n = parseInt(hex.replace("#", ""), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    });
    const entries = rgb.map((c, idx) => ({ c, idx }));
    const darkSet = entries.filter((e) => luma(...e.c) < 110);
    const lightSet = entries.filter((e) => luma(...e.c) >= 110);
    const build = (set) => {
      const t = new Uint8Array(32768);
      for (let i = 0; i < 32768; i++) {
        const r = ((i >> 10) & 31) * 8 + 4;
        const gg = ((i >> 5) & 31) * 8 + 4;
        const b = (i & 31) * 8 + 4;
        let best = set[0].idx;
        let dist = Infinity;
        for (const e of set) {
          const dd = (r - e.c[0]) ** 2 + (gg - e.c[1]) ** 2 + (b - e.c[2]) ** 2;
          if (dd < dist) {
            dist = dd;
            best = e.idx;
          }
        }
        t[i] = best;
      }
      return t;
    };
    // 深色和浅色分开找：不分开的话，3px 描边有一半像素被判成墙色，线会断。
    LUT.rgb = rgb;
    LUT.dark = build(darkSet.length ? darkSet : entries);
    LUT.light = build(lightSet.length ? lightSet : entries);

    // 颜料浓淡：一张 64×64 噪声贴片循环用。
    const n = new Float32Array(64 * 64);
    let seed = 7;
    for (let i = 0; i < n.length; i++) {
      seed = (seed * 1664525 + 1013904223) | 0;
      n[i] = ((seed >>> 8) / 0x1000000 - 0.5) * 9;
    }
    LUT.noise = n;
  }

  const { rgb, dark, light } = LUT;

  // 低频斑：20–60px 的块状明暗，像颜料在灰泥上吸得厚薄不匀。
  // 之前那版是每像素 ±4 的哈希噪声，盲评的原话是"高频噪点叠层"——方向就错了。
  if (!LUT.blobs) {
    const N = 24, BL = 48;
    const field = new Float32Array(N * N);
    let seed = 11;
    for (let i = 0; i < field.length; i++) {
      seed = (seed * 1664525 + 1013904223) | 0;
      field[i] = (seed >>> 8) / 0x1000000;
    }
    LUT.blobs = { N, BL, field };
  }
  const { N, BL, field } = LUT.blobs;
  // 双线性取样，得到 20–60px 的平滑斑块
  const blob = (x, y) => {
    const fx = x / BL, fy = y / BL;
    const x0 = Math.floor(fx) % N, y0 = Math.floor(fy) % N;
    const x1 = (x0 + 1) % N, y1 = (y0 + 1) % N;
    const tx = fx - Math.floor(fx), ty = fy - Math.floor(fy);
    const a0 = field[y0 * N + x0], a1 = field[y0 * N + x1];
    const b0 = field[y1 * N + x0], b1 = field[y1 * N + x1];
    return (a0 * (1 - tx) + a1 * tx) * (1 - ty) + (b0 * (1 - tx) + b1 * tx) * ty;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) << 2;
      const r = d[i];
      const gg = d[i + 1];
      const b = d[i + 2];
      const key = ((r >> 3) << 10) | ((gg >> 3) << 5) | (b >> 3);
      const dark_ = luma(r, gg, b) < 110;
      const q = rgb[(dark_ ? dark : light)[key]];

      const dv = (blob(x, y) - 0.5) * 16;        // ±8 的低频浓淡

      d[i] = q[0] + dv;
      d[i + 1] = q[1] + dv;
      d[i + 2] = q[2] + dv * 0.8;
    }
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

// ---- 墙面：照参考的实现（lib/paint.js 的 P.texture / surface / grain）----
//
// 关键差别：他们的墙不是平涂 + 后期噪点，而是**画的时候就带 fBm 纹理**，
// 再乘一张全幅 surface（两层 fBm），最后撒一层 grain。
// 之前的 flatten(15 色) 恰好把这些全压平了——那就是"矢量感"的来源。

const fade = (t) => t * t * (3 - 2 * t);
const perm = (() => {
  const p = new Uint8Array(512);
  const r = rng(11);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (r() * (i + 1)) | 0;
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 256; i++) p[256 + i] = p[i];
  return p;
})();
const grad = (h, x, y) => {
  const g = h & 7;
  const u = g < 4 ? x : y;
  const v = g < 4 ? y : x;
  return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v);
};
export const noise2 = (x, y) => {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const a = perm[X] + Y, b = perm[X + 1] + Y;
  return (
    (1 - v) * ((1 - u) * grad(perm[a], x, y) + u * grad(perm[b], x - 1, y)) +
    v * ((1 - u) * grad(perm[a + 1], x, y - 1) + u * grad(perm[b + 1], x - 1, y - 1))
  ) / 1.5;
};
export const fbm = (x, y, oct = 4) => {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); a *= 0.5; f *= 2; }
  return s;
};

const hexRgb = (h) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixRgb = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** 一张带 fBm 斑驳的墙：底色 + 多八度噪声 + 细颗粒，可选压向 dark。 */
export function wallTexture(w, h, { base = C.wall, dark = C.wallDk, scale = 0.004, amt = 26, grain = 14, seed = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data;
  const b = hexRgb(base), dk = hexRgb(dark), r = rng(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm(x * scale + seed, y * scale, 5);
      const gr = (r() - 0.5) * grain;
      const i = (y * w + x) * 4;
      const c2 = mixRgb(b, dk, Math.min(1, Math.max(0, n * 1.2 + 0.25)));
      d[i] = c2[0] + n * amt + gr;
      d[i + 1] = c2[1] + n * amt + gr;
      d[i + 2] = c2[2] + n * amt * 0.8 + gr;
      d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * 全幅表面层：两层 fBm 的明度场（2×2 像素一块写，所以是"纹理"不是"噪点"），
 * 外加六条随机游走的发丝裂纹。用 multiply 盖在整幅上——包括人物。
 */
export function frescoSurface(w, h, { seed = 99 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data, r = rng(seed);
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const n = fbm(x * 0.006 + 40, y * 0.006, 4);
      const m = fbm(x * 0.03, y * 0.03 + 9, 2);
      const v = 243 + n * 30 + m * 12 + (r() - 0.5) * 18;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        if (x + dx >= w || y + dy >= h) continue;
        const i = ((y + dy) * w + x + dx) * 4;
        d[i] = v; d[i + 1] = v - 6; d[i + 2] = v - 16; d[i + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
  // 发丝裂纹：从画外某点随机游走，跨过整幅（包括人物）——那是墙老了，不是画脏了
  const rr = rng(5);
  const starts = [[0, h * 0.56, 0.1], [w * 0.36, 0, 1.3], [w * 0.63, 0, 1.1], [w * 0.78, h, -0.9], [w * 0.2, h, -1.2], [w, h * 0.39, 2.9]];
  for (let [x, y, a] of starts) {
    g.strokeStyle = 'rgba(90,70,50,0.55)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 34; s++) {
      a += (rr() - 0.5) * 0.7;
      x += Math.cos(a) * 14;
      y += Math.sin(a) * 14;
      g.lineTo(x, y);
      if (rr() < 0.08) g.moveTo(x, y);
    }
    g.stroke();
  }
  return c;
}

/** 颗粒：稀疏的深色点，叠在表面层之上。 */
export function specks(w, h, { density = 0.018, color = [70, 50, 30], alpha = 0.4, seed = 3 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h), d = img.data, r = rng(seed);
  for (let i = 0; i < w * h; i++) {
    if (r() < density) {
      d[i * 4] = color[0]; d[i * 4 + 1] = color[1]; d[i * 4 + 2] = color[2];
      d[i * 4 + 3] = 255 * alpha * (0.4 + r() * 0.6);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}
