// The empty workspace is a gallery, not an error page: a wall of short loops
// someone can watch, copy the recipe of, or hand to the agent to build for real.
//
// Each tile is a whole art direction, not a colour swap: a warm product film with
// a laptop on a desk and glass cards floating over it, a hand-drawn field-guide
// spread on paper, a leaderboard tilted away in the dark. Every one is a genuine
// animation — a pure function of time on canvas 2D.

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
  g.shadowColor = 'rgba(60, 40, 20, 0.18)';
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
  g.fillStyle = 'rgba(27,23,18,0.42)';
  g.font = `500 ${Math.max(6, w * 0.038)}px ${MONO}`;
  g.letterSpacing = '0.16em';
  g.fillText(card.step, x + w * 0.3, top + h * 0.26);
  g.letterSpacing = '0em';
  g.fillStyle = '#1b1712';
  g.font = `600 ${Math.max(8, w * 0.062)}px ${SANS}`;
  g.fillText(card.title, x + w * 0.3, top + h * 0.5);
  g.fillStyle = 'rgba(27,23,18,0.45)';
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
  g.fillStyle = highlight ? 'rgba(126,231,135,0.9)' : 'rgba(236,236,234,0.35)';
  g.font = `400 ${Math.max(7, h * 0.34)}px ${MONO}`;
  g.fillText(row.rank, x + w * 0.02, y + h * 0.68);

  g.fillStyle = highlight ? '#7ee787' : '#ececea';
  g.font = `500 ${Math.max(8, h * 0.5)}px ${SANS}`;
  g.fillText(row.name, x + w * 0.1, y + h * 0.72);

  g.fillStyle = highlight ? '#7ee787' : 'rgba(236,236,234,0.82)';
  g.font = `400 ${Math.max(8, h * 0.46)}px ${MONO}`;
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
    featured: true,
    look: LOOKS.desk,
    prompt: brief(
      '复刻这个动效：暖色房间里一台笔记本电脑，屏幕里是浏览器里的产品界面，四张半透明步骤卡从下方依次浮到前景，顶部一条胶囊写着这次要做什么',
      '要求：背景有景深、卡片有柔和投影和轻微视差、卡片依次错开 0.15 秒；暖调配色，不要荧光。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      const bg = g.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#f3e7d7');
      bg.addColorStop(0.55, '#e7d4be');
      bg.addColorStop(1, '#c7ab8e');
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);

      // Out-of-focus room.
      g.save();
      g.filter = `blur(${Math.max(8, w * 0.022)}px)`;
      g.fillStyle = 'rgba(203,180,150,0.75)';
      g.beginPath();
      g.ellipse(w * 0.92, h * 0.18, w * 0.12, h * 0.2, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(255,251,243,0.7)';
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

      // Lid and its screen, both trapezoids.
      poly([[w * 0.17, h * 0.19], [w * 0.83, h * 0.19], [w * 0.87, h * 0.67], [w * 0.13, h * 0.67]], '#1d1d22');
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
      g.restore();

      // Deck: keys with real gaps, narrowing with the perspective.
      poly([[w * 0.13, h * 0.67], [w * 0.87, h * 0.67], [w * 0.98, h * 0.87], [w * 0.02, h * 0.87]], '#e3dccf');
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
    id: 'board',
    title: '榜屏',
    tag: '界面演示',
    ratio: 16 / 9,
    look: LOOKS.night,
    prompt: brief(
      '复刻这个动效：深色空间里一块排行榜屏幕，整体轻微透视倾斜，六行「名次 / 名字 / 型号 / 分数」，榜首一行绿色高亮，镜头缓慢推近',
      '要求：四周有明显暗角和柔光、屏幕有边框和表头、文字在小尺寸下能读清；节奏是缓慢推近，不是快速切换。',
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
      g.transform(1, 0, -0.17, 0.94, 0, 0);
      g.scale(push, push);
      g.translate(-w * 0.5, -h * 0.5);

      // The screen itself: a panel, so the rows sit on something.
      g.fillStyle = 'rgba(255, 255, 255, 0.035)';
      g.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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

      const rows = [
        { rank: '01', name: 'Anthropic', model: 'claude-opus', score: '1496' },
        { rank: '02', name: 'Alibaba', model: 'qwen', score: '1486' },
        { rank: '03', name: 'Google', model: 'gemini', score: '1485' },
        { rank: '04', name: 'Moonshot', model: 'kimi', score: '1483' },
        { rank: '05', name: 'OpenAI', model: 'gpt', score: '1471' },
        { rank: '06', name: 'Mistral', model: 'large', score: '1452' },
      ];
      const x = w * 0.13;
      const rw = w * 0.74;
      const rh = h * 0.108;
      // Row 02 overtakes row 01: positions swap, and the lead highlight moves.
      const swap = span(t, 2.1, 3.0);
      rows.forEach((row, i) => {
        const p = outCubic((t - 0.15 - i * 0.09) / 0.5);
        const base = h * 0.22 + i * rh;
        let y = base;
        if (i === 0) y = base + swap * rh;
        if (i === 1) y = base - swap * rh;
        const lead = (i === 0 && swap < 0.5) || (i === 1 && swap >= 0.5);
        // The rank label travels with the position, not with the name.
        const rank = i === 0 ? (swap >= 0.5 ? '02' : '01') : i === 1 ? (swap >= 0.5 ? '01' : '02') : row.rank;
        boardRow(g, x, y, rw, rh, { ...row, rank }, p, lead);
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
    id: 'carousel',
    title: '旋转海报',
    tag: '场景叙事',
    ratio: 16 / 9,
    engine: 'webgl',
    backdrop: 'radial-gradient(circle at 50% 42%, #2a63d8 0%, #123a94 55%, #07194a 100%)',
    look: { bg: '#123a94', ink: '#ffffff', dim: 'rgba(255,255,255,0.6)' },
    prompt: brief(
      '复刻这个动效：蓝色渐变背景里，八张海报围成一个圈缓慢自转，像展示台；每张海报的正面朝向圆心外侧',
      '要求：真 3D（WebGL 场景，kind: webgl），带透视和远近大小，海报纹理由 canvas 画出来；转速慢，不要抖动。',
    ),
    panel(g, w, h, i) {
      const looks = [
        { bg: '#2a1052', ink: '#f4ead8', accent: '#8d6bff' },
        { bg: '#f6efe2', ink: '#241f1a', accent: '#d5532e' },
        { bg: '#8f8a4f', ink: '#f7f2df', accent: '#d9d2a8' },
        { bg: '#1d2f5c', ink: '#eef2ff', accent: '#7fb0ff' },
      ];
      const look = looks[i % looks.length];
      g.fillStyle = look.bg;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.lineWidth = 2;
      g.strokeRect(0.6, 0.6, w - 1.2, h - 1.2);
      g.textAlign = 'center';
      if (i % 4 === 0) {
        g.fillStyle = look.accent;
        g.beginPath();
        g.arc(w * 0.78, h * 0.18, w * 0.03, 0, TAU);
        g.fill();
        g.fillStyle = look.ink;
        g.font = `500 ${h * 0.16}px ${SERIF}`;
        g.fillText('BD', w / 2, h * 0.56);
        g.font = `500 ${h * 0.03}px ${MONO}`;
        g.fillText('ATELIER', w / 2, h * 0.62);
      } else if (i % 4 === 1) {
        g.strokeStyle = look.accent;
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(w * 0.2, h * 0.3);
        g.quadraticCurveTo(w * 0.34, h * 0.2, w * 0.42, h * 0.36);
        g.quadraticCurveTo(w * 0.5, h * 0.52, w * 0.38, h * 0.6);
        g.quadraticCurveTo(w * 0.28, h * 0.66, w * 0.24, h * 0.56);
        g.stroke();
        g.fillStyle = look.accent;
        g.beginPath();
        g.arc(w * 0.38, h * 0.44, w * 0.035, 0, TAU);
        g.fill();
      } else if (i % 4 === 2) {
        g.textAlign = 'left';
        g.fillStyle = look.ink;
        g.font = `500 ${h * 0.035}px ${MONO}`;
        g.letterSpacing = '0.14em';
        g.fillText('CONSISTENCY', w * 0.1, h * 0.24);
        g.letterSpacing = '0em';
        g.fillStyle = look.accent;
        const bars = [0.3, 0.45, 0.6, 0.78, 0.95];
        bars.forEach((b, k) => {
          g.fillRect(w * 0.1 + k * w * 0.135, h * 0.72 - h * 0.4 * b, w * 0.1, h * 0.4 * b);
        });
      } else {
        const grad = g.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, look.accent);
        grad.addColorStop(1, look.bg);
        g.fillStyle = grad;
        g.fillRect(w * 0.14, h * 0.14, w * 0.72, h * 0.72);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.beginPath();
        g.arc(w * 0.38, h * 0.4, w * 0.1, 0, TAU);
        g.fill();
      }
    },
    /** Built by the gallery's WebGL player; returns a render(t). */
    build({ THREE, renderer, width, height }) {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 60);
      camera.position.set(0, 0.05, 7.4);
      camera.lookAt(0, 0, 0);
      const group = new THREE.Group();
      scene.add(group);
      const count = 8;
      const radius = 2.3;
      const posters = [];
      for (let i = 0; i < count; i++) {
        const face = document.createElement('canvas');
        face.width = 256;
        face.height = 320;
        this.panel(face.getContext('2d'), 256, 320, i);
        const texture = new THREE.CanvasTexture(face);
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.88), material);
        const angle = (i / count) * Math.PI * 2;
        plane.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        plane.rotation.y = angle;
        group.add(plane);
        posters.push(material);
      }
      return {
        resize(w, h) {
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        },
        render(t) {
          const env = Math.min(1, t / 0.5) * Math.min(1, (LOOP_SECONDS - t) / 0.55);
          for (const material of posters) material.opacity = env;
          group.rotation.y = t * 0.42;
          renderer.render(scene, camera);
        },
      };
    },
  },

  {
    id: 'cards3d',
    title: '立体卡片',
    tag: '界面演示',
    ratio: 4 / 5,
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

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 40),
        new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.45, metalness: 0.3 }),
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
      const material = new THREE.MeshStandardMaterial({
        color: 0x1c1c20,
        metalness: 0.75,
        roughness: 0.3,
        emissive: 0x0d0d10,
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
    id: 'tree',
    title: '树',
    tag: '场景叙事',
    ratio: 3 / 4,
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
    id: 'orbit',
    title: '轨道',
    tag: '场景叙事',
    ratio: 16 / 9,
    look: LOOKS.navy,
    prompt: brief(
      '复刻这个动效：深蓝星场里一条很淡的椭圆轨道，一个金点沿轨道走，身后留一点余辉',
      '要求：星点很细、轨道只有一条、整段只有这个点在动。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      for (let i = 0; i < 80; i++) {
        g.globalAlpha = 0.15 + noise(i + 31) * 0.5;
        g.fillStyle = '#cdd7ea';
        g.beginPath();
        g.arc(noise(i) * w, noise(i + 90) * h, 0.4 + noise(i + 61) * 0.9, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;

      const cx = w * 0.6;
      const cy = h * 0.52;
      const rx = w * 0.32;
      const ry = h * 0.27;
      g.save();
      g.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      g.lineWidth = 1;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, -0.18, -Math.PI * 0.9, -Math.PI * 0.9 + TAU * 0.92 * span(t, 0.2, 1.6));
      g.stroke();
      g.restore();

      const turn = (t * 0.62) % TAU;
      for (let i = 0; i < 12; i++) {
        const a = turn - i * 0.035;
        g.globalAlpha = (1 - i / 12) * 0.5;
        g.fillStyle = look.accent;
        g.beginPath();
        g.arc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, Math.max(0.6, h * 0.006 * (1 - i / 14)), 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      g.fillStyle = look.accent;
      g.beginPath();
      g.arc(cx + Math.cos(turn) * rx, cy + Math.sin(turn) * ry, Math.max(1.6, h * 0.013), 0, TAU);
      g.fill();
      veil(g, w, h, t, look);
    },
  },

  {
    id: 'prism',
    title: '光晕',
    tag: '背景特效',
    ratio: 3 / 4,
    look: LOOKS.dusk,
    prompt: brief(
      '复刻这个动效：深紫底上三团洋红、橙、青的光缓慢漂移、互相叠加，画面内侧一圈 1px 细框，底部一行等宽小字',
      '要求：亮度低、边缘极柔、有细颗粒；不要文字标题，不要锐利形状。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const blobs = [
        { x: 0.34, y: 0.4, r: 0.62, c: '255, 122, 184', speed: 0.11, phase: 0 },
        { x: 0.66, y: 0.52, r: 0.56, c: '255, 154, 74', speed: 0.08, phase: 2 },
        { x: 0.5, y: 0.7, r: 0.6, c: '96, 132, 255', speed: 0.06, phase: 4 },
      ];
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const b of blobs) {
        const dx = Math.sin(t * b.speed * 2 + b.phase) * w * 0.12;
        const dy = Math.cos(t * b.speed * 1.5 + b.phase) * h * 0.07;
        const r = b.r * Math.min(w, h) * 0.75;
        const grad = g.createRadialGradient(w * b.x + dx, h * b.y + dy, 0, w * b.x + dx, h * b.y + dy, r);
        grad.addColorStop(0, `rgba(${b.c}, 0.34)`);
        grad.addColorStop(1, `rgba(${b.c}, 0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, w, h);
      }
      g.restore();

      for (let i = 0; i < 200; i++) {
        g.globalAlpha = 0.025 + noise(i) * 0.03;
        g.fillStyle = noise(i + 9) > 0.5 ? '#ffffff' : '#000000';
        g.fillRect(noise(i + 3) * w, noise(i + 17) * h, 1, 1);
      }
      g.globalAlpha = 1;

      g.strokeStyle = 'rgba(246,236,255,0.28)';
      g.lineWidth = 1;
      g.strokeRect(w * 0.06, h * 0.05, w * 0.88, h * 0.9);
      label(g, 'PRISM 03', w * 0.1, h * 0.93, h * 0.022, 'rgba(246,236,255,0.55)', span(t, 0.4, 1), '0.3em');
      veil(g, w, h, t, look);
    },
  },
];
