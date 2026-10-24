// The empty workspace is a gallery, not an error page: a wall of short loops
// someone can watch, copy the recipe of, or hand to the agent to build for real.
//
// Every tile is a genuine animation — a pure function of time on canvas 2D — and
// no two share a palette or a type voice: a lime kinetic-type poster next to a
// paper wall label, a dithered disc on white next to a gold tree on black. The
// point of the wall is range.

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
  lime: { bg: '#d9ff3d', ink: '#101010', dim: 'rgba(16,16,16,0.5)' },
  cream: { bg: '#f2ebdd', ink: '#1b1815', dim: 'rgba(27,24,21,0.5)', accent: '#b4502f' },
  white: { bg: '#ffffff', ink: '#101012', dim: 'rgba(16,16,18,0.45)', accent: '#e2503a' },
  ice: { bg: '#e9eef5', ink: '#101a26', dim: 'rgba(16,26,38,0.45)', accent: '#2f62f0' },
  clay: { bg: '#bf5238', ink: '#f8efe3', dim: 'rgba(248,239,227,0.6)', accent: '#f8efe3' },
  night: { bg: '#0a0a0b', ink: '#ececea', dim: 'rgba(236,236,234,0.45)', accent: '#6f8dff' },
  navy: { bg: '#0b1322', ink: '#efece2', dim: 'rgba(239,236,226,0.5)', accent: '#d8a94a' },
  dusk: { bg: '#140c26', ink: '#f6ecff', dim: 'rgba(246,236,255,0.5)', accent: '#ff86c2' },
};

function ground(g, w, h, look) {
  g.fillStyle = look.bg;
  g.fillRect(0, 0, w, h);
}

/** Fade in and out by veiling with the tile's own ground colour. */
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

export const SAMPLES = [
  {
    id: 'type',
    title: '动起来',
    tag: '文字排版',
    ratio: 16 / 9,
    featured: true,
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
    id: 'paper',
    title: '纸本',
    tag: '文字排版',
    ratio: 4 / 5,
    look: LOOKS.cream,
    prompt: brief(
      '复刻这个动效：米色纸面上像美术馆墙签一样排三行字——等宽小标签、一行粗衬线标题、一行注记，旁边一块铁锈红纸片压着，缝线一段段画出来',
      '要求：纸张有细颗粒、阴影很轻、动作是低速停格（每秒 10 帧），不要顺滑缓动。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      for (let i = 0; i < 140; i++) {
        g.globalAlpha = 0.05 + noise(i) * 0.05;
        g.fillStyle = i % 3 ? '#8d8172' : '#ffffff';
        g.fillRect(noise(i + 11) * w, noise(i + 23) * h, 1.2, 1.2);
      }
      g.globalAlpha = 1;

      const q = Math.floor(t * 10) / 10;
      const pad = w * 0.1;
      const a = span(q, 0.2, 0.8);
      g.save();
      g.globalAlpha = a;
      g.rotate(0.02);
      g.fillStyle = '#fbf6ea';
      g.shadowColor = 'rgba(60, 45, 30, 0.18)';
      g.shadowBlur = h * 0.03;
      g.shadowOffsetY = h * 0.01;
      g.fillRect(pad, h * 0.2, w * 0.7, h * 0.52);
      g.restore();

      const b = span(q, 0.35, 0.95);
      g.save();
      g.globalAlpha = b;
      g.translate(w * 0.56, h * 0.5);
      g.rotate(0.05);
      g.fillStyle = look.accent;
      g.shadowColor = 'rgba(60, 45, 30, 0.2)';
      g.shadowBlur = h * 0.02;
      g.fillRect(0, 0, w * 0.3, h * 0.26);
      g.restore();

      const x = pad + w * 0.06;
      label(g, 'A STUDY IN PAPER', x, h * 0.32, h * 0.026, 'rgba(27,24,21,0.55)', span(q, 0.5, 1.1), '0.26em');

      const titleP = span(q, 0.6, 1.4);
      g.save();
      g.beginPath();
      g.rect(x - 4, h * 0.3, w * 0.6, h * 0.24 * titleP);
      g.clip();
      g.fillStyle = look.ink;
      g.font = `500 ${h * 0.085}px ${SERIF}`;
      g.fillText('Paper, cut', x, h * 0.42);
      g.fillText('slow', x, h * 0.51);
      g.restore();

      const stitch = span(q, 1.1, 2.2);
      g.save();
      g.strokeStyle = 'rgba(27,24,21,0.45)';
      g.lineWidth = Math.max(0.7, h * 0.003);
      g.setLineDash([h * 0.012, h * 0.014]);
      g.beginPath();
      g.moveTo(x, h * 0.56);
      g.lineTo(x + w * 0.34 * stitch, h * 0.56);
      g.stroke();
      g.restore();

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

  {
    id: 'dither',
    title: '网点',
    tag: '信息图解',
    ratio: 1,
    look: LOOKS.white,
    prompt: brief(
      '复刻这个动效：白底上一个黑色点阵圆盘从中心向外显影，点的大小由中心向外衰减，像一张放大的一比特照片',
      '要求：纯黑白、无灰度、无文字；点要一个个长出来，不能整块淡入。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const radius = Math.min(w, h) * 0.34;
      const side = radius * 2.1;
      const cols = 26;
      const cell = side / cols;
      const x0 = w * 0.5 - side / 2;
      const y0 = h * 0.5 - side / 2;
      for (let r = 0; r < cols; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = x0 + (c + 0.5) * cell;
          const cy = y0 + (r + 0.5) * cell;
          const fall = 1 - Math.hypot(cx - w * 0.5, cy - h * 0.5) / radius;
          if (fall <= 0.02) continue;
          const p = outCubic((t - 0.25 - (c / cols) * 0.9 - (r / cols) * 0.4) / 0.4);
          const dot = cell * 0.52 * fall ** 1.3 * p;
          if (dot < 0.2) continue;
          g.fillStyle = look.ink;
          g.beginPath();
          g.arc(cx, cy, dot, 0, TAU);
          g.fill();
        }
      }
      veil(g, w, h, t, look);
    },
  },

  {
    id: 'window',
    title: '界面',
    tag: '界面演示',
    ratio: 4 / 3,
    look: LOOKS.ice,
    prompt: brief(
      '复刻这个动效：浅灰蓝底上一张白色应用卡片从下浮入，标题栏三点、三行蓝灰列表从左展开，一个光标点移过去点一下',
      '要求：阴影极轻、圆角小、动效克制；不要深色模式和荧光色。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const up = outCubic((t - 0.2) / 0.9);
      const x = w * 0.1;
      const y = h * 0.22 + (1 - up) * h * 0.14;
      const ww = w * 0.8;
      const wh = h * 0.56;

      g.save();
      g.globalAlpha = up;
      g.shadowColor = 'rgba(20, 32, 48, 0.12)';
      g.shadowBlur = h * 0.05;
      g.shadowOffsetY = h * 0.015;
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.roundRect(x, y, ww, wh, Math.min(12, w * 0.022));
      g.fill();
      g.restore();

      const barY = y + wh * 0.17;
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = up;
        g.fillStyle = 'rgba(16, 26, 38, 0.18)';
        g.beginPath();
        g.arc(x + w * 0.035 + i * w * 0.024, y + wh * 0.06, Math.max(1.4, w * 0.0045), 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
      g.strokeStyle = 'rgba(16, 26, 38, 0.08)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, barY);
      g.lineTo(x + ww, barY);
      g.stroke();
      label(g, 'scene.ts', x + w * 0.04, y + wh * 0.12, h * 0.026, look.dim, 1, '0.04em');

      const rows = [
        { w: 0.5, accent: false },
        { w: 0.66, accent: true },
        { w: 0.36, accent: false },
      ];
      rows.forEach((row, i) => {
        const rp = outCubic((t - 0.5 - i * 0.15) / 0.5);
        if (rp <= 0) return;
        const ry = barY + wh * (0.22 + i * 0.2);
        g.save();
        g.globalAlpha = rp;
        g.fillStyle = row.accent ? look.accent : 'rgba(16, 26, 38, 0.12)';
        g.beginPath();
        g.roundRect(x + w * 0.05, ry, ww * row.w * (0.5 + 0.5 * rp), Math.max(4, h * 0.02), 3);
        g.fill();
        g.restore();
      });

      const cursor = outCubic((t - 1.3) / 0.9);
      const cx = x + ww * 0.6 * cursor + w * 0.03;
      const cy = barY + wh * 0.44 - h * 0.03 * cursor;
      g.save();
      g.globalAlpha = cursor > 0.02 ? 1 : 0;
      g.fillStyle = look.ink;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + w * 0.013, cy + h * 0.032);
      g.lineTo(cx + w * 0.004, cy + h * 0.029);
      g.closePath();
      g.fill();
      g.restore();

      veil(g, w, h, t, look);
    },
  },

  {
    id: 'tree',
    title: '树',
    tag: '场景叙事',
    ratio: 3 / 4,
    look: LOOKS.night,
    prompt: brief(
      '复刻这个动效：黑底上一棵树从一个点长出来，枝干逐段生长，末梢的金色叶点随后一盏盏亮起，右上角一轮暗月',
      '要求：只用金色、墨黑和一点月光；生长要有先后，不要一帧全亮。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
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
      veil(g, w, h, t, look);
    },
  },

  {
    id: 'chart',
    title: '折线',
    tag: '信息图解',
    ratio: 4 / 3,
    look: LOOKS.night,
    prompt: brief(
      '复刻这个动效：一块极淡网格的图区，一条青绿折线从左向右画出来，线头一个发光的点，左下角等宽刻度',
      '要求：近黑底、只保留一条线和一个点、面积一层很浅的渐变；不要图例。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const pad = w * 0.12;
      const x0 = pad;
      const x1 = w - pad;
      const top = h * 0.28;
      const bottom = h * 0.78;
      const vals = [0.24, 0.4, 0.3, 0.52, 0.44, 0.66, 0.58, 0.74, 0.68, 0.86, 0.8, 0.95];
      const yOf = (v) => bottom - v * (bottom - top);
      const p = span(t, 0.3, 2.2);
      for (let i = 0; i <= 4; i++) {
        const y = top + ((bottom - top) * i) / 4;
        g.save();
        g.globalAlpha = 0.5;
        g.strokeStyle = 'rgba(255,255,255,0.09)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x0, y);
        g.lineTo(x1, y);
        g.stroke();
        g.restore();
      }
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
      g.lineWidth = Math.max(1, h * 0.007);
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
      g.arc(x0 + (x1 - x0) * p, headY, h * 0.013, 0, TAU);
      g.fill();
      g.restore();
      veil(g, w, h, t, look);
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
    id: 'count',
    title: '计数',
    tag: '文字排版',
    ratio: 1,
    look: LOOKS.white,
    prompt: brief(
      '复刻这个动效：白底上一个等宽大数字从 000 滚到 268，数字右上角一个红点，下面两条 1px 细线',
      '要求：纯黑白加一个红点、等宽字、留白极大；数字用缓出，结尾停住。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const pad = w * 0.1;
      const p = outCubic((t - 0.3) / 1.6);
      const value = Math.round(268 * p);
      const size = h * 0.2;
      g.save();
      g.fillStyle = look.ink;
      g.font = `400 ${size}px ${MONO}`;
      g.letterSpacing = '-0.03em';
      g.fillText(String(value).padStart(3, '0'), pad, h * 0.5);
      const numberW = g.measureText('000').width;
      g.letterSpacing = '0em';
      g.restore();

      g.save();
      g.globalAlpha = span(t, 0.5, 1);
      g.fillStyle = look.accent;
      const dot = Math.max(3, h * 0.016);
      g.fillRect(pad + numberW + h * 0.03, h * 0.5 - size * 0.85, dot, dot);
      g.restore();

      line(g, pad, h * 0.6, w - pad * 2, 'rgba(16,16,18,0.14)', (t - 0.6) / 1);
      line(g, pad, h * 0.65, (w - pad * 2) * 0.4, 'rgba(16,16,18,0.14)', (t - 0.9) / 1);
      veil(g, w, h, t, look);
    },
  },

  {
    id: 'bars',
    title: '柱列',
    tag: '信息图解',
    ratio: 4 / 3,
    look: LOOKS.clay,
    prompt: brief(
      '复刻这个动效：陶红底上一排米白色细柱从基线依次长出来，柱高有起伏，底部一条细线',
      '要求：只有两种颜色、没有文字标签、柱子是长出来的；节奏慢。',
    ),
    draw(g, w, h, t) {
      const look = this.look;
      ground(g, w, h, look);
      const pad = w * 0.1;
      const base = h * 0.78;
      const inner = w - pad * 2;
      const count = 22;
      const step = inner / count;
      const barW = Math.max(3, step * 0.34);
      const wave = [];
      for (let i = 0; i < count; i++) {
        const v = Math.sin(i * 0.5 + 1.2) * 0.5 + 0.5;
        wave.push(0.12 + v * 0.82 * (0.75 + 0.25 * Math.sin(i * 0.17)));
      }
      g.fillStyle = look.ink;
      for (let i = 0; i < count; i++) {
        const p = outCubic((t - 0.25 - i * 0.03) / 0.45);
        if (p <= 0) continue;
        const height = wave[i] * h * 0.42 * p;
        g.fillRect(pad + i * step, base - height, barW, height);
      }
      line(g, pad, base, inner, 'rgba(248,239,227,0.45)', (t - 0.15) / 1);
      veil(g, w, h, t, look);
    },
  },
];
