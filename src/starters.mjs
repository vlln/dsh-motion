// The empty workspace is a gallery, not an error page: a wall of short loops
// someone can watch, copy the recipe of, or hand to the agent to build for real.
//
// Each tile is a whole art direction, not a colour swap: a warm product film with
// a laptop on a desk and glass cards floating over it, a hand-drawn field-guide
// spread on paper, a leaderboard tilted away in the dark. Every one is a genuine
// animation — a pure function of time on canvas 2D.

import { paper, inkStroke, halftone, bleed } from './medium.mjs';

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

const SERIF = '"Iowan Old Style", "Palatino Linotype", Georgia, "Times New Roman", serif';
const SANS =
  '-apple-system, "system-ui", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';

const LOOKS = {
  desk: { bg: '#e9dbc9', ink: '#1b1712', dim: 'rgba(27,23,18,0.5)' },
  paper: { bg: '#ece2cc', ink: '#1d1a16', dim: 'rgba(29,26,22,0.55)', accent: '#3d8b86' },
  night: { bg: '#08090b', ink: '#ececea', dim: 'rgba(236,236,234,0.45)', accent: '#7ee787' },
  lime: { bg: '#d9ff3d', ink: '#101010', dim: 'rgba(16,16,16,0.5)' },
  navy: { bg: '#0b1322', ink: '#efece2', dim: 'rgba(239,236,226,0.5)', accent: '#d8a94a' },
  dusk: { bg: '#140c26', ink: '#f6ecff', dim: 'rgba(246,236,255,0.5)', accent: '#ff86c2' },
  plate: { bg: '#eee3cb', ink: '#2a2118', dim: 'rgba(42,33,24,0.55)', accent: '#b04a2e', finish: false },
};

function ground(g, w, h, look) {
  g.fillStyle = look.bg;
  g.fillRect(0, 0, w, h);
}

function veil(g, w, h, t, look) {
  const fade = 1 - Math.min(1, t / 0.45) * Math.min(1, (LOOP_SECONDS - t) / 0.5);
  if (fade <= 0) return;
  g.save();
  g.globalAlpha = fade;
  g.fillStyle = look.bg;
  g.fillRect(0, 0, w, h);
  g.restore();
}

function label(g, text, x, y, size, color, p, track = '0.24em', font = MONO) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = p;
  g.fillStyle = color;
  g.font = `500 ${size}px ${font}`;
  g.letterSpacing = track;
  g.fillText(text, x, y);
  g.letterSpacing = '0em';
  g.restore();
}

function line(g, x, y, width, color, p) {
  if (p <= 0) return;
  g.save();
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + width * ease(p), y);
  g.stroke();
  g.restore();
}

const brief = (what, detail) =>
  `${what}。${detail} 写在工作区的 motion/ 里（timeline.json + scenes），跑 \`dsh-motion validate\`，` +
  '再把关键帧给我看。';

/** One floating card of a product film: icon, step, title, note, progress. */
function glassCard(g, x, y, w, h, card, p) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = Math.min(1, p * 1.6);
  g.shadowColor = 'rgba(60, 40, 20, 0.26)';
  g.shadowBlur = h * 0.18;
  g.shadowOffsetY = h * 0.06;
  g.fillStyle = 'rgba(255, 255, 255, 0.92)';
  g.beginPath();
  g.roundRect(x, y + (1 - p) * h * 0.25, w, h, Math.max(6, w * 0.035));
  g.fill();
  g.restore();

  const top = y + (1 - p) * h * 0.25;
  g.save();
  g.globalAlpha = Math.min(1, p * 1.6);
  g.fillStyle = card.tile;
  g.beginPath();
  g.roundRect(x + w * 0.06, top + h * 0.16, w * 0.17, w * 0.17, Math.max(3, w * 0.025));
  g.fill();
  // The tile glyph is three short bars — enough at this size.
  g.fillStyle = card.glyph;
  for (let i = 0; i < 3; i++) {
    g.fillRect(x + w * 0.09, top + h * 0.22 + i * w * 0.045, w * 0.11 * (i === 1 ? 0.7 : 1), Math.max(1, w * 0.012));
  }
  g.fillStyle = 'rgba(27,23,18,0.55)';
  g.font = `600 ${Math.max(6, w * 0.038)}px ${MONO}`;
  g.letterSpacing = '0.16em';
  g.fillText(card.step, x + w * 0.3, top + h * 0.26);
  g.letterSpacing = '0em';
  g.fillStyle = '#1b1712';
  g.font = `600 ${Math.max(8, w * 0.062)}px ${SANS}`;
  g.fillText(card.title, x + w * 0.3, top + h * 0.5);
  g.fillStyle = 'rgba(27,23,18,0.58)';
  g.font = `400 ${Math.max(6, w * 0.042)}px ${SANS}`;
  g.fillText(card.note, x + w * 0.3, top + h * 0.66);
  g.fillStyle = 'rgba(27,23,18,0.1)';
  g.fillRect(x + w * 0.06, top + h * 0.82, w * 0.88, Math.max(1, h * 0.012));
  g.fillStyle = card.tile;
  g.fillRect(x + w * 0.06, top + h * 0.82, w * 0.88 * Math.min(1, p * 0.8), Math.max(1, h * 0.012));
  g.restore();
}

/** One readable row of a leaderboard that lives in perspective. */
function boardRow(g, x, y, w, h, row, p, highlight) {
  if (p <= 0) return;
  g.save();
  g.globalAlpha = p;
  if (highlight) {
    g.fillStyle = 'rgba(126, 231, 135, 0.1)';
    g.beginPath();
    g.roundRect(x - w * 0.01, y, w, h, Math.max(3, h * 0.3));
    g.fill();
    g.fillStyle = 'rgba(126, 231, 135, 0.5)';
    g.fillRect(x - w * 0.01, y + h * 0.2, Math.max(1.5, w * 0.004), h * 0.6);
  }
  g.fillStyle = highlight ? 'rgba(126,231,135,0.9)' : 'rgba(236,236,234,0.42)';
  g.font = `500 ${Math.max(8, h * 0.42)}px ${MONO}`;
  g.fillText(row.rank, x + w * 0.02, y + h * 0.7);

  g.fillStyle = highlight ? '#7ee787' : '#ececea';
  g.font = `600 ${Math.max(9, h * 0.6)}px ${SANS}`;
  g.fillText(row.name, x + w * 0.1, y + h * 0.74);

  g.fillStyle = highlight ? '#7ee787' : 'rgba(236,236,234,0.86)';
  g.font = `500 ${Math.max(9, h * 0.56)}px ${MONO}`;
  g.textAlign = 'right';
  g.fillText(row.score, x + w * 0.93, y + h * 0.72);
  g.textAlign = 'left';
  g.restore();
}

export const SAMPLES = [
  {
    id: 'desk',
    title: '产品片',
    tag: '界面演示',
    ratio: 16 / 9,
    template: 'desk',
    featured: true,
    look: LOOKS.desk,
    prompt: brief(
      '复刻这个动效：暖色房间里一台笔记本电脑，屏幕里是浏览器里的产品界面，四张半透明步骤卡从下方依次浮到前景，顶部一条胶囊写着这次要做什么',
      '要求：背景有景深、卡片有柔和投影和轻微视差、卡片依次错开 0.15 秒；暖调配色，不要荧光。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#d8c2a4');
      bg.addColorStop(0.55, '#b19373');
      bg.addColorStop(1, '#7a5f45');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      // Out-of-focus room.
      g.save();
      g.filter = `blur(${Math.max(8, w * 0.022)}px)`;
      g.fillStyle = 'rgba(203,180,150,0.75)';
      g.beginPath();
      g.ellipse(w * 0.92, h * 0.18, w * 0.12, h * 0.2, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,251,243,0.34)';
      g.beginPath();
      g.ellipse(w * 0.1, h * 0.12, w * 0.15, h * 0.13, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(124,146,92,0.45)';
      g.beginPath();
      g.ellipse(w * 0.96, h * 0.62, w * 0.14, h * 0.16, 0, 0, TAU);
      g.fill();
      g.restore();

      const cam = 1 + t / LOOP_SECONDS * 0.06 + Math.sin(t * 0.3) * 0.004;
      g.save();
      g.translate(w / 2, h / 2);
      g.scale(cam, cam);
      g.translate(-w / 2, -h / 2);

      // Contact shadow under the machine.
      g.save();
      g.filter = `blur(${Math.max(5, w * 0.012)}px)`;
      g.fillStyle = 'rgba(90, 66, 44, 0.28)';
      g.beginPath();
      g.ellipse(w * 0.5, h * 0.8, w * 0.36, h * 0.045, 0, 0, TAU);
      g.fill();
      g.restore();

      const poly = (pts, fill) => {
        g.beginPath();
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
        g.closePath();
        g.fillStyle = fill;
        g.fill();
      };

      // The screen is a light source: a soft wash on the room behind it.
      g.save();
      g.globalCompositeOperation = 'lighter';
      const spill = g.createRadialGradient(w * 0.5, h * 0.42, h * 0.04, w * 0.5, h * 0.42, w * 0.55);
      spill.addColorStop(0, 'rgba(255, 244, 222, 0.22)');
      spill.addColorStop(0.45, 'rgba(255, 236, 206, 0.07)');
      spill.addColorStop(1, 'rgba(255, 236, 206, 0)');
      g.fillStyle = spill;
      g.fillRect(0, 0, w, h);
      g.restore();

      // Lid and its screen, both trapezoids. The lid is shaded top to bottom:
      // flat black plastic is what made the machine read as a wireframe.
      const lid = g.createLinearGradient(0, h * 0.19, 0, h * 0.67);
      lid.addColorStop(0, '#2c2c33');
      lid.addColorStop(0.5, '#1e1e24');
      lid.addColorStop(1, '#141418');
      poly([[w * 0.17, h * 0.19], [w * 0.83, h * 0.19], [w * 0.87, h * 0.67], [w * 0.13, h * 0.67]], lid);
      const screen = [[w * 0.185, h * 0.205], [w * 0.815, h * 0.205], [w * 0.853, h * 0.652], [w * 0.147, h * 0.652]];
      poly(screen, '#fbf8f2');

      // The page inside the screen.
      g.save();
      g.beginPath();
      g.moveTo(screen[0][0], screen[0][1]);
      for (let i = 1; i < 4; i++) g.lineTo(screen[i][0], screen[i][1]);
      g.closePath();
      g.clip();
      const sx = screen[0][0];
      const sy = screen[0][1];
      const sw = screen[1][0] - screen[0][0];
      const sh = screen[3][1] - screen[0][1];
      g.fillStyle = '#efeae1';
      g.fillRect(sx, sy, sw, sh * 0.13);
      for (let i = 0; i < 3; i++) {
        g.fillStyle = ['#e7a39c', '#d9d3c7', '#cfc8ba'][i];
        g.beginPath();
        g.arc(sx + sw * 0.04 + i * sw * 0.028, sy + sh * 0.065, Math.max(1.2, sw * 0.007), 0, TAU);
        g.fill();
      }
      g.fillStyle = '#ded7cb';
      g.beginPath();
      g.roundRect(sx + sw * 0.16, sy + sh * 0.035, sw * 0.7, sh * 0.06, sh * 0.03);
      g.fill();
      // Sidebar
      g.fillStyle = '#f7f3ea';
      g.fillRect(sx, sy + sh * 0.13, sw * 0.26, sh * 0.87);
      for (let i = 0; i < 4; i++) {
        g.fillStyle = i === 1 ? '#c4553f' : '#ded7cb';
        g.fillRect(sx + sw * 0.03, sy + sh * (0.24 + i * 0.1), sw * 0.18, Math.max(1, sh * 0.016));
      }
      // Headline and a picture
      g.fillStyle = '#2b2a27';
      g.fillRect(sx + sw * 0.32, sy + sh * 0.26, sw * 0.3, Math.max(2, sh * 0.035));
      g.fillRect(sx + sw * 0.32, sy + sh * 0.33, sw * 0.22, Math.max(1.5, sh * 0.025));
      g.fillStyle = '#d5cdbf';
      for (let i = 0; i < 3; i++) g.fillRect(sx + sw * 0.32, sy + sh * (0.44 + i * 0.06), sw * (0.34 - i * 0.05), Math.max(1, sh * 0.014));
      g.fillStyle = '#c4553f';
      g.fillRect(sx + sw * 0.68, sy + sh * 0.24, sw * 0.26, sh * 0.34);
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(sx + sw * 0.705, sy + sh * 0.28, sw * 0.09, sh * 0.09);
      // A row of cards under the copy, so the page is not half empty.
      for (let i = 0; i < 3; i++) {
        const cxp = sx + sw * (0.32 + i * 0.22);
        g.fillStyle = '#f2ece2';
        g.beginPath();
        g.roundRect(cxp, sy + sh * 0.62, sw * 0.18, sh * 0.26, Math.max(1.5, sw * 0.006));
        g.fill();
        g.fillStyle = i === 0 ? '#c4553f' : '#ddd5c7';
        g.beginPath();
        g.roundRect(cxp + sw * 0.015, sy + sh * 0.645, sw * 0.05, sw * 0.05, Math.max(1, sw * 0.004));
        g.fill();
        g.fillStyle = '#d8d0c2';
        g.fillRect(cxp + sw * 0.015, sy + sh * 0.72, sw * 0.13, Math.max(1, sh * 0.012));
        g.fillRect(cxp + sw * 0.015, sy + sh * 0.75, sw * 0.09, Math.max(1, sh * 0.012));
      }
      // Glass: a sheen across the panel and a soft inner shade at the edges.
      const sheen = g.createLinearGradient(sx, sy, sx + sw * 0.9, sy + sh);
      sheen.addColorStop(0, 'rgba(255,255,255,0.16)');
      sheen.addColorStop(0.28, 'rgba(255,255,255,0.03)');
      sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
      g.fillStyle = sheen;
      g.fillRect(sx, sy, sw, sh);
      const inner = g.createLinearGradient(sx, sy, sx, sy + sh);
      inner.addColorStop(0, 'rgba(0,0,0,0.10)');
      inner.addColorStop(0.18, 'rgba(0,0,0,0)');
      g.fillStyle = inner;
      g.fillRect(sx, sy, sw, sh * 0.18);
      g.restore();



      // Deck: keys with real gaps, narrowing with the perspective.
      const deck = g.createLinearGradient(0, h * 0.67, 0, h * 0.87);
      deck.addColorStop(0, '#e6ded0');
      deck.addColorStop(0.35, '#cfc6b6');
      deck.addColorStop(1, '#a99e8b');
      poly([[w * 0.13, h * 0.67], [w * 0.87, h * 0.67], [w * 0.98, h * 0.87], [w * 0.02, h * 0.87]], deck);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const pool = g.createRadialGradient(w * 0.5, h * 0.69, 0, w * 0.5, h * 0.69, w * 0.42);
      pool.addColorStop(0, 'rgba(255, 246, 228, 0.22)');
      pool.addColorStop(1, 'rgba(255, 246, 228, 0)');
      g.fillStyle = pool;
      g.fillRect(w * 0.02, h * 0.67, w * 0.96, h * 0.2);
      g.restore();
      for (let r = 0; r < 4; r++) {
        const inset = w * (0.2 + r * 0.015);
        const y = h * (0.7 + r * 0.04);
        const span = w - inset * 2;
        const kw = (span / 12) * 0.82;
        for (let c = 0; c < 12; c++) {
          g.fillStyle = 'rgba(120, 108, 92, 0.28)';
          g.beginPath();
          g.roundRect(inset + (span / 12) * c + (span / 12 - kw) / 2, y, kw, h * 0.026, h * 0.006);
          g.fill();
        }
      }
      g.restore();

      // Cards, each a beat later, floating over the machine.
      const cards = [
        { x: 0.03, y: 0.46, tile: '#e7a39c', glyph: 'rgba(255,255,255,0.85)', step: 'STEP 01', title: 'Lift', note: '+11 m travel' },
        { x: 0.27, y: 0.4, tile: '#c8f24a', glyph: 'rgba(16,16,16,0.7)', step: 'STEP 02', title: 'Body', note: 'frame-ready' },
        { x: 0.51, y: 0.44, tile: '#c4553f', glyph: 'rgba(255,255,255,0.85)', step: 'STEP 03', title: 'Tires', note: '0.9 m mud' },
        { x: 0.75, y: 0.5, tile: '#1b1712', glyph: 'rgba(255,255,255,0.85)', step: 'STEP 04', title: 'Build', note: 'ready' },
      ];
      const cw = w * 0.23;
      const ch = h * 0.21;
      const leave = span(t, 4.5, 5.4);
      cards.forEach((card, i) => {
        const enter = outCubic((t - 0.3 - i * 0.15) / 0.55);
        const out = 1 - leave;
        const y = h * card.y + leave * h * 0.22;
        if (out <= 0.01) return;
        g.save();
        g.globalAlpha = out;
        glassCard(g, w * card.x, y, cw, ch, card, Math.min(enter, out));
        g.restore();
      });

      // The pill: what this film is about.
      const pill = span(t, 0.1, 0.6);
      g.save();
      g.globalAlpha = pill;
      const pw = w * 0.44;
      const ph = h * 0.09;
      const px = w * 0.5 - pw / 2;
      const py = h * 0.04 + (1 - pill) * -h * 0.03;
      g.shadowColor = 'rgba(60, 40, 20, 0.22)';
      g.shadowBlur = h * 0.05;
      g.fillStyle = '#fdfaf4';
      g.beginPath();
      g.roundRect(px, py, pw, ph, ph / 2);
      g.fill();
      g.shadowBlur = 0;
      g.fillStyle = '#1b1712';
      g.beginPath();
      g.roundRect(px + pw * 0.035, py + ph * 0.22, ph * 0.56, ph * 0.56, ph * 0.16);
      g.fill();
      g.fillStyle = '#1b1712';
      g.font = `500 ${Math.max(7, h * 0.04)}px ${SANS}`;
      g.fillText('Planning with MCP', px + pw * 0.13, py + ph * 0.44);
      g.fillStyle = 'rgba(27,23,18,0.45)';
      g.font = `500 ${Math.max(6, h * 0.03)}px ${SANS}`;
      g.fillText('build steps', px + pw * 0.13, py + ph * 0.74);
      g.fillStyle = '#c4553f';
      g.font = `600 ${Math.max(8, h * 0.043)}px ${MONO}`;
      g.textAlign = 'right';
      g.fillText('0/4', px + pw * 0.95, py + ph * 0.62);
      g.textAlign = 'left';
      g.restore();

      veil(g, w, h, t, look);
    },
  },

  {
    id: 'guide',
    title: '图鉴',
    tag: '信息图解',
    ratio: 4 / 3,
    template: 'guide',
    look: LOOKS.paper,
    prompt: brief(
      '复刻这个动效：一本手绘动物图鉴的对页——米色纸、青色标题条、等宽小标签配衬线数值、虚线引线指向一只插画猫，右边是芯片编号与位置，一台青色扫描器扫过并读出编号',
      '要求：手绘感（粗糙边、纸纹、轻微错位）、只有青绿和蓝灰两种主色、引线和数字依次出现；不要渐变大色块。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      for (let i = 0; i < 220; i++) {
        g.globalAlpha = 0.05 + noise(i) * 0.05;
        g.fillStyle = noise(i + 5) > 0.5 ? '#8d7f66' : '#fffdf5';
        g.fillRect(noise(i + 11) * w, noise(i + 23) * h, 1.1, 1.1);
      }
      g.globalAlpha = 1;

      const gut = g.createLinearGradient(w * 0.47, 0, w * 0.53, 0);
      gut.addColorStop(0, 'rgba(120, 100, 70, 0)');
      gut.addColorStop(0.5, 'rgba(120, 100, 70, 0.18)');
      gut.addColorStop(1, 'rgba(120, 100, 70, 0)');
      g.fillStyle = gut;
      g.fillRect(w * 0.47, 0, w * 0.06, h);
      g.strokeStyle = 'rgba(120, 100, 70, 0.28)';
      g.lineWidth = 1;
      g.strokeRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92);

      const teal = look.accent;
      const head = (x, y, ww, text, p) => {
        g.save();
        g.globalAlpha = p;
        g.fillStyle = teal;
        g.beginPath();
        g.roundRect(x, y, ww, h * 0.075, h * 0.014);
        g.fill();
        g.fillStyle = '#fbf6e8';
        g.font = `600 ${Math.max(6, h * 0.03)}px ${SANS}`;
        g.letterSpacing = '0.1em';
        g.fillText(text, x + ww * 0.05, y + h * 0.052);
        g.letterSpacing = '0em';
        g.restore();
      };
      head(w * 0.08, h * 0.09, w * 0.36, 'DESCRIPTION', span(t, 0.1, 0.55));
      head(w * 0.56, h * 0.09, w * 0.36, 'MARKING', span(t, 0.2, 0.65));

      // Left page: labels, values, leaders that reach the animal.
      const fields = [
        ['NAME', 'Earl Grey'],
        ['SPECIES', 'Cat'],
        ['BREED', 'Shorthair'],
        ['SEX', 'Male'],
        ['COAT', 'Silver tabby'],
        ['BORN', '4 May 2022'],
      ];
      const catX = w * 0.37;
      fields.forEach((f, i) => {
        const p = span(t, 0.45 + i * 0.09, 0.8 + i * 0.09);
        if (p <= 0) return;
        const y = h * (0.24 + i * 0.092);
        g.save();
        g.globalAlpha = p;
        g.fillStyle = 'rgba(61,139,134,0.95)';
        g.font = `600 ${Math.max(4.5, h * 0.019)}px ${MONO}`;
        g.letterSpacing = '0.12em';
        g.fillText(f[0], w * 0.08, y);
        g.letterSpacing = '0em';
        g.fillStyle = '#26221b';
        g.font = `400 ${Math.max(6, h * 0.036)}px ${SERIF}`;
        g.fillText(f[1], w * 0.08, y + h * 0.036);
        const startX = w * 0.08 + Math.max(g.measureText(f[1]).width, w * 0.1) + w * 0.02;
        g.setLineDash([2, 3]);
        g.strokeStyle = 'rgba(29,26,22,0.3)';
        g.beginPath();
        g.moveTo(startX, y + h * 0.02);
        g.lineTo(startX + (catX - w * 0.06 - startX) * p, y + h * 0.02);
        g.stroke();
        g.setLineDash([]);
        g.restore();
      });

      // Animal: a blue-grey silhouette with ears, legs and a tail.
      const catP = span(t, 0.35, 1.1);
      g.save();
      g.globalAlpha = catP;
      g.fillStyle = '#4c5878';
      g.strokeStyle = '#2f3850';
      g.lineWidth = Math.max(1, w * 0.0035);
      g.beginPath();
      g.roundRect(catX - w * 0.045, h * 0.47, w * 0.09, h * 0.2, w * 0.03);
      g.fill();
      g.stroke();
      g.beginPath();
      g.arc(catX, h * 0.44, w * 0.042, 0, TAU);
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(catX - w * 0.035, h * 0.42);
      g.lineTo(catX - w * 0.018, h * 0.375);
      g.lineTo(catX - w * 0.002, h * 0.415);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(catX + w * 0.02, h * 0.412);
      g.lineTo(catX + w * 0.038, h * 0.375);
      g.lineTo(catX + w * 0.045, h * 0.425);
      g.closePath();
      g.fill();
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.roundRect(catX - w * 0.038 + i * w * 0.026, h * 0.64, w * 0.018, h * 0.05, w * 0.008);
        g.fill();
      }
      g.beginPath();
      g.moveTo(catX + w * 0.045, h * 0.63);
      g.quadraticCurveTo(catX + w * 0.1, h * 0.6, catX + w * 0.095, h * 0.53);
      g.stroke();
      g.restore();

      // Right page: the read number, then where the chip is.
      const numP = span(t, 1.3, 1.7);
      const num = Math.round(941000024681357 * outCubic((t - 1.4) / 1.2));
      g.save();
      g.globalAlpha = numP;
      g.fillStyle = '#d9f2c8';
      g.strokeStyle = teal;
      g.lineWidth = Math.max(1, w * 0.0035);
      g.beginPath();
      g.roundRect(w * 0.56, h * 0.3, w * 0.36, h * 0.1, h * 0.02);
      g.fill();
      g.stroke();
      g.fillStyle = '#173b36';
      g.font = `600 ${Math.max(6, h * 0.038)}px ${MONO}`;
      g.fillText(String(num).replace(/(\d{3})(?=\d)/g, '$1 '), w * 0.58, h * 0.362);
      g.restore();

      label(g, 'MICROCHIP NUMBER', w * 0.56, h * 0.24, Math.max(4.5, h * 0.019), 'rgba(61,139,134,0.95)', span(t, 1.1, 1.5), '0.12em');
      for (let i = 0; i < 5; i++) {
        g.save();
        g.globalAlpha = span(t, 1.1 + i * 0.04, 1.4 + i * 0.04) * 0.45;
        g.fillStyle = 'rgba(29,26,22,0.3)';
        g.fillRect(w * (0.56 + i * 0.032), h * 0.253, w * 0.022, h * 0.014);
        g.restore();
      }
      label(g, 'LOCATION', w * 0.56, h * 0.46, Math.max(4.5, h * 0.019), 'rgba(61,139,134,0.95)', span(t, 1.4, 1.8), '0.12em');
      g.save();
      g.globalAlpha = span(t, 1.5, 1.9);
      g.fillStyle = '#26221b';
      g.font = `400 ${Math.max(6, h * 0.036)}px ${SERIF}`;
      // Typewriter: characters land one by one, never as a block.
      const typed = 'Left side of neck';
      const shown = typed.slice(0, Math.round(typed.length * clamp01((t - 1.4) / 1.1)));
      g.fillText(shown, w * 0.56, h * 0.505);
      if (shown.length < typed.length && t > 1.4) {
        g.fillStyle = '#b4502f';
        g.fillRect(w * 0.56 + g.measureText(shown).width + 1, h * 0.475, Math.max(1, w * 0.005), h * 0.034);
      }
      g.restore();

      // The chip itself, drawn in the margin.
      g.save();
      g.globalAlpha = span(t, 1.6, 2.1);
      g.translate(w * 0.79, h * 0.66);
      g.rotate(-0.3);
      g.fillStyle = '#f2ead6';
      g.strokeStyle = '#3d8b86';
      g.lineWidth = Math.max(1, w * 0.003);
      g.beginPath();
      g.roundRect(-w * 0.07, -h * 0.025, w * 0.14, h * 0.05, h * 0.025);
      g.fill();
      g.stroke();
      g.strokeStyle = '#b4502f';
      g.lineWidth = Math.max(0.8, w * 0.002);
      g.beginPath();
      for (let i = 0; i < 14; i++) {
        const x = -w * 0.05 + i * w * 0.006;
        g.moveTo(x, -h * 0.014);
        g.lineTo(x + w * 0.002, h * 0.014);
      }
      g.stroke();
      g.restore();
      label(g, 'MICROCHIP', w * 0.72, h * 0.74, Math.max(4.5, h * 0.018), 'rgba(29,26,22,0.6)', span(t, 1.8, 2.2), '0.1em');

      // The scanner: a teal reader held over the animal's shoulder.
      const sweep = outCubic((t - 0.9) / 0.8);
      g.save();
      g.globalAlpha = span(t, 0.85, 1.2);
      g.translate(catX + w * 0.05 + (1 - sweep) * w * 0.4, h * 0.5 + (1 - sweep) * h * 0.04);
      g.rotate(-0.3);
      g.fillStyle = teal;
      g.beginPath();
      g.roundRect(0, 0, w * 0.12, h * 0.1, w * 0.014);
      g.fill();
      g.fillStyle = '#bfe6df';
      g.beginPath();
      g.roundRect(w * 0.012, h * 0.012, w * 0.05, h * 0.035, w * 0.006);
      g.fill();
      g.strokeStyle = 'rgba(191,230,223,0.55)';
      g.lineWidth = Math.max(1, w * 0.002);
      g.beginPath();
      g.moveTo(w * 0.06, h * 0.045);
      g.lineTo(w * 0.16, h * 0.05);
      g.stroke();
      g.restore();

      label(g, '2', w * 0.07, h * 0.94, Math.max(4.5, h * 0.018), 'rgba(29,26,22,0.4)', 1, '0.1em');
      label(g, '3', w * 0.93, h * 0.94, Math.max(4.5, h * 0.018), 'rgba(29,26,22,0.4)', 1, '0.1em');
    },
  },

  {
    id: 'tree',
    title: '树',
    tag: '场景叙事',
    ratio: 3 / 4,
    template: 'tree',
    look: { bg: '#0a0a0b', ink: '#ececea', dim: 'rgba(236,236,234,0.45)' },
    prompt: brief(
      '复刻这个动效：黑底上一棵树从一个点长出来，枝干逐段生长，末梢的金色叶点随后一盏盏亮起，右上角一轮暗月',
      '要求：只用金色、墨黑和一点月光；生长要有先后，不要一帧全亮。',
    ),
    draw(g, w, h, t) {
      ground(g, w, h, this.look);
      const mx = w * 0.78;
      const my = h * 0.15;
      const mr = Math.min(w, h) * 0.065;
      const halo = g.createRadialGradient(mx, my, mr * 0.4, mx, my, mr * 5);
      halo.addColorStop(0, 'rgba(232, 232, 230, 0.14)');
      halo.addColorStop(1, 'rgba(232, 232, 230, 0)');
      g.fillStyle = halo;
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(232, 232, 230, 0.85)';
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.fill();

      const glow = g.createRadialGradient(w * 0.5, h * 0.38, 0, w * 0.5, h * 0.38, w * 0.42);
      glow.addColorStop(0, 'rgba(227, 189, 99, 0.08)');
      glow.addColorStop(1, 'rgba(227, 189, 99, 0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);

      const grow = span(t, 0.25, 2.5);
      const root = { x: w * 0.5, y: h * 0.92 };
      const tips = [];
      const STEP = 0.15;
      const branch = (x, y, angle, len, depth, at) => {
        if (depth <= 0 || len < 1) return;
        const p = clamp01((grow - at) / STEP);
        if (p <= 0) return;
        const ex = x + Math.cos(angle) * len * p;
        const ey = y + Math.sin(angle) * len * p;
        g.strokeStyle = '#e3bd63';
        g.globalAlpha = depth > 3 ? 0.85 : 0.55;
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
        if (depth >= 4) branch(ex, ey, angle + noise(depth * 3 + x) * 0.7 - 0.35, len * 0.56, depth - 1, at + STEP);
      };
      branch(root.x, root.y, -Math.PI / 2, h * 0.24, 6, 0);

      const leaf = span(t, 1.9, 3.4);
      for (let i = 0; i < tips.length; i++) {
        const p = clamp01((leaf - i * 0.006) * 2.6);
        if (p <= 0) continue;
        const [tx, ty] = tips[i];
        const r = Math.max(0.8, w * 0.006 * (0.6 + 0.4 * p));
        g.fillStyle = '#e3bd63';
        g.globalAlpha = 0.35 + 0.55 * p;
        g.beginPath();
        g.arc(tx, ty, r, 0, TAU);
        g.fill();
        g.globalAlpha *= 0.6;
        g.beginPath();
        g.arc(tx + r * 1.6, ty - r * 0.9, r * 0.7, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      veil(g, w, h, t, this.look);
    },
  },

  {
    id: 'board',
    title: '榜屏',
    tag: '界面演示',
    ratio: 16 / 9,
    template: 'board',
    look: LOOKS.night,
    prompt: brief(
      '复刻这个动效：深色空间里一块排行榜屏幕，整体轻微透视倾斜，四行「名次 / 名字 / 分数」，榜首一行绿色高亮，第二名在第三秒反超，镜头缓慢推近',
      '要求：四周有明显暗角和柔光、屏幕有边框和表头、文字在小尺寸下也能读清（宁少勿小）；节奏是缓慢推近，不是快速切换。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);

      const glow = g.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, w * 0.72);
      glow.addColorStop(0, 'rgba(86, 122, 255, 0.12)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(0, 0, w, h);

      const push = 0.94 + 0.06 * outCubic(t / 2.4);
      const climb = 1 - outCubic(t / LOOP_SECONDS);
      g.save();
      g.translate(w * 0.5, h * 0.5 + climb * h * 0.05);
      g.transform(1, 0, -0.1, 0.97, 0, 0);
      g.scale(push, push);
      g.translate(-w * 0.5, -h * 0.5);

      // The screen itself: a panel, so the rows sit on something.
      g.fillStyle = 'rgba(8, 10, 14, 0.72)';
      g.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84, Math.max(4, w * 0.012));
      g.fill();
      g.stroke();

      label(g, 'MODEL SCORE', w * 0.12, h * 0.17, Math.max(5, h * 0.028), 'rgba(236,236,234,0.4)', span(t, 0.1, 0.6), '0.26em');
      g.save();
      g.globalAlpha = span(t, 0.3, 0.9);
      g.fillStyle = '#7ee787';
      g.beginPath();
      g.arc(w * 0.84, h * 0.16, Math.max(1.4, h * 0.006), 0, TAU);
      g.fill();
      g.restore();
      label(g, 'LIVE', w * 0.86, h * 0.17, Math.max(4.5, h * 0.024), 'rgba(126,231,135,0.75)', span(t, 0.3, 0.9), '0.2em');

      // Four rows, not six: at tile size six rows are unreadable, and a board
      // nobody can read is a texture, not a screen.
      const rows = [
        { rank: '01', name: 'Anthropic', score: '1496' },
        { rank: '02', name: 'Alibaba', score: '1486' },
        { rank: '03', name: 'Google', score: '1485' },
        { rank: '04', name: 'Moonshot', score: '1483' },
      ];
      const x = w * 0.13;
      const rw = w * 0.74;
      const rh = h * 0.165;
      // Row 02 overtakes row 01: positions swap, and the lead highlight moves.
      const swap = span(t, 2.1, 3.0);
      rows.forEach((row, i) => {
        const p = outCubic((t - 0.15 - i * 0.09) / 0.5);
        const base = h * 0.24 + i * rh;
        let y = base;
        if (i === 0) y = base + swap * rh;
        if (i === 1) y = base - swap * rh;
        const lead = (i === 0 && swap < 0.5) || (i === 1 && swap >= 0.5);
        // The rank label travels with the position, not with the name.
        const rank = i === 0 ? (swap >= 0.5 ? '02' : '01') : i === 1 ? (swap >= 0.5 ? '01' : '02') : row.rank;
        // Rows crossing mid-swap would print on top of each other; nudge them apart.
        const nudge = i < 2 ? (1 - Math.abs(swap - 0.5) * 2) * w * 0.04 * (i === 0 ? 1 : -1) : 0;
        boardRow(g, x + nudge, y, rw, rh, { ...row, rank }, p, lead);
      });

      // A slow scan line: the screen is alive, not a screenshot.
      const scan = ((t * 0.22) % 1) * 0.84 + 0.08;
      const grad = g.createLinearGradient(0, h * scan - h * 0.06, 0, h * scan + h * 0.02);
      grad.addColorStop(0, 'rgba(126, 231, 135, 0)');
      grad.addColorStop(1, 'rgba(126, 231, 135, 0.05)');
      g.fillStyle = grad;
      g.fillRect(w * 0.08, h * scan - h * 0.06, w * 0.84, h * 0.08);
      g.restore();

      const vig = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.34, w * 0.5, h * 0.5, w * 0.78);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.66)');
      g.fillStyle = vig;
      g.fillRect(0, 0, w, h);
      veil(g, w, h, t, look);
    },
  },

  {
    id: 'cards3d',
    title: '立体卡片',
    tag: '界面演示',
    template: 'cards3d',
    ratio: 16 / 9,
    engine: 'webgl',
    backdrop: 'radial-gradient(circle at 50% 40%, #1a1a1d 0%, #0a0a0b 70%)',
    look: { bg: '#0a0a0b', ink: '#f2f2f2', dim: 'rgba(242,242,242,0.5)' },
    prompt: brief(
      '复刻这个动效：深色舞台上三张有厚度、带倒角的卡片微微转动，金属边缘吃光，脚下有投影',
      '要求：真 3D（WebGL）、PBR 材质、真实阴影与反射；不要平面矩形和贴图冒充。',
    ),
    build({ THREE, renderer, width, height }) {
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0a0a0b');
      const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
      camera.position.set(0, 0.5, 7);
      camera.lookAt(0, 0, 0);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x08080a, 0.4));
      const key = new THREE.DirectionalLight(0xffffff, 2.6);
      key.position.set(3, 6, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      scene.add(key);
      const rim = new THREE.PointLight(0xffffff, 24, 18);
      rim.position.set(-3, 1.5, -2);
      scene.add(rim);

      // Colour in the environment, not only in the light rig: this is what
      // puts a magenta-to-cyan edge on every glossy surface in the frame.
      const room = new THREE.Scene();
      room.background = new THREE.Color('#050506');
      const strip = (x, y, z, sw, sh, rot, rgb, scale) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(sw, sh),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(rgb[0], rgb[1], rgb[2]).multiplyScalar(scale),
            side: THREE.DoubleSide,
          }),
        );
        m.position.set(x, y, z);
        m.rotation.set(rot[0], rot[1], rot[2]);
        room.add(m);
      };
      strip(0, 4, -3, 9, 3, [0, 0, 0], [1, 1, 1], 1.0);
      strip(-4, 0.5, 0, 6, 8, [0, Math.PI / 2, 0], [1, 0.24, 0.5], 2.6);
      strip(4, -0.5, 1, 4, 6, [0, -Math.PI / 2, 0], [0.2, 0.62, 1], 2.0);
      scene.environment = new THREE.PMREMGenerator(renderer).fromScene(room, 0.06).texture;

      // A glowing ring and a soft wash give the dark stage a centre.
      const wash = document.createElement('canvas');
      wash.width = 256;
      wash.height = 256;
      const wg = wash.getContext('2d');
      const wgrad = wg.createRadialGradient(128, 128, 0, 128, 128, 128);
      wgrad.addColorStop(0, 'rgba(120, 170, 255, 0.55)');
      wgrad.addColorStop(0.45, 'rgba(90, 120, 220, 0.16)');
      wgrad.addColorStop(1, 'rgba(90, 120, 220, 0)');
      wg.fillStyle = wgrad;
      wg.fillRect(0, 0, 256, 256);
      const washMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 9),
        new THREE.MeshBasicMaterial({
          map: new THREE.CanvasTexture(wash),
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      washMesh.position.set(0, 0.9, -2.6);
      scene.add(washMesh);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.012, 12, 160),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.72, 0.85, 1).multiplyScalar(0.9),
          toneMapped: false,
        }),
      );
      halo.position.set(0, 0.55, -2.2);
      scene.add(halo);
      const haloWide = new THREE.Mesh(
        new THREE.TorusGeometry(2.05, 0.055, 12, 160),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(0.55, 0.72, 1).multiplyScalar(0.5),
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false,
        }),
      );
      haloWide.position.copy(halo.position);
      scene.add(haloWide);

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.22, metalness: 0.65, envMapIntensity: 1.4 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.5;
      floor.receiveShadow = true;
      scene.add(floor);

      const shape = new THREE.Shape();
      const w = 1.02;
      const h = 1.56;
      const r = 0.16;
      shape.moveTo(-w / 2 + r, -h / 2);
      shape.lineTo(w / 2 - r, -h / 2);
      shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      shape.lineTo(w / 2, h / 2 - r);
      shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      shape.lineTo(-w / 2 + r, h / 2);
      shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      shape.lineTo(-w / 2, -h / 2 + r);
      shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      const geom = new THREE.ExtrudeGeometry(shape, {
        depth: 0.07,
        bevelEnabled: true,
        bevelThickness: 0.025,
        bevelSize: 0.025,
        bevelSegments: 4,
        curveSegments: 24,
      });
      geom.center();
      const material = new THREE.MeshPhysicalMaterial({
        color: 0x17171b,
        metalness: 0.42,
        roughness: 0.15,
        envMapIntensity: 2.4,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
      });

      const faceTexture = (count) => {
        const cv = document.createElement('canvas');
        cv.width = 256;
        cv.height = 392;
        const g = cv.getContext('2d');
        g.fillStyle = '#0c0c0d';
        g.fillRect(0, 0, 256, 392);
        const screen = g.createLinearGradient(0, 40, 0, 190);
        screen.addColorStop(0, '#6f6f6f');
        screen.addColorStop(1, '#1d1d1d');
        g.fillStyle = screen;
        g.beginPath();
        g.roundRect(22, 40, 212, 150, 16);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.font = '500 44px -apple-system, system-ui, sans-serif';
        g.fillText(String(count), 22, 296);
        g.fillStyle = 'rgba(255,255,255,0.42)';
        g.font = '400 22px -apple-system, system-ui, sans-serif';
        g.fillText('Views', 22, 330);
        const tex = new THREE.CanvasTexture(cv);
        tex.colorSpace = THREE.SRGBColorSpace;
        return tex;
      };

      const cards = [];
      [-1.15, 0, 1.15].forEach((x, i) => {
        const holder = new THREE.Group();
        holder.position.set(x, i % 2 ? -0.12 : 0.12, i % 2 ? 0.1 : -0.1);
        holder.rotation.y = -x * 0.16;
        const body = new THREE.Mesh(geom, material);
        body.castShadow = true;
        body.receiveShadow = true;
        holder.add(body);
        const face = new THREE.Mesh(
          new THREE.PlaneGeometry(0.94, 1.44),
          new THREE.MeshBasicMaterial({ map: faceTexture([15038, 518797, 9864421][i]), toneMapped: false }),
        );
        face.position.z = 0.09;
        holder.add(face);
        scene.add(holder);
        cards.push({ holder, base: holder.rotation.y, phase: i * 0.8 });
      });

      return {
        resize(w, h) {
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        },
        render(t) {
          const env = Math.min(1, t / 0.5) * Math.min(1, (LOOP_SECONDS - t) / 0.55);
          for (const card of cards) {
            card.holder.rotation.y = card.base + Math.sin(t * 0.7 + card.phase) * 0.28;
            card.holder.scale.setScalar(0.55 + env * 0.45);
          }
          camera.position.x = Math.sin(t * 0.25) * 0.4;
          camera.lookAt(0, 0, 0);
          renderer.render(scene, camera);
        },
      };
    },
  },

  {
    id: 'type',
    title: '动起来',
    tag: '文字排版',
    template: 'kinetic',
    ratio: 16 / 9,
    look: LOOKS.lime,
    prompt: brief(
      '复刻这个动效：亮黄绿底上三行超大黑色无衬线字「MAKE / IT / MOVE」，每行从遮罩里向上推出、逐行错开，最后一条细线划过',
      '要求：字距收紧、字重 700、留白极大；只用黑色，不要阴影和渐变。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const pad = w * 0.08;
      label(g, '01 — KINETIC TYPE', pad, h * 0.16, h * 0.032, look.dim, span(t, 0.15, 0.7), '0.28em');

      const words = ['MAKE', 'IT', 'MOVE'];
      const size = h * 0.235;
      words.forEach((word, i) => {
        const p = outCubic((t - 0.25 - i * 0.22) / 0.7);
        if (p <= 0) return;
        const y = h * (0.42 + i * 0.24);
        g.save();
        g.beginPath();
        g.rect(0, y - size * 1.02, w, size * 1.22);
        g.clip();
        g.fillStyle = look.ink;
        g.font = `700 ${size}px ${SANS}`;
        g.letterSpacing = '-0.035em';
        g.fillText(word, pad, y + (1 - p) * size * 0.95);
        g.letterSpacing = '0em';
        g.restore();
      });

      line(g, pad, h * 0.92, (w - pad * 2) * 0.34, look.ink, (t - 1.4) / 0.9);
      veil(g, w, h, t, look);
    },
  },

  {
    id: 'orbit',
    title: '行星',
    tag: '场景叙事',
    ratio: 16 / 9,
    template: 'orbit',
    look: LOOKS.navy,
    prompt: brief(
      '复刻这个动效：深色星场里一颗气态行星，环带从它身后穿过、被球体遮住一半，背光的一侧有细亮的边界光，四周有极淡的星云，镜头缓慢横移',
      '要求：星球要真的被光照着（明暗交界、边缘光、大气辉光），环带要有厚度和前后遮挡；星点细、不要五角星。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);

      const drift = Math.sin(t * 0.18) * w * 0.006;
      const cx = w * 0.63 + drift;
      const cy = h * 0.53;
      const r = Math.min(h * 0.30, w * 0.19);

      // --- nebula: two very wide, very faint washes
      g.save();
      g.globalCompositeOperation = 'lighter';
      const neb = [
        { x: cx - r * 1.6, y: cy - r * 0.9, rad: r * 3.4, c: '64, 82, 180', a: 0.30 },
        { x: cx + r * 1.9, y: cy + r * 1.1, rad: r * 3.0, c: '44, 96, 140', a: 0.22 },
        { x: cx + r * 0.2, y: cy - r * 2.0, rad: r * 2.4, c: '108, 70, 150', a: 0.18 },
      ];
      for (const n of neb) {
        const grd = g.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.rad);
        grd.addColorStop(0, `rgba(${n.c}, ${n.a})`);
        grd.addColorStop(0.55, `rgba(${n.c}, ${n.a * 0.28})`);
        grd.addColorStop(1, `rgba(${n.c}, 0)`);
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      }
      g.restore();

      // --- stars, three depths, drifting a little slower than the camera
      for (let i = 0; i < 260; i++) {
        const depth = 0.3 + noise(i + 5) * 0.7;
        const sx = ((noise(i) * w + w - drift * depth * 2.2) % w + w) % w;
        const sy = noise(i + 90) * h;
        const tw = 0.55 + 0.45 * Math.sin(t * (0.8 + depth) + i);
        g.globalAlpha = (0.12 + noise(i + 31) * 0.55) * tw * depth;
        g.fillStyle = noise(i + 7) > 0.82 ? '#cfe0ff' : '#e8eefc';
        g.beginPath();
        g.arc(sx, sy, 0.35 + depth * 0.85, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;

      // --- the ring plane, drawn in two halves so the planet occludes it
      const ringRot = -0.20;
      const rx = r * 1.92;
      const ry = r * 0.43;
      const drawRings = (front) => {
        g.save();
        g.translate(cx, cy);
        g.rotate(ringRot);
        // One disc made of overlapping bands: continuous, banded, and thinner
        // towards both edges. Drawn at a lower weight in front of the planet,
        // because the near side of a ring is seen at a grazing angle.
        for (let i = 0; i < 46; i++) {
          const k = i / 45;
          const s = 0.58 + k * 0.56;
          const grain = noise(i + 13);
          if (Math.abs(k - 0.47) < 0.035 || Math.abs(k - 0.74) < 0.022) continue;
          const edge = Math.pow(1 - Math.abs(k - 0.52) * 1.7, 0.9);
          const a = (front ? 0.22 : 0.42) * (0.30 + grain * 0.70) * edge;
          g.strokeStyle = `rgba(${214 + grain * 34}, ${218 + grain * 22}, 238, ${a.toFixed(3)})`;
          g.lineWidth = ry * 0.085;
          g.beginPath();
          g.ellipse(0, 0, rx * s, ry * s, 0, 0, TAU);
          g.stroke();
        }
        g.restore();
      };

      // The far and near halves are split along the ring plane itself, not a
      // horizontal line — otherwise the two halves meet in a visible seam.
      const clipHalf = (sign) => {
        g.save();
        g.beginPath();
        g.translate(cx, cy);
        g.rotate(ringRot);
        g.rect(-w * 3, sign > 0 ? 0 : -h * 3, w * 6, h * 3);
        g.restore();
        g.clip();
      };
      g.save();
      clipHalf(-1);
      drawRings(false);
      g.restore();

      // --- the planet: lit from upper left, falling to black on the lower right
      const lx = cx - r * 0.45;
      const ly = cy - r * 0.52;
      const sphere = g.createRadialGradient(lx, ly, r * 0.05, cx, cy, r * 1.06);
      sphere.addColorStop(0, '#8a9dc4');
      sphere.addColorStop(0.32, '#54648c');
      sphere.addColorStop(0.62, '#26304d');
      sphere.addColorStop(0.86, '#0d1224');
      sphere.addColorStop(1, '#05080f');
      g.save();
      g.beginPath();
      g.arc(cx, cy, r, 0, TAU);
      g.clip();
      g.fillStyle = sphere;
      g.fillRect(cx - r, cy - r, r * 2, r * 2);
      // cloud bands, only ever inside the sphere
      for (let i = 0; i < 7; i++) {
        const by = cy + (noise(i + 40) - 0.5) * r * 1.7;
        const bh = r * (0.06 + noise(i + 60) * 0.12);
        g.globalAlpha = 0.05 + noise(i + 70) * 0.07;
        g.fillStyle = i % 2 ? '#cfd9f2' : '#0a1020';
        g.beginPath();
        g.ellipse(cx + Math.sin(i) * r * 0.1, by, r * 1.1, bh, Math.sin(i * 2.1) * 0.12, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      // a shadow cast by the rings, a band across the ball
      for (const [dy, a, ry2] of [
        [-r * 0.02, 0.10, r * 0.22],
        [r * 0.02, 0.08, r * 0.19],
      ]) {
        g.globalAlpha = a;
        g.fillStyle = '#04060c';
        g.beginPath();
        g.ellipse(cx, cy + dy, r * 1.15, ry2, ringRot, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      g.restore();

      // --- rim light: the thin bright edge on the lit limb
      g.save();
      g.globalCompositeOperation = 'lighter';
      const rim = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      rim.addColorStop(0, 'rgba(196, 220, 255, 0.85)');
      rim.addColorStop(0.45, 'rgba(150, 180, 240, 0.30)');
      rim.addColorStop(0.72, 'rgba(90, 120, 200, 0.0)');
      rim.addColorStop(1, 'rgba(60, 90, 170, 0.45)');
      g.strokeStyle = rim;
      g.lineWidth = Math.max(1, r * 0.022);
      g.beginPath();
      g.arc(cx, cy, r * 0.995, 0, TAU);
      g.stroke();
      // atmosphere
      // Halos live outside the body: fill the annulus, never the disc, or the
      // planet turns into a bubble.
      const atmo = g.createRadialGradient(cx, cy, r * 0.99, cx, cy, r * 1.24);
      atmo.addColorStop(0, 'rgba(126, 170, 255, 0.34)');
      atmo.addColorStop(0.45, 'rgba(90, 130, 220, 0.12)');
      atmo.addColorStop(1, 'rgba(90, 130, 220, 0)');
      g.fillStyle = atmo;
      g.beginPath();
      g.arc(cx, cy, r * 1.24, 0, TAU);
      g.arc(cx, cy, r * 0.99, 0, TAU, true);
      g.fill('evenodd');
      g.restore();

      // --- the near half of the rings, over the planet
      g.save();
      clipHalf(1);
      drawRings(true);
      g.restore();

      // --- a moon, small and cold, on the far side
      const mx = cx + r * 1.95;
      const my = cy - r * 1.02;
      const mr = r * 0.11;
      const moon = g.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 0, mx, my, mr);
      moon.addColorStop(0, '#dbe4f6');
      moon.addColorStop(0.7, '#5b6684');
      moon.addColorStop(1, '#0a0f1c');
      g.fillStyle = moon;
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(200, 220, 255, 0.35)';
      g.lineWidth = 1;
      g.beginPath();
      g.arc(mx, my, mr, 0, TAU);
      g.stroke();

      veil(g, w, h, t, look);
    },
  },

  {
    id: 'prism',
    title: '棱镜',
    tag: '背景特效',
    ratio: 1,
    template: 'prism',
    look: LOOKS.plate,
    prompt: brief(
      '复刻这个动效：米色纸上的一幅印刷图解，一束光从左上射入玻璃三棱镜，出射面散成六条印刷色带，纸面有纤维和网点，四周是一圈墨线框',
      '要求：整张图是「印在纸上」的（纸纤维、网点、轻微套印不准），光的部分比纸更亮；不要发光渐变、不要紫底、不要矢量描边感。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      const ink = [42, 33, 24];
      paper(g, w, h, { base: [238, 227, 203], seed: 11, mottle: 18, grain: 10 });

      const cx = w * 0.6 + Math.sin(t * 0.22) * w * 0.005;
      const cy = h * 0.44;
      const R = Math.min(w * 0.19, h * 0.19);
      const rot = 0.15 + Math.sin(t * 0.3) * 0.02;
      const ca = Math.cos(rot);
      const sa = Math.sin(rot);
      const P = (x, y) => [cx + x * ca - y * sa, cy + x * sa + y * ca];
      const apex = P(0, -R);
      const left = P(-0.866 * R, 0.5 * R);
      const right = P(0.866 * R, 0.5 * R);
      const inFace = [(apex[0] + left[0]) / 2, (apex[1] + left[1]) / 2];
      const outFace = [(apex[0] + right[0]) / 2, (apex[1] + right[1]) / 2];

      // --- the light itself: warmer than the paper, never a gradient background
      const beamFrom = [-w * 0.08, cy - R * 1.55];
      const softBand = (a, b, halfA, halfB, color, peak, steps = 20) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        g.lineCap = 'butt';
        for (let i = 0; i < steps; i++) {
          const s = (i + 0.5) / steps;
          const u = (s - 0.5) * 2;
          const prof = Math.exp(-u * u * 1.7);
          g.strokeStyle = `rgba(${color}, ${(peak * prof).toFixed(3)})`;
          g.lineWidth = ((halfA + halfB) / steps) * 2.2;
          g.beginPath();
          g.moveTo(a[0] + nx * u * halfA, a[1] + ny * u * halfA);
          g.lineTo(b[0] + nx * u * halfB, b[1] + ny * u * halfB);
          g.stroke();
        }
      };
      g.save();
      g.globalCompositeOperation = 'lighter';
      softBand(beamFrom, inFace, R * 0.62, R * 0.2, '255, 246, 214', 0.10, 12);
      softBand(beamFrom, inFace, R * 0.22, R * 0.06, '255, 250, 232', 0.26);
      g.restore();

      // --- the printed spectrum: flat inks that fade back to paper, not to black
      const SPECTRUM = ['228, 74, 74', '236, 138, 54', '240, 200, 66', '104, 176, 112', '74, 140, 208', '146, 106, 194'];
      g.save();
      for (let i = 0; i < SPECTRUM.length; i++) {
        const k = (i + 0.5) / SPECTRUM.length;
        const wob = Math.sin(t * 0.5 + i * 1.3) * R * 0.012;
        const ey = outFace[1] + R * (0.05 + k * 2.15) + wob;
        const ex = w * 0.9;
        const near = R * 0.03;
        const far = R * (0.1 + k * 0.11);
        const grad = g.createLinearGradient(outFace[0], outFace[1], ex, ey);
        grad.addColorStop(0, `rgba(${SPECTRUM[i]}, 0.9)`);
        grad.addColorStop(0.5, `rgba(${SPECTRUM[i]}, 0.6)`);
        grad.addColorStop(1, `rgba(${SPECTRUM[i]}, 0)`);
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(outFace[0], outFace[1] - near);
        g.lineTo(ex, ey - far);
        g.lineTo(ex, ey + far);
        g.lineTo(outFace[0], outFace[1] + near);
        g.closePath();
        g.fill();
      }
      g.restore();
      // print misregistration: the colour plate sits a hair off the key plate
      g.save();
      g.globalAlpha = 0.22;
      g.translate(w * 0.0025, h * 0.002);
      for (let i = 0; i < 3; i++) {
        const k = (i + 0.5) / 3;
        const ey = outFace[1] + R * (0.05 + k * 2.15);
        g.fillStyle = `rgba(${SPECTRUM[i * 2]}, 0.7)`;
        g.beginPath();
        g.moveTo(outFace[0], outFace[1] - R * 0.03);
        g.lineTo(w * 0.9, ey - R * 0.14);
        g.lineTo(w * 0.9, ey + R * 0.14);
        g.lineTo(outFace[0], outFace[1] + R * 0.03);
        g.closePath();
        g.fill();
      }
      g.restore();

      // --- the glass: an ink outline with a paper-tinted body
      g.save();
      g.beginPath();
      g.moveTo(apex[0], apex[1]);
      g.lineTo(left[0], left[1]);
      g.lineTo(right[0], right[1]);
      g.closePath();
      g.fillStyle = 'rgba(252, 248, 236, 0.55)';
      g.fill();
      g.save();
      g.clip();
      const shade = g.createLinearGradient(cx, apex[1], cx, right[1]);
      shade.addColorStop(0, 'rgba(255,255,255,0.5)');
      shade.addColorStop(1, 'rgba(150, 132, 104, 0.18)');
      g.fillStyle = shade;
      g.fillRect(left[0] - R, apex[1], R * 3, R * 2.4);
      // light bends inside the glass: a faint warm line, drawn, not radiating
      g.strokeStyle = 'rgba(255, 246, 214, 0.85)';
      g.lineWidth = R * 0.05;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(inFace[0], inFace[1]);
      g.lineTo(outFace[0], outFace[1]);
      g.stroke();
      g.restore();
      g.restore();
      inkStroke(g, [apex, left, right, apex], { width: Math.max(1.6, R * 0.045), color: ink, dry: 0.5, seed: 4 });

      // --- ink dust: specks on the paper, not glowing bokeh
      for (let i = 0; i < 40; i++) {
        const x = noise(i + 3) * w;
        const y = noise(i + 7) * h;
        g.globalAlpha = 0.1 + noise(i + 11) * 0.16;
        g.fillStyle = `rgba(${ink.join(',')}, 0.6)`;
        g.beginPath();
        g.arc(x, y, 0.6 + noise(i + 13) * 0.8, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;

      // --- plate furniture
      halftone(g, w, h, { cell: Math.max(3, w * 0.005), alpha: 0.05 });
      g.strokeStyle = 'rgba(42, 33, 24, 0.55)';
      g.lineWidth = 1;
      g.strokeRect(w * 0.055, h * 0.05, w * 0.89, h * 0.9);
      label(g, 'PLATE III — DISPERSION', w * 0.085, h * 0.935, h * 0.022, 'rgba(42,33,24,0.62)', span(t, 0.3, 1), '0.22em');
      bleed(g, w, h, { color: ink, amount: 0.1 });
      veil(g, w, h, t, look);
    },
  },
];
