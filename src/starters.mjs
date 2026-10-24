// The empty workspace is a gallery, not an error page: a wall of short loops
// someone can watch, copy the recipe of, or hand to the agent to build for real.
//
// Every tile is a genuine animation — a pure function of time, drawn with canvas
// 2D — so the first screen of a moving-image tool actually moves. The language
// (near-black ground, monospace micro-labels, one hairline, a single blue
// accent) is shared on purpose: ten studies, one studio.

export const LOOP_SECONDS = 6;

export const CATEGORIES = ['全部', '文字排版', '信息图解', '界面演示', '场景叙事', '背景特效'];

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const outCubic = (v) => 1 - (1 - clamp01(v)) ** 3;
const span = (t, from, to) => ease((t - from) / (to - from));
const noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const SANS =
  '-apple-system, "system-ui", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

const INK = '#e8e8e6';
const DIM = '#8a8a88';
const FAINT = '#6d6d6b';
const HAIRLINE = 'rgba(255, 255, 255, 0.1)';
const ACCENT = '#5b83ff';
const GOLD = '#e3bd63';

function ground(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#111113');
  sky.addColorStop(1, '#09090a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
}

/** Fade in and out by veiling with the ground, not by lowering canvas alpha. */
function veil(g, w, h, t) {
  const fade = 1 - Math.min(1, t / 0.5) * Math.min(1, (LOOP_SECONDS - t) / 0.55);
  if (fade <= 0) return;
  g.save();
  g.globalAlpha = fade;
  ground(g, w, h);
  g.restore();
}

function micro(g, text, x, y, size, color, p, track = '0.26em') {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = p;
  g.fillStyle = color;
  g.font = `400 ${size}px ${MONO}`;
  g.letterSpacing = track;
  g.fillText(text, x, y);
  g.letterSpacing = '0em';
  g.restore();
}

function rule(g, x, y, width, p) {
  if (p <= 0) return;
  g.save();
  g.strokeStyle = HAIRLINE;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + width * ease(p), y);
  g.stroke();
  g.restore();
}

/** Copy is written for this engine, not for anyone else's. */
const brief = (what, detail) =>
  `${what}。${detail} 写在工作区的 motion/ 里（timeline.json + scenes），跑 \`dsh-motion validate\`，` +
  '再把关键帧给我看。';

export const SAMPLES = [
  {
    id: 'bars',
    title: '基线',
    tag: '文字排版',
    ratio: 16 / 9,
    prompt: brief(
      '复刻这个动效：近黑底，一根根细柱从基线按顺序长出来，每条晚一点、十几帧长成，底部一行 FRAME 计数',
      '要求：等宽微标签、一条 1px 分隔线、只用一个蓝色强调数字，别的装饰都不要；柱子要「长」出来，不是滑进来。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.075;
      const base = h * 0.79;
      const inner = w - pad * 2;
      const count = 30;
      const step = inner / count;
      const barW = Math.max(2, step * 0.36);
      const wave = [];
      for (let i = 0; i < count; i++) {
        const v = Math.sin(i * 0.42 + 1.1) * 0.5 + 0.5;
        wave.push(0.1 + v * 0.86 * (0.7 + 0.3 * Math.sin(i * 0.13)));
      }
      const tallest = Math.max(...wave) * h * 0.36;
      const fill = g.createLinearGradient(0, base, 0, base - tallest);
      fill.addColorStop(0, '#3d3d3d');
      fill.addColorStop(1, '#ededed');
      g.fillStyle = fill;
      for (let i = 0; i < count; i++) {
        const p = outCubic((t - 0.3 - i * 0.026) / 0.42);
        if (p <= 0) continue;
        const height = wave[i] * h * 0.36 * p;
        g.fillRect(pad + i * step, base - height, barW, height);
      }
      g.save();
      g.globalAlpha = span(t, 0.15, 0.6);
      g.fillStyle = 'rgba(255, 255, 255, 0.18)';
      g.fillRect(pad, base, inner * span(t, 0.15, 1), 1);
      g.restore();

      micro(g, 'THROUGHPUT', pad, h * 0.17, h * 0.042, DIM, span(t, 0.2, 0.7), '0.3em');
      rule(g, pad, h * 0.855, inner, (t - 0.9) / 0.9);

      g.save();
      g.globalAlpha = span(t, 1.3, 1.9);
      g.font = `400 ${h * 0.038}px ${MONO}`;
      g.letterSpacing = '0.22em';
      g.fillStyle = FAINT;
      g.fillText('FRAME ', pad, h * 0.925);
      const stampW = g.measureText('FRAME ').width;
      g.fillStyle = ACCENT;
      g.fillText('268', pad + stampW, h * 0.925);
      g.letterSpacing = '0em';
      g.restore();
      veil(g, w, h, t);
    },
  },

  {
    id: 'label',
    title: '展签',
    tag: '文字排版',
    ratio: 16 / 9,
    prompt: brief(
      '复刻这个动效：像美术馆墙签一样排版——一行等宽小标签、一行大标题、一行等宽注记，右侧一个压得很暗的编号',
      '要求：近黑底、大量留白、一条 1px 线；动效只有十几像素的上升与淡入，按帧错开，不要字幕式弹跳。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.075;
      const tick = span(t, 0.15, 0.55);
      g.save();
      g.globalAlpha = tick;
      g.fillStyle = ACCENT;
      g.fillRect(pad, h * 0.3, Math.max(2, w * 0.006), h * 0.09 * tick);
      g.restore();

      const x = pad + w * 0.03;
      const rise = (p) => (1 - p) * h * 0.035;
      micro(g, 'STUDY 01', x, h * 0.3 + rise(span(t, 0.25, 0.85)), h * 0.038, DIM, span(t, 0.25, 0.85), '0.3em');

      const titleP = span(t, 0.4, 1.05);
      g.save();
      g.globalAlpha = titleP;
      g.fillStyle = INK;
      g.font = `400 ${h * 0.105}px ${SANS}`;
      g.letterSpacing = '-0.015em';
      g.fillText('The long orbit', x, h * 0.45 + rise(titleP));
      g.letterSpacing = '0em';
      g.restore();

      micro(g, 'cast · a note on distance', x, h * 0.53 + rise(span(t, 0.6, 1.2)), h * 0.036, FAINT, span(t, 0.6, 1.2), '0.16em');

      g.save();
      g.globalAlpha = span(t, 0.5, 1.2) * 0.06;
      g.fillStyle = INK;
      g.font = `400 ${h * 0.42}px ${MONO}`;
      g.textAlign = 'right';
      g.fillText('01', w - pad, h * 0.62);
      g.textAlign = 'left';
      g.restore();

      rule(g, pad, h * 0.855, w - pad * 2, (t - 1.1) / 0.9);
      micro(g, '16:10 · 6s loop', pad, h * 0.925, h * 0.036, FAINT, span(t, 1.5, 2), '0.18em');
      veil(g, w, h, t);
    },
  },

  {
    id: 'count',
    title: '计时',
    tag: '文字排版',
    ratio: 16 / 9,
    prompt: brief(
      '复刻这个动效：等宽大数字从 000 滚到 268，下面一行小注记，一条 1px 进度线带着蓝色针脚走完',
      '要求：近黑底、只有一个数字和一个蓝点做强调，不要别的元素；数字用缓出，结尾停住一拍。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.075;
      const p = outCubic((t - 0.35) / 1.6);
      const value = Math.round(268 * p);
      const size = h * 0.27;

      g.save();
      g.font = `400 ${size}px ${MONO}`;
      g.letterSpacing = '-0.03em';
      g.fillStyle = INK;
      g.fillText(String(value).padStart(3, '0'), pad, h * 0.56);
      const numberW = g.measureText('000').width;
      g.letterSpacing = '0em';
      g.restore();

      g.save();
      g.globalAlpha = span(t, 0.5, 1);
      g.fillStyle = ACCENT;
      const dot = Math.max(2, h * 0.014);
      g.fillRect(pad + numberW + h * 0.02, h * 0.56 - dot, dot, dot);
      g.restore();

      micro(g, 'FRAMES AT 30 FPS', pad, h * 0.65, h * 0.036, FAINT, span(t, 0.9, 1.5), '0.2em');
      const lineY = h * 0.79;
      const width = w - pad * 2;
      rule(g, pad, lineY, width, (t - 0.3) / 1);

      g.save();
      g.strokeStyle = ACCENT;
      g.lineWidth = Math.max(1, h * 0.0035);
      g.beginPath();
      g.moveTo(pad, lineY);
      g.lineTo(pad + width * span(t, 0.4, 2.4), lineY);
      g.stroke();
      g.restore();

      micro(g, 'TAKE 04', pad, h * 0.925, h * 0.036, FAINT, span(t, 1.7, 2.2), '0.22em');
      veil(g, w, h, t);
    },
  },

  {
    id: 'ticker',
    title: '滚动字',
    tag: '文字排版',
    ratio: 4 / 5,
    prompt: brief(
      '复刻这个动效：三行超大无衬线字横向反向缓慢滚动，行与行速度不同，边缘由画布裁切',
      '要求：近黑底、字距收紧、灰度有薄厚（一行亮、两行暗），只有一条等宽小标签；速度要慢到能读，不要整屏乱飞。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.075;
      micro(g, 'KINETIC TYPE', pad, h * 0.12, h * 0.028, DIM, span(t, 0.1, 0.6), '0.3em');

      const rows = [
        { word: 'MOVE', y: 0.32, speed: -0.11, color: INK },
        { word: 'TIME', y: 0.5, speed: 0.08, color: FAINT },
        { word: 'FRAME', y: 0.68, speed: -0.055, color: DIM },
      ];
      const size = h * 0.14;
      for (const row of rows) {
        g.save();
        g.beginPath();
        g.rect(0, h * row.y - size * 1.05, w, size * 1.3);
        g.clip();
        g.fillStyle = row.color;
        g.font = `500 ${size}px ${SANS}`;
        g.letterSpacing = '-0.02em';
        const unit = g.measureText(`${row.word}   `).width;
        const shift = (t * row.speed * w) % unit;
        const from = row.speed > 0 ? -1 : 0;
        for (let i = from; i < 5; i++) g.fillText(row.word, pad + shift + i * unit, h * row.y);
        g.letterSpacing = '0em';
        g.restore();
      }

      rule(g, pad, h * 0.84, w - pad * 2, (t - 0.8) / 1);
      micro(g, '01 — LOOP', pad, h * 0.9, h * 0.024, FAINT, span(t, 1.2, 1.8), '0.24em');
      veil(g, w, h, t);
    },
  },

  {
    id: 'halftone',
    title: '网版',
    tag: '信息图解',
    ratio: 4 / 5,
    prompt: brief(
      '复刻这个动效：近黑底上一个点阵按行显影，点的半径从一处中心向外衰减，像一张被放大的一比特图片',
      '要求：四周留白、等宽小标签、一条 1px 线；动效只有点的生长，不要旋转和缩放整块。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.075;
      const radius = Math.min(w * 0.3, h * 0.26);
      const side = radius * 2.08;
      const cols = 26;
      const rows = 26;
      const cell = side / cols;
      const x0 = w * 0.5 - side / 2;
      const y0 = h * 0.45 - side / 2;
      const maxR = cell * 0.52;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = x0 + (c + 0.5) * cell;
          const cy = y0 + (r + 0.5) * cell;
          const fall = 1 - Math.hypot(cx - w * 0.5, cy - h * 0.44) / radius;
          if (fall <= 0.02) continue;
          const p = outCubic((t - 0.3 - (c / cols) * 0.9 - (r / rows) * 0.45) / 0.4);
          const dot = maxR * fall ** 1.35 * p;
          if (dot < 0.2) continue;
          g.globalAlpha = 0.3 + fall * 0.7;
          g.fillStyle = fall > 0.32 ? INK : DIM;
          g.beginPath();
          g.arc(cx, cy, dot, 0, TAU);
          g.fill();
        }
      }
      g.globalAlpha = 1;

      micro(g, 'HALFTONE 01', pad, h * 0.1, h * 0.026, DIM, span(t, 0.2, 0.7), '0.3em');
      rule(g, pad, h * 0.86, w - pad * 2, (t - 1.2) / 0.9);
      micro(g, '1-BIT', pad, h * 0.92, h * 0.024, FAINT, span(t, 1.5, 2), '0.22em');
      veil(g, w, h, t);
    },
  },

  {
    id: 'chart',
    title: '折线',
    tag: '信息图解',
    ratio: 4 / 3,
    prompt: brief(
      '复刻这个动效：一块带横向网格的图区，一条折线从左向右画出来，线头一个发光的点，左下角有等宽刻度',
      '要求：近黑底、网格极淡、折线是青绿色、面积只留一层很浅的渐变；不要图例，也不要标题堆叠。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.11;
      const x0 = pad;
      const x1 = w - pad;
      const top = h * 0.28;
      const bottom = h * 0.76;
      const vals = [0.24, 0.4, 0.3, 0.52, 0.44, 0.66, 0.58, 0.74, 0.68, 0.86, 0.8, 0.95];
      const yOf = (v) => bottom - v * (bottom - top);
      const p = span(t, 0.3, 2.2);

      for (let i = 0; i <= 4; i++) {
        const y = top + ((bottom - top) * i) / 4;
        g.save();
        g.globalAlpha = 0.5;
        g.strokeStyle = HAIRLINE;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        g.stroke();
        g.restore();
      }
      micro(g, '100', x0 - w * 0.075, top + h * 0.01, h * 0.026, FAINT, span(t, 0.2, 0.7), '0.1em');
      micro(g, '0', x0 - w * 0.045, bottom + h * 0.01, h * 0.026, FAINT, span(t, 0.2, 0.7), '0.1em');
      micro(g, 'SIGNAL / 12 WEEKS', x0, h * 0.16, h * 0.03, DIM, span(t, 0.15, 0.65), '0.28em');

      // Area, then the line, then the head: same order every frame.
      const upto = Math.max(1, Math.ceil((vals.length - 1) * p));
      const grad = g.createLinearGradient(0, top, 0, bottom);
      grad.addColorStop(0, 'rgba(63, 224, 191, 0.22)');
      grad.addColorStop(1, 'rgba(63, 224, 191, 0)');
      g.save();
      g.beginPath();
      g.moveTo(x0, yOf(vals[0]));
      for (let i = 1; i <= upto; i++) g.lineTo(x0 + ((x1 - x0) * i) / (vals.length - 1), yOf(vals[i]));
      g.lineTo(x0 + ((x1 - x0) * upto) / (vals.length - 1), bottom);
      g.lineTo(x0, bottom);
      g.closePath();
      g.fillStyle = grad;
      g.fill();
      g.restore();

      g.save();
      g.strokeStyle = '#3fe0bf';
      g.lineWidth = Math.max(1, h * 0.006);
      g.lineJoin = 'round';
      g.setLineDash([(x1 - x0) * p, x1 - x0]);
      g.beginPath();
      for (let i = 0; i < vals.length; i++) {
        const x = x0 + ((x1 - x0) * i) / (vals.length - 1);
        if (i === 0) g.moveTo(x, yOf(vals[0]));
        else g.lineTo(x, yOf(vals[i]));
      }
      g.stroke();
      g.setLineDash([]);
      g.restore();

      const head = Math.min(p, 1) * (vals.length - 1);
      const i0 = Math.min(vals.length - 2, Math.floor(head));
      const headY = yOf(vals[i0] + (vals[i0 + 1] - vals[i0]) * (head - i0));
      g.save();
      g.globalAlpha = p > 0.03 ? 1 : 0;
      g.fillStyle = '#3fe0bf';
      g.shadowColor = '#3fe0bf';
      g.shadowBlur = h * 0.05;
      g.beginPath();
      g.arc(x0 + (x1 - x0) * p, headY, h * 0.012, 0, TAU);
      g.fill();
      g.restore();

      rule(g, pad, h * 0.86, w - pad * 2, (t - 1.4) / 0.8);
      veil(g, w, h, t);
    },
  },

  {
    id: 'window',
    title: '窗口',
    tag: '界面演示',
    ratio: 4 / 3,
    prompt: brief(
      '复刻这个动效：一块应用窗口从下往上浮入，标题栏三点、路径写等宽字，三行列表从左依次展开，一个光标点移进去点一下',
      '要求：面板比底色略亮、1px 描边、圆角小；动效克制，不要弹簧和乱飞的阴影。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      const up = outCubic((t - 0.2) / 0.9);
      const x = w * 0.12;
      const y = h * 0.24 + (1 - up) * h * 0.12;
      const ww = w * 0.76;
      const wh = h * 0.5;

      g.save();
      g.globalAlpha = up;
      g.fillStyle = '#141416';
      g.beginPath();
      g.roundRect(x, y, ww, wh, Math.min(10, w * 0.02));
      g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      g.lineWidth = 1;
      g.stroke();

      const barY = y + wh * 0.16;
      for (let i = 0; i < 3; i++) {
        g.fillStyle = 'rgba(255, 255, 255, 0.22)';
        g.beginPath();
        g.arc(x + w * 0.03 + i * w * 0.022, y + wh * 0.055, Math.max(1.2, w * 0.004), 0, TAU);
        g.fill();
      }
      g.strokeStyle = HAIRLINE;
      g.beginPath();
      g.moveTo(x, barY);
      g.lineTo(x + ww, barY);
      g.stroke();
      micro(g, 'motion/scene.ts', x + w * 0.04, y + wh * 0.115, h * 0.024, FAINT, 1, '0.08em');

      const rows = [
        { w: 0.46, accent: false },
        { w: 0.62, accent: true },
        { w: 0.34, accent: false },
      ];
      rows.forEach((row, i) => {
        const rp = outCubic((t - 0.55 - i * 0.16) / 0.5);
        if (rp <= 0) return;
        const ry = barY + wh * (0.22 + i * 0.2);
        g.save();
        g.globalAlpha = rp;
        g.fillStyle = row.accent ? ACCENT : 'rgba(255, 255, 255, 0.14)';
        g.beginPath();
        g.roundRect(x + w * 0.05, ry, ww * row.w * (0.4 + 0.6 * rp), Math.max(3, h * 0.018), 2);
        g.fill();
        g.restore();
      });

      // One cursor: it arrives, presses, and the ring shows the press.
      const cursor = outCubic((t - 1.5) / 0.8);
      const cx = x + ww * 0.66 * cursor + w * 0.02;
      const cy = barY + wh * 0.42 - h * 0.03 * cursor;
      g.save();
      g.globalAlpha = cursor > 0.02 ? 1 : 0;
      g.fillStyle = INK;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + w * 0.012, cy + h * 0.028);
      g.lineTo(cx + w * 0.004, cy + h * 0.026);
      g.closePath();
      g.fill();
      const press = t > 2.3 && t < 2.6 ? 1 : 0;
      g.strokeStyle = ACCENT;
      g.globalAlpha = press * 0.8;
      g.beginPath();
      g.arc(cx, cy, h * 0.012 + press * h * 0.01, 0, TAU);
      g.stroke();
      g.restore();
      g.restore();

      veil(g, w, h, t);
    },
  },

  {
    id: 'aurora',
    title: '极光',
    tag: '背景特效',
    ratio: 3 / 4,
    prompt: brief(
      '复刻这个动效：三团很柔和的光在深底上缓慢漂移、互相叠加，像极光或底噪，颗粒很细',
      '要求：颜色控制在蓝、青、紫三个里，亮度低、绝不刺眼；只做背景，最多一个等宽小标签。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      const blobs = [
        { x: 0.32, y: 0.36, r: 0.62, c: '74, 108, 255', speed: 0.12, phase: 0 },
        { x: 0.68, y: 0.52, r: 0.55, c: '53, 224, 191', speed: 0.09, phase: 2 },
        { x: 0.46, y: 0.72, r: 0.6, c: '138, 107, 255', speed: 0.07, phase: 4 },
      ];
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        const dx = Math.sin(t * b.speed * 2 + b.phase) * w * 0.1;
        const dy = Math.cos(t * b.speed * 1.6 + b.phase) * h * 0.06;
        const r = b.r * Math.min(w, h) * 0.7;
        const grad = g.createRadialGradient(w * b.x + dx, h * b.y + dy, 0, w * b.x + dx, h * b.y + dy, r);
        grad.addColorStop(0, `rgba(${b.c}, 0.34)`);
        grad.addColorStop(1, `rgba(${b.c}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }
      g.restore();

      // Grain, so the gradient never bands on a cheap panel.
      for (let i = 0; i < 260; i++) {
        g.globalAlpha = 0.03 + noise(i) * 0.03;
        g.fillStyle = noise(i + 9) > 0.5 ? '#ffffff' : '#000000';
        g.fillRect(noise(i + 3) * w, noise(i + 17) * h, 1, 1);
      }
      g.globalAlpha = 1;

      micro(g, 'AURORA', w * 0.08, h * 0.1, h * 0.024, 'rgba(255,255,255,0.5)', span(t, 0.2, 0.8), '0.3em');
      veil(g, w, h, t);
    },
  },

  {
    id: 'tree',
    title: '树',
    tag: '场景叙事',
    ratio: 3 / 4,
    prompt: brief(
      '复刻这个动效：黑底上一棵树从一个点长出来——枝干逐段生长，末梢的金色叶点逐步点亮，右上角一轮暗月',
      '要求：只用金色、墨黑和一点月光；生长的节奏要有先后（主干先、细枝后），不要一帧全亮。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);

      // Moon first, behind everything: it is the light, not a subject.
      const mx = w * 0.78;
      const my = h * 0.15;
      const mr = Math.min(w, h) * 0.065;
      const halo = g.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 5);
      halo.addColorStop(0, 'rgba(232, 232, 230, 0.14)');
      halo.addColorStop(1, 'rgba(232, 232, 230, 0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(232, 232, 230, 0.82)';
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.fill();

      // Warm light behind the canopy, so the crown reads before the twigs do.
      const glow = g.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.38, w * 0.42);
      glow.addColorStop(0, 'rgba(227, 189, 99, 0.07)');
      glow.addColorStop(1, 'rgba(227, 189, 99, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);

      const grow = span(t, 0.3, 2.6);
      const root = { x: w * 0.5, y: h * 0.9 };
      const tips = [];
      const STEP = 0.15;
      const branch = (x, y, angle, len, depth, at) => {
        if (depth <= 0 || len < 1) return;
        const p = clamp01((grow - at) / STEP);
        if (p <= 0) return;
        const ex = x + Math.cos(angle) * len * p;
        const ey = y + Math.sin(angle) * len * p;
        g.strokeStyle = GOLD;
        g.globalAlpha = depth > 3 ? 0.8 : 0.55;
        g.lineWidth = Math.max(0.6, depth * 0.3);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(ex, ey);
        g.stroke();
        if (p < 0.99) return;
        if (depth === 1) {
          tips.push([ex, ey]);
          return;
        }
        branch(ex, ey, angle - 0.36 - noise(depth + x) * 0.16, len * 0.74, depth - 1, at + STEP);
        branch(ex, ey, angle + 0.34 + noise(depth + y) * 0.16, len * 0.72, depth - 1, at + STEP);
        // A third twig higher up fills the crown without thickening the trunk.
        if (depth >= 4) {
          branch(ex, ey, angle + noise(depth * 3 + x) * 0.7 - 0.35, len * 0.56, depth - 1, at + STEP);
        }
      };
      branch(root.x, root.y, -Math.PI / 2, h * 0.24, 6, 0);

      // Foliage: each twig gets two leaves, lit one after another.
      const leaf = span(t, 1.9, 3.6);
      for (let i = 0; i < tips.length; i++) {
        const p = clamp01((leaf - i * 0.006) * 2.6);
        if (p <= 0) continue;
        const [tx, ty] = tips[i];
        const r = Math.max(0.8, w * 0.006 * (0.6 + 0.4 * p));
        g.fillStyle = GOLD;
        g.globalAlpha = 0.35 + 0.55 * p;
        g.beginPath();
        g.arc(tx, ty, r, 0, TAU);
        g.fill();
        g.globalAlpha = (0.35 + 0.55 * p) * 0.6;
        g.beginPath();
        g.arc(tx + r * 1.6, ty - r * 0.9, r * 0.7, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;

      micro(g, 'OCTOBER', w * 0.08, h * 0.1, h * 0.024, 'rgba(255,255,255,0.45)', span(t, 0.4, 1), '0.3em');
      veil(g, w, h, t);
    },
  },

  {
    id: 'orbit',
    title: '轨道',
    tag: '场景叙事',
    ratio: 16 / 9,
    prompt: brief(
      '复刻这个动效：深底星场上一条很淡的椭圆轨道，一个金点沿轨道走，身后留一点余辉，左侧一行等宽注记',
      '要求：星点很细、轨道只做一条、余辉要短；整段只有这个点在动，其他都静止。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h);
      for (let i = 0; i < 70; i++) {
        g.globalAlpha = 0.15 + noise(i + 31) * 0.5;
        g.fillStyle = '#cdd7ea';
        g.beginPath();
        g.arc(noise(i) * w, noise(i + 90) * h, 0.4 + noise(i + 61) * 0.9, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;

      const cx = w * 0.62;
      const cy = h * 0.52;
      const rx = w * 0.3;
      const ry = h * 0.26;
      const p = span(t, 0.2, 1.6);

      g.save();
      g.strokeStyle = 'rgba(255, 255, 255, 0.13)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, -0.18, -Math.PI * 0.9, -Math.PI * 0.9 + TAU * 0.92 * p);
      g.stroke();
      g.restore();

      // The travelling point, with a short tail rather than a comet.
      const turn = (t * 0.62) % TAU;
      for (let i = 0; i < 12; i++) {
        const a = turn - i * 0.035;
        const x = cx + Math.cos(a) * rx;
        const y = cy + Math.sin(a) * ry;
        g.globalAlpha = (1 - i / 12) * 0.5;
        g.fillStyle = GOLD;
        g.beginPath();
        g.arc(x, y, Math.max(0.6, h * 0.006 * (1 - i / 14)), 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = GOLD;
      g.beginPath();
      g.arc(cx + Math.cos(turn) * rx, cy + Math.sin(turn) * ry, Math.max(1.6, h * 0.012), 0, TAU);
      g.fill();

      micro(g, 'ORBIT 01', w * 0.075, h * 0.17, h * 0.042, DIM, span(t, 0.2, 0.8), '0.3em');
      g.save();
      g.globalAlpha = span(t, 0.8, 1.4);
      g.fillStyle = INK;
      g.font = `400 ${h * 0.075}px ${MONO}`;
      g.letterSpacing = '-0.01em';
      g.fillText('1.42 AU', w * 0.075, h * 0.29);
      g.letterSpacing = '0em';
      g.restore();
      rule(g, w * 0.075, h * 0.86, w * 0.85, (t - 1.2) / 0.9);
      veil(g, w, h, t);
    },
  },
];
