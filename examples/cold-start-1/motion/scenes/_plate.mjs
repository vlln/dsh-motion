// scenes/_plate.mjs — 媒介层：纸、墨、刻线、版痕、相机
//
// 这是本片唯一的画法。规格来自量过的三幅参考（见 motion/镜头表.md 第 2 节）：
//   · 亮 = 没印的纸；暗 = 刻线之间的墨；最深 = 小面积实墨
//   · 所有灰度由**线距**生成，全片没有一处渐变/模糊/发光
//   · 线条是"刻"出来的：略抖、粗细不匀、偶尔崩口
//   · 版内是画，版外是纸（版痕 + 版下窄边小字）
//
// 相机只缩放**几何**，不缩放刻痕：每一镜等于同一张版的另一块，线宽、线距恒为屏幕像素。

export const SHEET = { w: 1920, h: 1080 };

// 版框（世界坐标 = 印张坐标，1920×1080 的纸）
export const PLATE = { x: 130, y: 40, w: 1660, h: 856 };

// 量的色值（参考三幅的中间调取整）
export const C = {
  paper: '#eee3cd', // 纸
  ink: '#221d17', // 墨（暖黑）
  red: '#9c3a26', // 朱红副版：茶水与热度
  soft: '#8a7d6a', // 淡墨
  pale: '#d8c9ad', // 纸灰（纤维、细线）
  wash: '#f4ebda', // 浅纸（叠在纸上的一点亮）
  tone: '#7d7864',
  plateTone: '#e5d7ba', // 版的底色：整块版压过的地方比纸边沉一点点 // 调子版：第二块版压上去的平色（量自 chiaroscuro 参考 #77786b）
};

/** 稳定哈希噪声：位置决定抖动量，与绘制次数无关（逐帧一致、可裁剪）。 */
export function hnoise(i, seed = 0) {
  let h = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
const sgn = (i, seed) => hnoise(i, seed) * 2 - 1;

/** 世界 → 屏幕。只缩几何。 */
export function view(scale, cx, cy, W, H) {
  const k = scale;
  const l = cx - W / 2 / k;
  const r = cx + W / 2 / k;
  const t = cy - H / 2 / k;
  const b = cy + H / 2 / k;
  return {
    s: k,
    cx,
    cy,
    l,
    r,
    t,
    b,
    x: (wx) => (wx - cx) * k + W / 2,
    y: (wy) => (wy - cy) * k + H / 2,
    dx: (d) => d * k,
    visibleX: (x0, x1) => x1 > l && x0 < r,
    visibleY: (y0, y1) => y1 > t && y0 < b,
  };
}

/* ---------------------------------- 纸 ---------------------------------- */

/** mount 里生成一次：纤维与黄斑（逐帧不变，所以不逐帧摇）。 */
export function makePaperBits(rand, scale = 1) {
  const fiber = [];
  for (let i = 0; i < 340; i++) {
    fiber.push({
      x: rand() * 1920,
      y: rand() * 1080,
      len: 5 + rand() * 26,
      a: (rand() - 0.5) * 0.7 + (rand() < 0.3 ? Math.PI / 2 : 0),
      w: 0.5 + rand() * 0.8,
      c: rand() < 0.55 ? C.pale : rand() < 0.6 ? C.soft : C.wash,
      al: 0.05 + rand() * 0.09,
    });
  }
  const fox = [];
  for (let i = 0; i < 26; i++) {
    fox.push({ x: rand() * 1920, y: rand() * 1080, r: 0.7 + rand() * 2.2, al: 0.05 + rand() * 0.08 });
  }
  return { fiber, fox, scale };
}

export function paper(g, W, H, bits, under) {
  g.fillStyle = C.paper;
  g.fillRect(0, 0, W, H);
  if (under) under();
  // 纸纤维：短毛，三种极淡的色，不叠成噪点层
  for (const f of bits.fiber) {
    g.strokeStyle = f.c;
    g.globalAlpha = f.al;
    g.lineWidth = f.w;
    g.beginPath();
    g.moveTo(f.x, f.y);
    g.lineTo(f.x + Math.cos(f.a) * f.len, f.y + Math.sin(f.a) * f.len);
    g.stroke();
  }
  // 黄斑
  g.fillStyle = C.soft;
  for (const f of bits.fox) {
    g.globalAlpha = f.al;
    g.beginPath();
    g.arc(f.x, f.y, f.r, 0, 7);
    g.fill();
  }
  g.globalAlpha = 1;
}

/* --------------------------------- 刻线 --------------------------------- */

/**
 * 一排平行刻线。灰由线距生成：gapAt(u) 给这一根的间距，u 沿法线 0..1。
 * 线本身带抖（垂直方向 ±wob），粗细按线号轻微变化，偶尔断墨（dashGap）。
 */
export function field(
  g,
  { cx, cy, angle = 0, span, gap = 8, gapAt, w = 1.4, alpha = 1, color = C.ink, seed = 1, wob = 0.6, ext = 2600, breaks = 0 },
) {
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  g.strokeStyle = color;
  g.lineCap = 'butt';
  const [a, b] = span;
  const len = b - a || 1;
  let p = a;
  let i = 0;
  g.globalAlpha = alpha;
  const x0 = -ext / 2;
  const x1 = ext / 2;
  while (p < b && i < 2400) {
    const u = (p - a) / len;
    const lw = w * (0.82 + 0.36 * hnoise(i, seed + 7));
    // 一根线最多断两处：断口位置逐线不同（否则缺口会连成一列竖缝）
    let segs = [[x0, x1]];
    const cuts = breaks > 0 ? (hnoise(i, seed + 4) < breaks * 0.5 ? 1 : 0) + (hnoise(i, seed + 5) < breaks * 0.28 ? 1 : 0) : 0;
    for (let k = 0; k < cuts; k++) {
      const c = x0 + (x1 - x0) * (0.08 + hnoise(i * 13 + k, seed + 6) * 0.84);
      const half = (x1 - x0) * (0.012 + hnoise(i * 17 + k, seed + 7) * 0.045);
      const next = [];
      for (const [sa, sb] of segs) {
        if (c > sa && c < sb) next.push([sa, c - half], [c + half, sb]);
        else next.push([sa, sb]);
      }
      segs = next;
    }
    for (const [sa, sb] of segs) {
      const j0 = sgn(i * 3 + (sa | 0), seed) * wob;
      const j1 = sgn(i * 5 + (sb | 0), seed + 2) * wob;
      g.lineWidth = lw * (0.78 + 0.52 * hnoise(i * 9 + (sa | 0), seed + 3));
      g.beginPath();
      g.moveTo(sa, p + j0);
      g.lineTo((sa + sb) / 2, p + (j0 + j1) / 2 + sgn(i + (sa | 0), seed + 4) * wob);
      g.lineTo(sb, p + j1);
      g.stroke();
    }
    const gNext = gapAt ? gapAt(Math.min(1, Math.max(0, u))) : gap;
    p += Math.max(1.2, gNext * (0.88 + 0.24 * hnoise(i, seed + 11)));
    i++;
  }
  g.globalAlpha = 1;
  g.restore();
}

/** 一条手刻的线：由点列组成，带抖动，两端略收。 */
export function cutLine(g, pts, { w = 2, color = C.ink, alpha = 1, seed = 5, wob = 0.5, taper = 0 } = {}) {
  if (pts.length < 2) return;
  g.save();
  g.strokeStyle = color;
  g.globalAlpha = alpha;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (!taper) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const j = sgn(i, seed) * wob;
      g.lineTo(pts[i][0], pts[i][1] + j);
    }
    g.stroke();
  } else {
    // 锥形：一段一段画，收笔处变细（刻线的起刀与收刀）
    for (let i = 1; i < pts.length; i++) {
      const t = i / (pts.length - 1);
      g.lineWidth = w * (1 - taper * t);
      g.beginPath();
      g.moveTo(pts[i - 1][0], pts[i - 1][1] + sgn(i, seed) * wob);
      g.lineTo(pts[i][0], pts[i][1] + sgn(i + 1, seed) * wob);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
  g.restore();
}

/** 实墨：一块硬边黑。里面点几粒纸白的针孔，墨才不像矢量色块。 */
export function inkFill(g, path, { color = C.ink, alpha = 1, specks = 0, seed = 3, box } = {}) {
  g.save();
  g.fillStyle = color;
  g.globalAlpha = alpha;
  g.fill(path);
  if (specks && box) {
    g.fillStyle = C.paper;
    for (let i = 0; i < specks; i++) {
      const x = box.x + hnoise(i * 3 + 1, seed) * box.w;
      const y = box.y + hnoise(i * 3 + 2, seed) * box.h;
      g.globalAlpha = 0.28 + hnoise(i, seed + 9) * 0.5;
      g.beginPath();
      g.arc(x, y, 0.5 + hnoise(i * 7, seed) * 1.3, 0, 7);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  g.restore();
}

/* -------------------------------- 版与纸边 -------------------------------- */

export function plateTone(g, V) {
  g.save();
  g.fillStyle = C.plateTone;
  g.fillRect(V.x(PLATE.x), V.y(PLATE.y), V.dx(PLATE.w), V.dx(PLATE.h));
  g.restore();
}

export function clipPlate(g, V) {
  const p = new Path2D();
  p.rect(V.x(PLATE.x), V.y(PLATE.y), V.dx(PLATE.w), V.dx(PLATE.h));
  g.clip(p);
}

/** 版痕：压出来的凹边——版外一道细影，版内一道压亮。 */
export function plateMark(g, V) {
  const x = V.x(PLATE.x);
  const y = V.y(PLATE.y);
  const w = V.dx(PLATE.w);
  const h = V.dx(PLATE.h);
  if (x > 1920 || y > 1080 || x + w < 0 || y + h < 0) return;
  g.save();
  // 版痕：一道压暗的边 + 一道压亮的边（版的斜面）
  g.strokeStyle = C.muted;
  g.globalAlpha = 0.8;
  g.lineWidth = 3.2;
  g.strokeRect(x + 3.5, y + 3.5, w - 1, h - 1);
  g.strokeStyle = C.ink;
  g.globalAlpha = 0.5;
  g.lineWidth = 1.3;
  g.strokeRect(x, y, w, h);
  g.strokeStyle = C.wash;
  g.globalAlpha = 0.9;
  g.lineWidth = 1.6;
  g.strokeRect(x - 4, y - 4, w + 8, h + 8);
  g.globalAlpha = 1;
  g.restore();
}

/** 版下的窄边：一道细横线 + 一点墨屑，小字由场景 drawText 负责。 */
export function colophonRule(g, V) {
  const y = V.y(PLATE.y + PLATE.h + 28);
  const x0 = V.x(PLATE.x + PLATE.w / 2 - 118);
  const x1 = V.x(PLATE.x + PLATE.w / 2 + 118);
  cutLine(g, [[x0, y], [(x0 + x1) / 2, y], [x1, y]], { w: 1.3, color: C.soft, alpha: 0.75, seed: 41, wob: 0.4 });
}
