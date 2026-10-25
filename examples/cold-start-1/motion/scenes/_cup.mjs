// scenes/_cup.mjs — 这一张版上的世界：墙、光、桌面、盏、茶、蒸汽、叶
//
// 一张版画同一块版可以印很多张；本片的四镜就是同一张版上的四个取景。
// 所以这里只写一次世界，四个场景各自给一个 view（缩放 + 中心点）和一段时间。
//
// 世界坐标 = 印张坐标（1920×1080）。
// 规矩：灰由线距生成；暗部是一小块实墨；亮部是没印的纸；没有渐变。

import { C, PLATE, paper, plateMark, plateTone, clipPlate, field, cutLine, inkFill, hnoise } from './_plate.mjs';

export const G = {
  wallY: 690, // 桌面后沿：一条横线把画面压下
  corner: 612, // 墙角：左边受光（线疏），右边背光（线密）
  mouth: { cx: 1130, cy: 470, rx: 245, ry: 64 },
  footTop: { cx: 1130, cy: 782, rx: 152 },
  footBot: { cx: 1130, cy: 808, rx: 146, ry: 22 },
  tea: { cx: 1133, cy: 484, rx: 220, ry: 45 }, // 朱红副版：比主版错开 3px
  saucer: { cx: 1130, cy: 806, rx: 330, ry: 72 },
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

/** 全片的"冷"曲线：11.4 秒里从 1 走到 0，10.6 秒时归零（最后一缕蒸汽就在那里断）。 */
export const heatAt = (gt) => Math.pow(clamp((10.6 - gt) / 10.6, 0, 1), 1.05);
/** 薄皮从盏壁往盏心爬的比例。 */
export const filmAt = (gt) => clamp((gt - 6.9) / 4.2, 0, 1);
/** 茶叶下沉 0..1。 */
export const leafAt = (gt) => clamp((gt - 6.6) / 3.0, 0, 1);

/* ------------------------------- 小工具 ------------------------------- */

function ell(V, e, kx = 1, ky = 1) {
  const p = new Path2D();
  p.ellipse(V.x(e.cx), V.y(e.cy), V.dx(e.rx * kx), V.dx(e.ry * ky), 0, 0, Math.PI * 2);
  return p;
}

/** 一段刻线：中间粗两端细，用来画顺体积的排线（不是尺子线）。 */
function burin(g, x, y0, y1, { w = 1.6, bend = 0, color = C.ink, alpha = 1, seed = 1 } = {}) {
  const n = 4;
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let k = 0; k < n; k++) {
    const u0 = k / n;
    const u1 = (k + 1) / n;
    const p0 = y0 + (y1 - y0) * u0;
    const p1 = y0 + (y1 - y0) * u1;
    const taper = Math.sin(Math.PI * ((u0 + u1) / 2)) * 0.45 + 0.55;
    g.globalAlpha = alpha;
    g.lineWidth = w * taper;
    g.beginPath();
    g.moveTo(x + bend * Math.sin(Math.PI * u0), p0);
    g.lineTo(x + bend * Math.sin(Math.PI * u1), p1);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/* -------------------------------- 世界 -------------------------------- */

export function world(g, V, st) {
  const { gt, heat, film, leaf, bits } = st;
  const W = st.W;
  const H = st.H;
  const lightX = gt * 2.0 - 8; // 窗光缓慢右移：太阳在走

  // 纸 → 版的底色 → 纸纤维（纤维压在版色上，纸才还是一张纸）
  paper(g, W, H, bits, () => plateTone(g, V));

  g.save();
  clipPlate(g, V);
  wall(g, V, lightX);
  table(g, V, lightX);
  shadows(g, V);
  saucer(g, V);
  cup(g, V, { gt, t: st.t, heat, film, leaf });
  steam(g, V, gt, heat);
  g.restore();
  plateMark(g, V);
}

/* --------------------------------- 墙 --------------------------------- */



function wall(g, V, lightX) {
  const top = PLATE.y;
  const bot = G.wallY;
  if (!V.visibleY(top, bot)) return;
  const cx = V.x(PLATE.x + PLATE.w / 2);
  const cy = V.y((top + bot) / 2);
  const ext = V.dx(PLATE.w) + 60;
  const span = [-(bot - top) / 2 * V.s, (bot - top) / 2 * V.s];

  // 光柱的形状就是光斑的形状——木刻里"亮"是刻掉版刻出来的
  const beamPts = [
    [PLATE.x - 24, top],
    [268 + lightX, top],
    [470 + lightX, bot + 4],
    [PLATE.x - 24, bot + 4],
  ];
  const beam = new Path2D();
  beam.moveTo(V.x(beamPts[0][0]), V.y(beamPts[0][1]));
  beam.lineTo(V.x(beamPts[1][0]), V.y(beamPts[1][1]));
  // 右边那条是刀刻的边：一段一段地切，不是一条直线
  const N = 26;
  for (let k = 1; k <= N; k++) {
    const u = k / N;
    const x = beamPts[1][0] + (beamPts[2][0] - beamPts[1][0]) * u + (hnoise(k, 55) - 0.5) * 5;
    const y = beamPts[1][1] + (beamPts[2][1] - beamPts[1][1]) * u;
    beam.lineTo(V.x(x), V.y(y));
  }
  beam.lineTo(V.x(beamPts[3][0]), V.y(beamPts[3][1]));
  beam.closePath();

  g.save();
  const all = new Path2D();
  all.rect(V.x(PLATE.x), V.y(top), V.dx(PLATE.w), V.dx(bot - top));
  g.clip(all);

  // 调子版：一整块平色（第二块版）。版是滚墨压上去的，边是刀刻出来的。
  g.fillStyle = C.tone;
  g.fill(all);
  // 刻掉光柱：这里露出纸
  g.fillStyle = C.paper;
  g.fill(beam);

  // 主版：细线压在调子版上（黑压灰，读成纹理，不是灰阶）
  g.save();
  g.clip(all);
  field(g, { cx, cy, angle: 0, span, gap: 6.6, gapAt: (u) => 5.8 + u * 3.4, w: 1.05, color: C.ink, alpha: 0.42, seed: 21, wob: 0.5, ext, breaks: 0.35 });
  g.restore();

  // 光柱里：只剩几根刻线，其余是纸
  g.save();
  g.clip(beam);
  field(g, { cx, cy, angle: 0, span, gap: 24, gapAt: (u) => 18 + u * 12, w: 0.95, color: C.ink, alpha: 0.5, seed: 25, wob: 1.0, ext: V.dx(760), breaks: 0.9 });
  g.restore();

  // 调子版上和光柱边上的刀痕：几道刻掉的白线，破掉"一整块平色"
  g.save();
  g.clip(all);
  for (let i = 0; i < 16; i++) {
    const y = top + 24 + hnoise(i, 41) * (bot - top - 48);
    const x = PLATE.x + 40 + hnoise(i, 43) * (PLATE.w - 180);
    cutLine(g, [[x, y], [x + 60 + hnoise(i, 45) * 110, y + 3]], {
      w: 4 + hnoise(i, 46) * 7,
      color: C.ink,
      alpha: 0.05 + hnoise(i, 47) * 0.07,
      seed: 400 + i,
      wob: 0.6,
    });
  }
  g.restore();

  g.restore();

  // 墙脚：桌面后沿
  cutLine(g, [[PLATE.x, G.wallY], [PLATE.x + PLATE.w, G.wallY]], { w: 3.4, color: C.ink, alpha: 0.95, seed: 31, wob: 0.9 });
  g.save();
  g.fillStyle = C.ink;
  g.globalAlpha = 0.25;
  g.fillRect(V.x(PLATE.x), V.y(G.wallY), V.dx(PLATE.w), V.dx(8));
  g.globalAlpha = 1;
  g.restore();
}


function table(g, V, lightX) {
  const top = G.wallY;
  const bot = PLATE.y + PLATE.h;
  if (!V.visibleY(top, bot)) return;
  const spillPts = [
    [250 + lightX * 1.3, top],
    [545 + lightX * 1.3, top],
    [706 + lightX * 1.3, bot + 8],
    [336 + lightX * 1.3, bot + 8],
  ];
  const spill = new Path2D();
  spill.moveTo(V.x(spillPts[0][0]), V.y(spillPts[0][1]));
  for (let i = 1; i < spillPts.length; i++) spill.lineTo(V.x(spillPts[i][0]), V.y(spillPts[i][1]));
  spill.closePath();

  g.save();
  const clip = new Path2D();
  clip.rect(V.x(PLATE.x), V.y(top), V.dx(PLATE.w), V.dx(bot - top));
  clip.addPath(spill);
  g.clip(clip, 'evenodd');
  // 桌面：斜切 4° 的排线，和墙的方向差开（否则桌面读成第二面墙）
  field(g, {
    cx: V.x(PLATE.x + PLATE.w / 2),
    cy: V.y((top + bot) / 2),
    angle: -0.075,
    span: [-(bot - top) / 2 * V.s - 30, (bot - top) / 2 * V.s + 30],
    gap: 9,
    gapAt: (u) => 7 + u * 5,
    w: 1.4,
    seed: 61,
    wob: 0.45,
    ext: V.dx(PLATE.w) + 60,
    breaks: 0.3,
  });
  // 木纹：两根更重的长线
  for (let i = 0; i < 2; i++) {
    const y = top + 52 + i * 62 + hnoise(i, 131) * 12;
    cutLine(g, [[PLATE.x + 20, y], [PLATE.x + 660, y + 7], [PLATE.x + PLATE.w - 20, y + 2]], {
      w: 2.2,
      color: C.ink,
      alpha: 0.3,
      seed: 140 + i,
      wob: 1.0,
      taper: 0.5,
    });
  }
  g.restore();

  // 光斑里：线刻掉大半（桌面上的一块亮）
  g.save();
  g.clip(spill);
  field(g, {
    cx: V.x(460),
    cy: V.y((top + bot) / 2),
    angle: -0.075,
    span: [-(bot - top) / 2 * V.s, (bot - top) / 2 * V.s],
    gap: 26,
    gapAt: (u) => 19 + u * 13,
    w: 1.1,
    alpha: 0.75,
    seed: 67,
    wob: 0.8,
    ext: V.dx(620),
    breaks: 0.85,
  });
  g.restore();
  // 光斑的边：光到这里为止
  cutLine(g, [[spillPts[1][0], spillPts[1][1]], [spillPts[2][0], spillPts[2][1]]], {
    w: 1.4,
    color: C.ink,
    alpha: 0.45,
    seed: 69,
    wob: 1.4,
  });
}



function shadows(g, V) {
  const s = G.saucer;
  // 盏托压在桌上投下的影：一块硬边实墨（参考里投影就是一块实墨）
  const pts = [
    [s.cx + 150, s.cy + 8],
    [s.cx + 340, s.cy + 16],
    [s.cx + 470, s.cy + 54],
    [s.cx + 430, s.cy + 84],
    [s.cx + 240, s.cy + 78],
    [s.cx + 60, s.cy + 56],
  ];
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(V.x(x), V.y(y)) : p.moveTo(V.x(x), V.y(y))));
  p.closePath();
  inkFill(g, p, { alpha: 0.9 });
  // 影子贴着桌沿的那一道更实
  g.save();
  g.strokeStyle = C.ink;
  g.globalAlpha = 0.95;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(V.x(s.cx + 180), V.y(s.cy + 12));
  g.lineTo(V.x(s.cx + 430), V.y(s.cy + 48));
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
}

function saucer(g, V) {
  const s = G.saucer;
  g.save();
  g.fillStyle = C.paper;
  g.fill(ell(V, s));
  g.restore();

  // 托面的车削圆环（同心细线），不是辐条
  g.save();
  g.strokeStyle = C.soft;
  for (const k of [0.34, 0.56, 0.76]) {
    g.globalAlpha = 0.5;
    g.lineWidth = 1.1;
    g.beginPath();
    g.ellipse(V.x(s.cx), V.y(s.cy), V.dx(s.rx * k), V.dx(s.ry * k), 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();

  // 托沿：外圈实线 + 内侧一条细线（瓷的厚度）
  g.save();
  g.strokeStyle = C.ink;
  g.lineCap = 'round';
  g.lineWidth = 2.6;
  g.beginPath();
  g.ellipse(V.x(s.cx), V.y(s.cy), V.dx(s.rx), V.dx(s.ry), 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = C.soft;
  g.lineWidth = 1.2;
  g.beginPath();
  g.ellipse(V.x(s.cx), V.y(s.cy + 3), V.dx(s.rx * 0.94), V.dx(s.ry * 0.9), 0, 0, Math.PI * 2);
  g.stroke();
  // 近侧托沿下的影：一条粗的、压在下缘
  g.strokeStyle = C.ink;
  g.globalAlpha = 0.6;
  g.lineWidth = 5.5;
  g.beginPath();
  g.ellipse(V.x(s.cx), V.y(s.cy + 3), V.dx(s.rx * 0.995), V.dx(s.ry * 0.97), 0, 0.12, Math.PI - 0.12);
  g.stroke();
  // 远侧托沿的亮边：纸白一道
  g.strokeStyle = C.paper;
  g.globalAlpha = 0.9;
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(V.x(s.cx), V.y(s.cy), V.dx(s.rx * 0.99), V.dx(s.ry * 0.99), 0, Math.PI + 0.25, Math.PI * 2 - 0.3);
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
}

/* --------------------------------- 盏 --------------------------------- */

/** 盏的外轮廓：口沿 → 左壁（外鼓）→ 圈足 → 右壁 → 口沿远侧。 */
function bowlPath(V) {
  const m = G.mouth;
  const ft = G.footTop;
  const fb = G.footBot;
  const p = new Path2D();
  p.moveTo(V.x(m.cx - m.rx), V.y(m.cy));
  p.bezierCurveTo(V.x(m.cx - m.rx - 1), V.y(572), V.x(906), V.y(716), V.x(ft.cx - ft.rx), V.y(ft.cy));
  p.lineTo(V.x(fb.cx - fb.rx), V.y(fb.cy));
  p.ellipse(V.x(fb.cx), V.y(fb.cy), V.dx(fb.rx), V.dx(fb.ry), 0, Math.PI, 0, true);
  p.lineTo(V.x(ft.cx + ft.rx), V.y(ft.cy));
  p.bezierCurveTo(V.x(1354), V.y(716), V.x(m.cx + m.rx + 1), V.y(572), V.x(m.cx + m.rx), V.y(m.cy));
  p.ellipse(V.x(m.cx), V.y(m.cy), V.dx(m.rx), V.dx(m.ry), 0, 0, Math.PI, true);
  p.closePath();
  return p;
}


function cup(g, V, { gt, t, heat, film, leaf }) {
  const m = G.mouth;
  const ft = G.footTop;
  const body = bowlPath(V);

  // 1 盏身：整块纸（把墙与桌面的刻线让开）
  g.save();
  g.fillStyle = C.paper;
  g.fill(body);
  g.restore();

  g.save();
  const clipBody = new Path2D();
  clipBody.addPath(body);
  const hole = new Path2D();
  hole.ellipse(V.x(m.cx), V.y(m.cy), V.dx(m.rx * 0.99), V.dx(m.ry * 0.99), 0, 0, Math.PI * 2);
  clipBody.addPath(hole);
  g.clip(clipBody, 'evenodd');

  // 2 轮制纹：一圈一圈的车削环，顺器形走。这是盏的体积，不是装饰。
  const rxAt = (y) => {
    const t2 = clamp((ft.cy - y) / (ft.cy - m.cy), 0, 1);
    return ft.rx + (m.rx - ft.rx) * Math.pow(t2, 0.78);
  };
  const ringFade = (u) => Math.max(0, 1 - smooth(0.42, 0.88, u));
  for (let y = m.cy + 26; y < ft.cy - 2; y += 21) {
    const rx = rxAt(y);
    const SEG = 12;
    for (let k = 0; k < SEG; k++) {
      const a0 = 0.14 + (Math.PI - 0.28) * (k / SEG);
      const a1 = 0.14 + (Math.PI - 0.28) * ((k + 1) / SEG);
      const um = 0.5 + 0.5 * Math.cos((a0 + a1) / 2);
      const al = 0.46 * ringFade(um);
      if (al < 0.02) continue;
      g.strokeStyle = C.ink;
      g.globalAlpha = al;
      g.lineWidth = 1.15;
      g.beginPath();
      g.ellipse(V.x(m.cx), V.y(y), V.dx(rx * 0.985), V.dx(rx * 0.26), 0, a0, a1);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  // 3 暗面排线：光从左上来。线略斜（顺柱面），越靠右越密；
  //   靠明暗界线的地方线不满高——版画里暗部是"长"出来的，不是贴上去的。
  const L = m.cx - m.rx;
  const R = m.cx + m.rx;
  const bandOf = (u) => {
    if (u < 0.5) return 0;
    if (u < 0.62) return 34;
    if (u < 0.75) return 18;
    if (u < 0.87) return 10;
    if (u < 0.955) return 5.6;
    return 0; // 最右一线反光
  };
  let x = L;
  let guard = 0;
  let idx = 0;
  while (x < R && guard < 1400) {
    const u = (x - L) / (R - L);
    const gap = bandOf(u);
    if (gap > 0) {
      const sx = V.x(x);
      if (sx > -40 && sx < 1960) {
        const t2 = (x - m.cx) / m.rx;
        const topY = m.cy - m.ry * Math.sqrt(Math.max(0, 1 - t2 * t2));
        // 越靠近界线，起刀越晚（暗部从下往上长）
        // 界线附近起刀略晚、颜色略淡：暗部是长出来的，不是贴上去的
        const near = Math.max(0, 1 - (u - 0.5) / 0.26);
        const y0 = topY + 8 + near * (16 + hnoise(idx, 91) * 30) + hnoise(idx, 77) * 14;
        const y1 = ft.cy + 4 - hnoise(idx, 78) * 8;
        const w = gap < 7 ? 2.1 : gap < 13 ? 1.8 : 1.5;
        if (y1 - y0 > 14) {
          cutLine(g, [[sx, V.y(y0)], [sx - V.dx((y1 - y0) * 0.13), V.y(y1)]], {
            w,
            color: C.ink,
            alpha: 0.92 - near * 0.34,
            seed: 500 + idx,
            wob: 0.4,
            taper: 0.45,
          });
        }
      }
    }
    x += gap > 0 ? gap : 10;
    guard++;
    idx++;
  }

  // 4 明暗界线：一条更重的刻线（版画里交界线是画出来的，不是算出来的）
  {
    const uT = 0.545;
    const xt = L + (R - L) * uT;
    const t2 = (xt - m.cx) / m.rx;
    const topY = m.cy - m.ry * Math.sqrt(Math.max(0, 1 - t2 * t2));
    burin(g, V.x(xt), V.y(topY + 8), V.y(ft.cy + 2), { w: 1.7, bend: -6 * V.s, alpha: 0.5, seed: 11 });
  }
  g.restore();

  // 5 圈足：短而密的一段（整只盏最暗的地方）
  g.save();
  g.beginPath();
  g.rect(V.x(ft.cx - ft.rx - 6), V.y(ft.cy - 6), V.dx(ft.rx * 2 + 12), V.dx(G.footBot.ry * 2 + 12));
  g.clip();
  let fx = ft.cx - ft.rx;
  let fi = 0;
  while (fx < ft.cx + ft.rx && fi < 200) {
    const u = (fx - (ft.cx - ft.rx)) / (ft.rx * 2);
    const gap = u < 0.4 ? 9 : 4.8;
    burin(g, V.x(fx), V.y(ft.cy - 2), V.y(G.footBot.cy + 4), { w: gap < 6 ? 2.2 : 1.6, alpha: 0.95 });
    fx += gap;
    fi++;
  }
  g.restore();

  // 6 外轮廓：粗，且刻两遍（手工的边不齐）
  g.save();
  g.strokeStyle = C.ink;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 6;
  g.stroke(body);
  g.globalAlpha = 0.85;
  g.lineWidth = 2.6;
  g.stroke(body);
  g.globalAlpha = 1;
  g.restore();

  // 7 圈足底：一道实墨的接触影 + 一道纸白的反光
  g.save();
  g.strokeStyle = C.ink;
  g.lineWidth = 4;
  g.globalAlpha = 0.95;
  g.beginPath();
  g.ellipse(V.x(G.footBot.cx), V.y(G.footBot.cy + 1), V.dx(G.footBot.rx), V.dx(G.footBot.ry), 0, 0.15, Math.PI - 0.15);
  g.stroke();
  g.strokeStyle = C.paper;
  g.lineWidth = 2.2;
  g.globalAlpha = 0.8;
  g.beginPath();
  g.ellipse(V.x(G.footBot.cx), V.y(G.footBot.cy - 1), V.dx(G.footBot.rx * 0.86), V.dx(G.footBot.ry * 0.8), 0, Math.PI + 0.2, Math.PI * 2 - 0.25);
  g.stroke();
  g.globalAlpha = 1;
  g.restore();

  // 8 口沿：双线。远侧细、近侧粗（近的那半圈离眼睛近）
  g.save();
  g.strokeStyle = C.ink;
  g.lineCap = 'round';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(V.x(m.cx), V.y(m.cy), V.dx(m.rx * 0.955), V.dx(m.ry * 0.925), 0, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(V.x(m.cx), V.y(m.cy), V.dx(m.rx), V.dx(m.ry), 0, 0.06, Math.PI - 0.06);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(V.x(m.cx), V.y(m.cy), V.dx(m.rx), V.dx(m.ry), 0, Math.PI + 0.06, Math.PI * 2 - 0.06);
  g.stroke();
  g.restore();

  // 9 盏内壁：远侧那一条（茶面之上），右边暗
  g.save();
  const inner = new Path2D();
  inner.ellipse(V.x(m.cx), V.y(m.cy), V.dx(m.rx * 0.94), V.dx(m.ry * 0.9), 0, Math.PI, 0, true);
  inner.ellipse(V.x(G.tea.cx), V.y(G.tea.cy), V.dx(G.tea.rx), V.dx(G.tea.ry), 0, 0, Math.PI, true);
  g.clip(inner, 'evenodd');
  field(g, {
    cx: V.x(m.cx + 60),
    cy: V.y(m.cy - 26),
    angle: 1.15,
    span: [-V.dx(30), V.dx(26)],
    gap: 5.5,
    gapAt: (u) => 4.4 + u * 3,
    w: 1.15,
    alpha: 0.55,
    color: C.ink,
    seed: 121,
    wob: 0.35,
    ext: V.dx(m.rx * 2),
    breaks: 0.2,
  });
  g.restore();

  // 10 茶
  tea(g, V, { gt, t, heat, film, leaf });
}

function tea(g, V, { gt, t, heat, film, leaf }) {
  const e = G.tea;
  const deep = '#7a2c1d';

  g.save();
  g.fillStyle = C.red;
  g.globalAlpha = 0.95;
  g.fill(ell(V, e));
  g.globalAlpha = 1;

  // 茶汤的暗面：右半边压一层深红的排线（朱红版自己也有暗部）
  g.save();
  g.clip(ell(V, e));
  for (let i = 0; i < 26; i++) {
    const x = e.cx + 10 + i * 9.5;
    if (x > e.cx + e.rx) break;
    const t = (x - e.cx) / e.rx;
    const hh = e.ry * Math.sqrt(Math.max(0, 1 - t * t));
    g.strokeStyle = deep;
    g.globalAlpha = 0.55;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(V.x(x), V.y(e.cy - hh + 3));
    g.lineTo(V.x(x + 3), V.y(e.cy + hh - 3));
    g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();

  // 茶沿：近侧一道厚的深边（液体贴着瓷的地方）
  g.save();
  g.strokeStyle = deep;
  g.globalAlpha = 0.95;
  g.lineWidth = 3.4;
  g.beginPath();
  g.ellipse(V.x(e.cx), V.y(e.cy + 1), V.dx(e.rx), V.dx(e.ry), 0, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;
  g.restore();

  // 液面反光：三道纸白的刻线，慢慢游（母题循环之二）
  for (let i = 0; i < 3; i++) {
    const ph = i * 2.1;
    const yy = e.cy + 4 + i * 10 + Math.sin(heat * 2.2 + ph) * 3;
    const xx = e.cx - 78 + i * 52 + Math.cos(heat * 1.6 + ph) * 16;
    const len = 40 - i * 7;
    cutLine(g, [[xx - len, yy], [xx, yy - 1.6], [xx + len * 0.7, yy + 1]], {
      w: 2.8 - i * 0.4,
      color: C.paper,
      alpha: 0.9 - i * 0.18,
      seed: 300 + i,
      wob: 0.5,
      taper: 0.6,
    });
  }

  // 涟漪：开头那一圈，两秒内收住
  // 涟漪：这一镜自己的秒表（第一镜开头那一圈）
  if (t < 2.2) {
    const k = clamp((2.2 - t) / 2.2, 0, 1);
    for (let i = 0; i < 3; i++) {
      const r = 0.3 + 0.66 * Math.pow(clamp(k - i * 0.17, 0, 1), 0.65);
      if (r <= 0.06) continue;
      g.save();
      g.strokeStyle = C.paper;
      g.globalAlpha = 0.5 * clamp(k * 2.2 - i * 0.4, 0, 1);
      g.lineWidth = 2.4;
      g.beginPath();
      g.ellipse(V.x(e.cx), V.y(e.cy), V.dx(e.rx * r), V.dx(e.ry * r), 0, 0.45, Math.PI - 0.45);
      g.stroke();
      g.restore();
    }
  }

  // 薄皮：从盏壁往盏心爬的一条纸白细线（凉了的证据）
  if (film > 0.01) {
    const f = Math.min(1, film);
    g.save();
    g.strokeStyle = C.paper;
    g.globalAlpha = 0.55 + 0.35 * f;
    g.lineWidth = 1.8;
    g.beginPath();
    g.ellipse(V.x(e.cx), V.y(e.cy + 3), V.dx(e.rx * (0.985 - 0.44 * f)), V.dx(e.ry * (0.985 - 0.52 * f)), 0, 0.1, 0.1 + (Math.PI - 0.2) * f);
    g.stroke();
    if (f > 0.5) {
      const aa = 0.1 + (Math.PI - 0.2) * f * 0.6;
      const rx = e.rx * (0.985 - 0.44 * f);
      const ry = e.ry * (0.985 - 0.52 * f);
      const px = e.cx + Math.cos(aa) * rx;
      const py = e.cy + 3 + Math.sin(aa) * ry;
      cutLine(g, [[px, py], [px + 30, py + 10], [px + 62, py + 7]], { w: 1.5, color: C.paper, alpha: 0.42, seed: 311, wob: 0.5 });
    }
    g.restore();
  }

  // 茶叶：翻面、沉底
  // 叶子沉下去：留在茶面里，翻转、变小、被茶汤吃掉（不越过茶沿）
  const sink = leaf;
  const ly = e.cy + 4 + sink * 26 + Math.sin(heat * 3) * 1.6;
  const lx = e.cx + 62 + Math.sin(heat * 2.4 + 1) * 7 - sink * 8;
  g.save();
  g.clip(ell(V, e));
  leafMark(g, V, lx, ly, 132 - 30 * sink, 68 * (1 - 0.56 * sink), -0.34 + sink * 1.25, 0.92 - 0.5 * sink);
  g.restore();
  g.restore();
}

function leafMark(g, V, cx, cy, len, wid, rot, alpha = 0.9) {
  const L = V.dx(len / 2);
  const H = Math.max(1.8, V.dx(wid / 2));
  g.save();
  g.translate(V.x(cx), V.y(cy));
  g.rotate(rot);
  // 叶身：一头尖、一头圆，略有弧度
  const p = new Path2D();
  p.moveTo(-L, 0);
  p.bezierCurveTo(-L * 0.55, -H * 1.05, L * 0.55, -H * 0.95, L, -H * 0.06);
  p.bezierCurveTo(L * 0.5, H * 0.95, -L * 0.55, H * 1.1, -L, 0);
  p.closePath();
  g.fillStyle = C.ink;
  g.globalAlpha = alpha;
  g.fill(p);
  g.globalAlpha = 1;
  // 叶柄
  g.strokeStyle = C.ink;
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(-L * 0.95, 0);
  g.lineTo(-L * 1.22, H * 0.12);
  g.stroke();
  // 主脉与侧脉：纸白的刻线（刻掉的地方才是亮的）
  g.strokeStyle = C.paper;
  g.globalAlpha = 0.5;
  g.lineWidth = 1.3;
  g.beginPath();
  g.moveTo(-L * 0.86, 0);
  g.quadraticCurveTo(0, -H * 0.16, L * 0.82, -H * 0.02);
  g.stroke();
  for (let i = 1; i <= 4; i++) {
    const xx = -L * 0.6 + i * L * 0.34;
    g.globalAlpha = 0.32;
    g.beginPath();
    g.moveTo(xx, -H * 0.06);
    g.lineTo(xx + L * 0.1, -H * 0.62);
    g.moveTo(xx + 3, -H * 0.02);
    g.lineTo(xx + L * 0.1, H * 0.55);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();
}

/* -------------------------------- 蒸汽 -------------------------------- */

/**
 * 蒸汽 = 纸白的缎带，从茶面升起。凉写成三件事：缕数变少、缎带变短、断口变宽。
 * heat 归零时一缕不剩。
 */

function steam(g, V, gt, heat) {
  if (heat <= 0.006) return;
  const n = Math.max(1, Math.min(4, Math.round(heat * 4.4)));
  const baseY = G.mouth.cy - 6;
  const rise = smooth(0.12, 1.15, gt); // 开头第一秒：蒸汽立起来
  for (let i = 0; i < n; i++) {
    const ph = i * 1.63;
    const dir = i % 2 ? 1 : -1;
    const x0 = G.mouth.cx + Math.sin(i * 2.31 + 1.2) * 54 * (0.4 + 0.6 * heat);
    const len = (256 + 92 * Math.sin(i * 1.17 + 0.6)) * (0.5 + 0.5 * heat) * rise;
    const ampW = 20 + 11 * Math.sin(i * 0.9);
    // 热的时候是一整根；凉下去才断成几截
    const segs = heat > 0.62 ? 1 : heat > 0.32 ? 2 : 3;
    const gapW = (1 - heat) * 44 + 6;
    for (let s = 0; s < segs; s++) {
      const yTop = baseY - s * (len / segs + gapW);
      const segLen = (len / segs) * (1 - 0.1 * s);
      const yEnd = yTop - segLen;
      if (!V.visibleY(yEnd - 90, yTop + 10)) continue;
      ribbon(g, V, {
        x0,
        dir,
        amp: ampW,
        yBot: yTop,
        yEnd,
        t: gt,
        ph,
        w: (5.6 + 2.2 * Math.sin(i * 1.7)) * (0.55 + 0.45 * heat),
      });
    }
  }
}


function ribbon(g, V, { x0, dir, amp, yBot, yEnd, t, ph, w }) {
  const N = 22;
  const pts = [];
  for (let k = 0; k <= N; k++) {
    const u = k / N;
    const y = yBot + (yEnd - yBot) * u;
    const wander = Math.sin(u * 2.6 + t * 0.95 + ph) * amp * (0.2 + u * 1.05) * dir;
    const curl = Math.sin(u * 1.35 - t * 0.6 + ph * 0.5) * amp * 0.45 * dir;
    pts.push([x0 + wander + curl, y, u]);
  }
  const left = [];
  const right = [];
  for (let k = 0; k <= N; k++) {
    const u = pts[k][2];
    // 根细、中段宽、梢尖；单位是屏幕像素（刻痕不随取景变粗）
    const hw = (w * Math.sin(Math.PI * (0.13 + 0.87 * u)) * (1 - 0.5 * u) + 0.25) / V.s;
    const [x, y] = pts[k];
    const [xn, yn] = pts[Math.min(N, k + 1)];
    const dx = xn - x;
    const dy = yn - y;
    const L = Math.hypot(dx, dy) || 1;
    left.push([x - (dy / L) * hw, y + (dx / L) * hw]);
    right.push([x + (dy / L) * hw, y - (dx / L) * hw]);
  }
  g.save();
  g.fillStyle = C.paper;
  g.globalAlpha = 0.95;
  g.beginPath();
  g.moveTo(V.x(left[0][0]), V.y(left[0][1]));
  for (let k = 1; k <= N; k++) g.lineTo(V.x(left[k][0]), V.y(left[k][1]));
  for (let k = N; k >= 0; k--) g.lineTo(V.x(right[k][0]), V.y(right[k][1]));
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  g.restore();
}

