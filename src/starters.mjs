// The empty workspace's gallery: one art direction, four studies.
//
// The look is taken from the WebMotion site's hero film (webmotion.superhq.ai):
// near-black ground, monospace uppercase micro-labels with wide tracking, a lot
// of air, one hairline, and a single blue accent — the page states its argument
// quietly and lets the motion carry it. A card here is a real animation, a pure
// function of time on canvas 2D, looping on its own: the panel's first claim is
// "moving image", so a still card would be a lie about the product.

export const LOOP_SECONDS = 6;

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
const outCubic = (v) => 1 - (1 - clamp01(v)) ** 3;
/** Progress of a window inside the loop: 0 before `from`, 1 after `to`. */
const span = (t, from, to) => ease((t - from) / (to - from));
/** Deterministic pseudo-random, so a frame always looks the same. */
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

/** Ground: near-black with the faintest vertical lift, never a flat fill. */
function ground(g, w, h) {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#111113');
  sky.addColorStop(1, '#09090a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
}

/** Fade in and out by veiling the scene with its own ground, not by alpha. */
function veil(g, w, h, t) {
  const fade = 1 - Math.min(1, t / 0.5) * Math.min(1, (LOOP_SECONDS - t) / 0.55);
  if (fade <= 0) return;
  g.save();
  g.globalAlpha = fade;
  ground(g, w, h);
  g.restore();
}

/** Monospace, uppercase, wide tracking — the site's micro-label voice. */
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

/** The one rule, drawn left to right. */
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

export const SPECIMENS = [
  {
    id: 'baseline',
    name: '基线',
    blurb: '柱列从基线长出来',
    prompt:
      '做一段 20 秒的片子，用「基线」这套：近黑底、等宽大写微标签、一条 1px 分隔线、一根根细柱从基线按顺序长出来（每条晚一点、十几帧长成），全程只用一个蓝色强调，不放别的装饰。',
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.075;
      const base = h * 0.79;
      const inner = w - pad * 2;

      // A row of beats: each bar is one frame of the same idea.
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

      // Baseline, then the label that names what the row counts.
      g.save();
      g.globalAlpha = span(t, 0.15, 0.6);
      g.fillStyle = 'rgba(255, 255, 255, 0.18)';
      g.fillRect(pad, base, inner * span(t, 0.15, 1), 1);
      g.restore();

      micro(g, 'THROUGHPUT', pad, h * 0.17, h * 0.04, DIM, span(t, 0.2, 0.7), '0.3em');
      rule(g, pad, h * 0.855, inner, (t - 0.9) / 0.9);

      const frames = String(268).padStart(3, '0');
      g.save();
      g.globalAlpha = span(t, 1.3, 1.9);
      g.font = `400 ${h * 0.036}px ${MONO}`;
      g.letterSpacing = '0.22em';
      g.fillStyle = FAINT;
      const stamp = 'FRAME ';
      g.fillText(stamp, pad, h * 0.925);
      const stampW = g.measureText(stamp).width;
      g.fillStyle = ACCENT;
      g.fillText(frames, pad + stampW, h * 0.925);
      g.letterSpacing = '0em';
      g.restore();
      veil(g, w, h, t);
    },
  },

  {
    id: 'plate',
    name: '展签',
    blurb: '墙签式排版：小标签、大标题、一行注记',
    prompt:
      '做一段 20 秒的片子，用「展签」这套：像美术馆墙签一样排版——等宽大写小标签、一行大标题、一行等宽注记，近黑底、大量留白、一条 1px 线；动效只有十几像素的上升与淡入，按帧错开。',
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.075;

      // One accent tick, then the label rises into place.
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

      micro(
        g,
        'cast · a note on distance',
        x,
        h * 0.53 + rise(span(t, 0.6, 1.2)),
        h * 0.036,
        FAINT,
        span(t, 0.6, 1.2),
        '0.16em',
      );

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
    id: 'halftone',
    name: '网版',
    blurb: '点阵逐行显影，一位深',
    prompt:
      '做一段 20 秒的片子，用「网版」这套：近黑底上一个点阵按行显影，点的半径由一处焦点向外衰减，像一张被放大的一比特图片；四周留白、等宽小标签、一条 1px 线，动效只有点的生长。',
    draw(g, w, h, t) {
      ground(g, w, h);
      const pad = w * 0.075;

      // A dithered mass: the radius falls off from one centre, so the grid
      // reads as a screened image rather than as a texture of dots.
      const radius = Math.min(w * 0.26, h * 0.36);
      const side = radius * 2.08;
      const cols = 28;
      const rows = 28;
      const cell = side / cols;
      const x0 = w * 0.5 - side / 2;
      const y0 = h * 0.47 - side / 2;
      const maxR = cell * 0.52;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = x0 + (c + 0.5) * cell;
          const cy = y0 + (r + 0.5) * cell;
          const fall = 1 - Math.hypot(cx - w * 0.5, cy - h * 0.46) / radius;
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

      micro(g, 'HALFTONE 01', pad, h * 0.17, h * 0.04, DIM, span(t, 0.2, 0.7), '0.3em');
      rule(g, pad, h * 0.855, w - pad * 2, (t - 1.2) / 0.9);
      micro(g, '1-BIT', pad, h * 0.925, h * 0.036, FAINT, span(t, 1.5, 2), '0.22em');
      veil(g, w, h, t);
    },
  },

  {
    id: 'count',
    name: '计时',
    blurb: '数字滚动，一条线走到头',
    prompt:
      '做一段 20 秒的片子，用「计时」这套：近黑底、一个等宽大数字从 000 滚到 268、下面一行小注记、一条 1px 进度线带着蓝色针脚走完；不要别的元素，节奏慢，结尾停住。',
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

      // The accent is one dot, at the end of the number.
      g.save();
      g.globalAlpha = span(t, 0.5, 1);
      g.fillStyle = ACCENT;
      const dot = Math.max(2, h * 0.014);
      g.fillRect(pad + numberW + h * 0.02, h * 0.56 - dot, dot, dot);
      g.restore();

      micro(g, 'FRAMES AT 30 FPS', pad, h * 0.65, h * 0.036, FAINT, span(t, 0.9, 1.5), '0.2em');

      // The rule, then the progress line that walks along it.
      const lineY = h * 0.79;
      const width = w - pad * 2;
      rule(g, pad, lineY, width, (t - 0.3) / 1);

      const walk = span(t, 0.4, 2.4);
      g.save();
      g.strokeStyle = ACCENT;
      g.lineWidth = Math.max(1, h * 0.0035);
      g.beginPath();
      g.moveTo(pad, lineY);
      g.lineTo(pad + width * walk, lineY);
      g.stroke();
      g.restore();

      micro(g, 'TAKE 04', pad, h * 0.925, h * 0.036, FAINT, span(t, 1.7, 2.2), '0.22em');
      veil(g, w, h, t);
    },
  },
];
