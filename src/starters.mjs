// The empty workspace's gallery. A card here is not a picture of a style — it is
// a small, real animation: a pure function of time, drawn with canvas 2D, looping
// on its own. The panel's whole claim is "moving image", so the first thing it
// ever shows has to move.
//
// Names and palettes follow the style cards this engine took notes from
// (navy / paper / ink / signal): a pick is a direction someone can describe, not
// a mood word invented for the occasion.

export const LOOP_SECONDS = 6;

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
/** Progress of a window inside the loop: 0 before `from`, 1 after `to`. */
const span = (t, from, to) => ease((t - from) / (to - from));
/** Deterministic pseudo-random, so a frame always looks the same. */
const noise = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const SERIF = '"Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif';
const SANS =
  '-apple-system, "system-ui", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

/** Content fades in at the head of the loop and out at the tail, so it breathes. */
const envelope = (t) => Math.min(1, t / 0.5) * Math.min(1, (LOOP_SECONDS - t) / 0.55);

/** Fade in and out by veiling the scene with its own ground colour. */
function veil(g, w, h, t, colour) {
  const fade = 1 - envelope(t);
  if (fade <= 0) return;
  g.save();
  g.globalAlpha = fade;
  g.fillStyle = colour;
  g.fillRect(0, 0, w, h);
  g.restore();
}

/**
 * Text that rises through its own baseline mask. Cheap, and the one move that
 * makes a still frame read as a shot instead of a slide.
 */
function riseText(g, text, x, y, w, size, font, color, p) {
  if (p <= 0) return;
  const lift = (1 - p) * size * 0.55;
  g.save();
  g.beginPath();
  g.rect(x - size, y - size * 1.05, w, size * 1.25);
  g.clip();
  g.fillStyle = color;
  g.font = font;
  g.textBaseline = 'alphabetic';
  g.fillText(text, x, y + lift);
  g.restore();
}

export const SPECIMENS = [
  {
    id: 'navy',
    name: '深空档案',
    blurb: '深底、暖金、纪录片式标注',
    palette: { bg: '#070b14', ink: '#f4f1ea', accent: '#d8a94a', dim: '#8b98ad' },
    prompt:
      '做一段 20 秒的片子，用「深空档案」的路子：近黑深底、暖金色细线与标注、标题用衬线、信息像档案条目一样克制，动效只做位移和遮罩揭示，不加装饰。',
    draw(g, w, h, t) {
      const { ink, accent, dim } = this.palette;
      const sky = g.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#060a12');
      sky.addColorStop(1, '#0c1526');
      g.fillStyle = sky;
      g.fillRect(0, 0, w, h);

      g.save();

      // A slow field of stars: the only thing that never stops moving.
      for (let i = 0; i < 52; i++) {
        const sx = noise(i) * w;
        const sy = (noise(i + 90) * h + t * (1.4 + noise(i + 7) * 2.6)) % h;
        g.globalAlpha = (0.14 + noise(i + 31) * 0.5);
        g.fillStyle = '#cdd7ea';
        g.beginPath();
        g.arc(sx, sy, 0.4 + noise(i + 61) * 0.85, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;

      const pad = w * 0.09;
      g.fillStyle = accent;
      g.font = `500 ${h * 0.052}px ${MONO}`;
      g.letterSpacing = '0.14em';
      g.globalAlpha = span(t, 0.15, 0.7);
      g.fillText('ARCHIVE 1987', pad, h * 0.3);
      g.letterSpacing = '0em';

      const rule = span(t, 0.45, 1.5);
      g.globalAlpha = 0.9;
      g.strokeStyle = accent;
      g.lineWidth = Math.max(0.6, h * 0.0035);
      g.beginPath();
      g.moveTo(pad, h * 0.365);
      g.lineTo(pad + (w - pad * 2) * 0.62 * rule, h * 0.365);
      g.stroke();

      riseText(g, 'The long orbit', pad, h * 0.55, w, h * 0.155, `500 ${h * 0.155}px ${SERIF}`, ink, span(t, 0.6, 1.5));

      g.globalAlpha = span(t, 1.2, 1.9);
      g.fillStyle = dim;
      g.font = `400 ${h * 0.056}px ${SANS}`;
      g.fillText('一段关于距离的说明', pad, h * 0.665);

      // A small live mark at the end of the rule: something is still running.
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
      const dotX = pad + (w - pad * 2) * 0.62 * span(t, 1.4, 2.6);
      g.globalAlpha = (0.35 + pulse * 0.5);
      g.fillStyle = accent;
      g.beginPath();
      g.arc(dotX, h * 0.365, h * 0.012, 0, TAU);
      g.fill();
      g.restore();
      veil(g, w, h, t, '#081020');
    },
  },

  {
    id: 'paper',
    name: '纸本手作',
    blurb: '米色纸、铁锈红、停格剪贴',
    palette: { bg: '#efe7d8', ink: '#1d1a16', accent: '#b8543a', dim: '#6f675c' },
    prompt:
      '做一段 20 秒的片子，用「纸本手作」的路子：米色纸面、铁锈红强调、粗衬线标题，形状像剪贴的纸片，动作用低速停格（每秒 10 帧左右）做出手工感，不做顺滑缓动。',
    draw(g, w, h, t) {
      const { ink, accent, dim } = this.palette;
      g.fillStyle = this.palette.bg;
      g.fillRect(0, 0, w, h);
      // Fibre: fine speckle, the cheap way to make a flat colour feel like paper.
      for (let i = 0; i < 120; i++) {
        g.globalAlpha = 0.05 + noise(i) * 0.05;
        g.fillStyle = i % 3 ? '#8d8172' : '#ffffff';
        g.fillRect(noise(i + 11) * w, noise(i + 23) * h, 1.2, 1.2);
      }
      g.globalAlpha = 1;

      // Stop motion: the composition only moves ten times a second.
      const q = Math.floor(t * 10) / 10;
      g.save();
      g.globalAlpha = 1;
      g.translate(w / 2, h / 2);
      g.rotate(-0.022);

      // The rust scrap sits behind the sheet and only peeks out — one accent,
      // not a composition built out of many little pieces.
      const b = span(q, 0.3, 0.9);
      g.save();
      g.translate(w * 0.11 + (1 - b) * w * 0.16, h * 0.05 + (1 - b) * h * 0.14);
      g.rotate(0.07);
      g.fillStyle = accent;
      g.shadowColor = 'rgba(60, 45, 30, 0.22)';
      g.shadowBlur = h * 0.03;
      g.shadowOffsetY = h * 0.01;
      g.fillRect(0, 0, w * 0.19, h * 0.28);
      g.restore();

      const a = span(q, 0.15, 0.75);
      g.save();
      g.translate(-w * 0.31 + (1 - a) * -w * 0.16, -h * 0.27 + (1 - a) * h * 0.12);
      g.rotate(-0.035);
      g.fillStyle = '#f8f3e7';
      g.shadowColor = 'rgba(60, 45, 30, 0.2)';
      g.shadowBlur = h * 0.035;
      g.shadowOffsetY = h * 0.012;
      g.fillRect(0, 0, w * 0.46, h * 0.52);
      g.shadowColor = 'transparent';
      g.shadowBlur = 0;
      g.shadowOffsetY = 0;

      // Everything on the sheet is revealed by a mask that grows downward.
      const titleP = span(q, 0.7, 1.4);
      g.save();
      g.beginPath();
      g.rect(0, 0, w * 0.46, h * 0.52 * titleP);
      g.clip();
      g.fillStyle = ink;
      g.font = `500 ${h * 0.115}px ${SERIF}`;
      g.fillText('Paper,', w * 0.07, h * 0.18);
      g.fillText('cut slow', w * 0.07, h * 0.31);
      g.restore();

      const stitch = span(q, 1.1, 2.2);
      g.strokeStyle = dim;
      g.lineWidth = Math.max(0.7, h * 0.004);
      g.setLineDash([h * 0.016, h * 0.018]);
      g.beginPath();
      g.moveTo(w * 0.07, h * 0.37);
      g.lineTo(w * 0.07 + w * 0.32 * stitch, h * 0.37);
      g.stroke();
      g.setLineDash([]);

      g.fillStyle = dim;
      g.globalAlpha = span(q, 1.4, 2);
      g.font = `500 ${h * 0.042}px ${MONO}`;
      g.letterSpacing = '0.1em';
      g.fillText('A SHORT STUDY', w * 0.07, h * 0.45);
      g.letterSpacing = '0em';
      g.restore();
      veil(g, w, h, t, this.palette.bg);
    },
  },

  {
    id: 'signal',
    name: '冷光数据',
    blurb: '近黑底、青绿细线、会动的数',
    palette: { bg: '#05070b', ink: '#e8f7f3', accent: '#3fe0bf', dim: '#5f7a7f' },
    prompt:
      '做一段 20 秒的片子，用「冷光数据」的路子：近黑底、青绿细线与网格点、一个会滚动的数字和一个画出来的折线，动效只有生长和数字变化，不要插画和光晕堆叠。',
    draw(g, w, h, t) {
      const { ink, accent, dim } = this.palette;
      g.fillStyle = this.palette.bg;
      g.fillRect(0, 0, w, h);

      const pad = w * 0.09;
      for (let x = pad; x < w - pad; x += w * 0.055) {
        for (let y = h * 0.16; y < h * 0.9; y += h * 0.09) {
          g.globalAlpha = 0.12;
          g.fillStyle = accent;
          g.fillRect(x, y, 1, 1);
        }
      }
      g.globalAlpha = 1;

      g.save();
      g.globalAlpha = 1;

      g.fillStyle = accent;
      g.font = `500 ${h * 0.05}px ${MONO}`;
      g.letterSpacing = '0.12em';
      g.fillText('THROUGHPUT', pad, h * 0.28);
      g.letterSpacing = '0em';

      const p = span(t, 0.25, 2.4);
      const value = 0.82 + 0.6 * p;
      g.fillStyle = ink;
      g.font = `400 ${h * 0.2}px ${MONO}`;
      g.letterSpacing = '-0.02em';
      g.fillText(`${value.toFixed(2)}M`, pad, h * 0.55);
      g.letterSpacing = '0em';

      g.globalAlpha = span(t, 1.1, 1.8);
      g.fillStyle = dim;
      g.font = `400 ${h * 0.052}px ${SANS}`;
      g.fillText('每天处理的条目', pad, h * 0.625);

      // The line is the story: it draws, and a lit head runs along it.
      const pts = [0.3, 0.62, 0.52, 0.72, 0.6, 0.84, 0.76, 0.95];
      const x0 = pad;
      const x1 = w - pad;
      const top = h * 0.9;
      const band = h * 0.19;
      const yOf = (v) => top - v * band;
      g.strokeStyle = accent;
      g.lineWidth = Math.max(1, h * 0.006);
      g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const x = x0 + ((x1 - x0) * i) / (pts.length - 1);
        if (i === 0) g.moveTo(x, yOf(pts[0]));
        else g.lineTo(x, yOf(pts[i]));
      }
      g.setLineDash([(x1 - x0) * p, x1 - x0]);
      g.stroke();
      g.setLineDash([]);

      const headAt = Math.min(1, p);
      const seg = headAt * (pts.length - 1);
      const i0 = Math.min(pts.length - 2, Math.floor(seg));
      const mid = seg - i0;
      g.globalAlpha = (headAt > 0.02 ? 0.95 : 0);
      g.fillStyle = accent;
      g.shadowColor = accent;
      g.shadowBlur = h * 0.05;
      g.beginPath();
      g.arc(x0 + (x1 - x0) * headAt, yOf(pts[i0] + (pts[i0 + 1] - pts[i0]) * mid), h * 0.012, 0, TAU);
      g.fill();
      g.shadowBlur = 0;
      g.restore();
      veil(g, w, h, t, this.palette.bg);
    },
  },

  {
    id: 'ink',
    name: '黑白排版',
    blurb: '近白纸、超大字号、只靠留白',
    palette: { bg: '#faf8f3', ink: '#0f1115', accent: '#0f1115', dim: '#8a8f96' },
    prompt:
      '做一段 20 秒的片子，用「黑白排版」的路子：近白纸面、黑色超大号无衬线字、只靠字号/字重/留白制造层次，动效是遮罩上移和一条线的划过，不要颜色和装饰。',
    draw(g, w, h, t) {
      const { ink, dim } = this.palette;
      g.fillStyle = this.palette.bg;
      g.fillRect(0, 0, w, h);
      g.save();
      g.globalAlpha = 1;

      const pad = w * 0.085;
      g.fillStyle = dim;
      g.font = `500 ${h * 0.045}px ${MONO}`;
      g.letterSpacing = '0.1em';
      g.fillText('STUDY 02', pad, h * 0.2);
      g.letterSpacing = '0em';

      const size = h * 0.27;
      riseText(g, 'Form', pad, h * 0.55, w, size, `700 ${size}px ${SANS}`, ink, span(t, 0.3, 1.1));
      riseText(g, 'follows', pad, h * 0.55 + size * 1.02, w, size, `700 ${size}px ${SANS}`, ink, span(t, 0.55, 1.35));

      const rule = span(t, 1.2, 2.2);
      g.globalAlpha = 0.9;
      g.fillStyle = ink;
      g.fillRect(pad, h * 0.9, (w - pad * 2) * 0.34 * rule, Math.max(1, h * 0.008));
      g.restore();
      veil(g, w, h, t, this.palette.bg);
    },
  },
];
