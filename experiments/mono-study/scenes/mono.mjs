// A twelve-second monochrome film, in five beats, drawn entirely in code:
//
//   0.0–3.6  view-cards turning in space, counters rolling, one number above
//   3.6–3.9  a white cut
//   3.9–6.5  a hand lets coins fall onto stacks while the total climbs
//   6.5–9.4  a wheel of twelve choices spins and lands on a check
//   9.4–12.0 type: CREATE TO EARN
//
// The cards are real boxes (eight vertices, Y rotation, perspective divide,
// per-face shading, texture on the front quad), the coins are gradient ellipses,
// the hand is a path, the wheel is arc segments. Nothing is an image.

export const id = 'mono';
export const kind = 'canvas2d';
export const slots = {
  big: { default: '2 million+', role: 'title', maxChars: 24 },
  unit: { default: 'Views', role: 'caption', maxChars: 16 },
  money: { default: '52 million+', role: 'title', maxChars: 24 },
  moneyUnit: { default: 'earned', role: 'caption', maxChars: 16 },
  kicker: { default: 'CREATE TO EARN', role: 'label', maxChars: 40 },
};
export const textUsage = { big: 1, unit: 1, money: 1, moneyUnit: 1, kicker: 1 };

let ctx;
export function mount(context) {
  ctx = context;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const outCubic = (v) => 1 - (1 - clamp01(v)) ** 3;
const inOut = (v) => {
  const x = clamp01(v);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

/* ---- 3D card --------------------------------------------------------- */

const LIGHT = (() => {
  const v = [0.35, -0.45, 0.82];
  const len = Math.hypot(...v);
  return v.map((n) => n / len);
})();

function rotate(p, ry, rx) {
  const [x, y, z] = p;
  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  return [x1, y * cx - z1 * sx, y * sx + z1 * cx];
}

const FACES = [
  { n: [0, 0, 1], idx: [4, 5, 6, 7], shade: 1.0, face: true },
  { n: [0, 0, -1], idx: [1, 0, 3, 2], shade: 0.85 },
  { n: [1, 0, 0], idx: [5, 1, 2, 6], shade: 0.75 },
  { n: [-1, 0, 0], idx: [0, 4, 7, 3], shade: 0.65 },
  { n: [0, -1, 0], idx: [0, 1, 5, 4], shade: 0.8 },
  { n: [0, 1, 0], idx: [3, 7, 6, 2], shade: 0.55 },
];

const box = (w, h, d) => {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  return [
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
  ];
};

function shadeOf(normal, ry, rx) {
  const n = rotate(normal, ry, rx);
  return 0.3 + 0.7 * Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
}

function cardTexture(label, count, bright) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 400;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 400);
  grad.addColorStop(0, bright ? '#4a4a4a' : '#383838');
  grad.addColorStop(0.5, '#161616');
  grad.addColorStop(1, bright ? '#3a3a3a' : '#282828');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 400);
  const screen = g.createLinearGradient(0, 60, 0, 220);
  screen.addColorStop(0, bright ? '#767676' : '#565656');
  screen.addColorStop(1, bright ? '#2e2e2e' : '#222222');
  g.fillStyle = screen;
  g.beginPath();
  g.roundRect(26, 52, 204, 154, 14);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.font = '500 44px -apple-system, system-ui, sans-serif';
  g.fillText(String(count), 26, 304);
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.font = '400 22px -apple-system, system-ui, sans-serif';
  g.fillText(label, 26, 336);
  return cv;
}

function drawCard(g, cx, cy, size, t, card, alpha = 1) {
  const w = size;
  const h = size * 1.55;
  const d = Math.max(6, size * 0.09);
  const ry = card.base + Math.sin(t * card.spin + card.phase) * 0.95;
  const rx = -0.14 + Math.sin(t * 0.4 + card.phase) * 0.04;
  const f = Math.max(w, h) * 2.4;
  const camZ = 1400;
  const proj = box(w, h, d)
    .map((p) => rotate(p, ry, rx))
    .map(([x, y, z]) => {
      const s = f / (z + camZ);
      return [cx + x * s, cy + y * s, z];
    });

  const count = Math.round(card.value * outCubic((t - card.delay) / 1.2));
  const texture = cardTexture('Views', count, card.glow > 0.8);

  const order = FACES.map((face) => ({
    face,
    depth: face.idx.reduce((sum, i) => sum + proj[i][2], 0) / 4,
    normalZ: rotate(face.n, ry, rx)[2],
  })).sort((a, b) => a.depth - b.depth);

  g.save();
  g.globalAlpha *= alpha;
  for (const { face, normalZ } of order) {
    const pts = face.idx.map((i) => proj[i]);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();
    const shade = shadeOf(face.n, ry, rx) * face.shade;
    const lit = Math.round(30 + shade * 46);
    g.fillStyle = `rgb(${lit},${lit},${lit})`;
    g.fill();

    if (face.face && normalZ > 0.02) {
      const [p0, p1, , p3] = pts;
      g.save();
      g.clip();
      g.transform(
        (p1[0] - p0[0]) / 256,
        (p1[1] - p0[1]) / 256,
        (p3[0] - p0[0]) / 400,
        (p3[1] - p0[1]) / 400,
        p0[0],
        p0[1],
      );
      g.globalAlpha = 0.55 + shade * 0.45;
      g.drawImage(texture, 0, 0);
      g.restore();
    }

    g.strokeStyle = `rgba(255,255,255,${0.12 + shade * 0.32})`;
    g.lineWidth = 1.2;
    g.stroke();
  }
  g.restore();
}

/** A card with its pool of light, its reflection, and a short blur ghost. */
function stageCard(g, cx, cy, size, t, card, enter) {
  const h = size * 1.55;
  const pool = g.createRadialGradient(cx, cy + h * 0.1, 0, cx, cy + h * 0.1, size * 1.5);
  pool.addColorStop(0, `rgba(255,255,255,${0.05 * card.glow})`);
  pool.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = pool;
  g.fillRect(cx - size * 2, cy - size, size * 4, size * 3);

  g.save();
  g.globalAlpha = 0.14 * enter;
  g.filter = `blur(${Math.max(3, size * 0.06)}px)`;
  g.translate(cx, cy + h * 0.92);
  g.scale(1, -0.5);
  g.translate(-cx, -cy - h * 0.92);
  drawCard(g, cx, cy, size, t, card, 1);
  g.restore();

  g.save();
  g.shadowColor = `rgba(255,255,255,${0.25 * card.glow})`;
  g.shadowBlur = size * 0.7;
  drawCard(g, cx, cy, size, t, card, enter);
  g.restore();

  g.save();
  g.globalAlpha = 0.22 * enter;
  drawCard(g, cx + 3, cy, size, t - 0.02, card, 1);
  g.restore();
}

/* ---- coins and the hand ---------------------------------------------- */

function coin(g, x, y, r, tilt, alpha) {
  g.save();
  g.globalAlpha = alpha;
  const grad = g.createLinearGradient(x - r, y - r * tilt, x + r, y + r * tilt);
  grad.addColorStop(0, '#e8e8e8');
  grad.addColorStop(0.45, '#9a9a9a');
  grad.addColorStop(1, '#4a4a4a');
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(x, y, r, r * tilt, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)';
  g.lineWidth = Math.max(1, r * 0.06);
  g.beginPath();
  g.ellipse(x, y, r * 0.86, r * tilt * 0.86, 0, Math.PI * 0.1, Math.PI * 1.1);
  g.stroke();
  g.restore();
}

function stack(g, x, y, n, r) {
  for (let i = 0; i < n; i++) coin(g, x, y - i * r * 0.16, r, 0.3, 0.95);
}

function hand(g, w, h, t) {
  const enter = outCubic((t - 3.9) / 0.8);
  if (enter <= 0) return;
  const y = h * 0.78;
  g.save();
  g.translate(-w * 0.12 * (1 - enter), 0);
  const grad = g.createLinearGradient(0, y - h * 0.1, 0, y + h * 0.08);
  grad.addColorStop(0, '#6a6a6a');
  grad.addColorStop(1, '#202020');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(w * 0.02, y + h * 0.06);
  g.lineTo(w * 0.3, y + h * 0.02);
  g.quadraticCurveTo(w * 0.46, y - h * 0.01, w * 0.5, y - h * 0.035);
  g.quadraticCurveTo(w * 0.56, y - h * 0.06, w * 0.55, y - h * 0.02);
  g.quadraticCurveTo(w * 0.54, y + h * 0.01, w * 0.47, y + h * 0.03);
  g.quadraticCurveTo(w * 0.36, y + h * 0.06, w * 0.3, y + h * 0.075);
  g.lineTo(w * 0.02, y + h * 0.1);
  g.closePath();
  g.fill();
  g.restore();
}

/* ---- the wheel -------------------------------------------------------- */

const MARKS = ['+', '×', '+', '×', '+', '×', '+', '×', '+', '×', '+', '×'];

function wheel(g, cx, cy, r, angle, winner) {
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, r, a0, a1);
    g.closePath();
    g.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.035)';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.16)';
    g.lineWidth = 1;
    g.stroke();

    const mid = (a0 + a1) / 2;
    g.save();
    g.rotate(mid);
    g.translate(r * 0.62, 0);
    g.rotate(-mid);
    g.fillStyle = i === winner ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.4)';
    g.font = `600 ${r * 0.16}px -apple-system, system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(MARKS[i], 0, 0);
    g.restore();
  }
  g.fillStyle = '#0a0a0a';
  g.beginPath();
  g.arc(0, 0, r * 0.12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.stroke();
  g.restore();

  const halo = g.createRadialGradient(cx, cy, r * 0.86, cx, cy, r * 1.4);
  halo.addColorStop(0, 'rgba(255,255,255,0.14)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = halo;
  g.fillRect(cx - r * 1.5, cy - r * 1.5, r * 3, r * 3);
}

/* ---- the film --------------------------------------------------------- */

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, w, h);

  if (t < 3.6) {
    const enter = outCubic(t / 1.1);
    const pool = g.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.95);
    pool.addColorStop(0, 'rgba(255,255,255,0.06)');
    pool.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = pool;
    g.fillRect(0, 0, w, h);

    const cards = [
      { x: 0.25, y: 0.4, s: 0.3, value: 15038, base: -0.45, phase: 0.2, spin: 1.15, delay: 0.2, glow: 1 },
      { x: 0.75, y: 0.33, s: 0.19, value: 518797, base: 0.5, phase: 1.4, spin: 0.9, delay: 0.35, glow: 0.7 },
      { x: 0.32, y: 0.74, s: 0.16, value: 21204, base: -0.3, phase: 2.6, spin: 1.0, delay: 0.5, glow: 0.6 },
      { x: 0.71, y: 0.76, s: 0.34, value: 9864421, base: 0.4, phase: 3.4, spin: 0.8, delay: 0.15, glow: 1 },
    ];
    for (const card of cards) {
      stageCard(g, w * card.x, h * card.y + (1 - enter) * h * 0.05, w * card.s, t, card, enter);
    }

    const size = Math.round(h * 0.075);
    ctx.drawText('big', {
      x: w * 0.1, y: h * 0.1, w: w * 0.8, size, weight: 600, align: 'center',
      color: ctx.color('fg'), alpha: enter,
    });
    ctx.drawText('unit', {
      x: w * 0.1, y: h * 0.1 + size * 1.05, w: w * 0.8, size: Math.round(h * 0.03), weight: 400,
      align: 'center', color: ctx.color('muted'), alpha: enter,
    });

    const vig = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.25, w * 0.5, h * 0.5, h * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.78)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
    return;
  }

  if (t < 3.9) {
    const k = Math.sin(clamp01((t - 3.6) / 0.3) * Math.PI);
    g.fillStyle = `rgba(255,255,255,${k})`;
    g.fillRect(0, 0, w, h);
    return;
  }

  if (t < 6.5) {
    const p = inOut((t - 4.0) / 0.9);
    const baseY = h * 0.82;
    const money = outCubic((t - 4.0) / 2.1);

    const stacks = [
      { x: 0.58, n: 4 + Math.floor(6 * clamp01((t - 4.3) / 1.2)) },
      { x: 0.72, n: 3 + Math.floor(8 * clamp01((t - 4.8) / 1.2)) },
      { x: 0.86, n: 2 + Math.floor(11 * clamp01((t - 5.2) / 1.1)) },
    ];
    for (const s of stacks) stack(g, w * s.x, baseY, s.n, w * 0.075);

    for (let i = 0; i < 4; i++) {
      const start = 4.2 + i * 0.45;
      const k = clamp01((t - start) / 0.7);
      if (k <= 0 || k >= 1) continue;
      const x = w * (0.56 + ((i * 37) % 28) / 100);
      const y = h * (0.36 + k * 0.46);
      for (let j = 0; j < 3; j++) coin(g, x, y - j * h * 0.012, w * 0.07, 0.3, 0.5 - j * 0.13);
    }

    const size = Math.round(h * 0.085);
    ctx.drawText('money', {
      x: w * 0.1, y: h * 0.16 - (1 - p) * h * 0.02, w: w * 0.8, size, weight: 600,
      align: 'center', color: ctx.color('fg'), alpha: p,
    });
    ctx.drawText('moneyUnit', {
      x: w * 0.1, y: h * 0.16 + size * 1.02, w: w * 0.8, size: Math.round(h * 0.03), weight: 400,
      align: 'center', color: ctx.color('muted'), alpha: p,
    });

    g.fillStyle = ctx.color('fg');
    g.font = `500 ${Math.round(h * 0.028)}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'right';
    g.fillText(`$${Math.round(52000000 * money).toLocaleString('en-US')}`, w * 0.92, h * 0.34);
    g.textAlign = 'left';

    const vig = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.3, w * 0.5, h * 0.5, h * 0.78);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
    return;
  }

  if (t < 9.4) {
    const spin = inOut((t - 6.5) / 2.2);
    const winner = 3;
    const turns = 2.4;
    const settle = -Math.PI / 2 - ((winner + 0.5) / 12) * Math.PI * 2;
    const angle = settle - Math.PI * 2 * turns * (1 - spin);
    const cx = w * 0.5;
    const cy = h * 0.44;
    const r = w * 0.42;

    for (let i = 0; i < 5; i++) {
      const x = w * (0.14 + i * 0.18);
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.beginPath();
      g.arc(x, h * 0.86, w * 0.035, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.roundRect(x - w * 0.045, h * 0.895, w * 0.09, h * 0.08, w * 0.03);
      g.fill();
    }

    const glow = g.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.6);
    glow.addColorStop(0, 'rgba(255,255,255,0.1)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);

    wheel(g, cx, cy, r, angle, winner);

    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.moveTo(cx - r * 0.04, cy - r * 1.1);
    g.lineTo(cx + r * 0.04, cy - r * 1.1);
    g.lineTo(cx, cy - r * 0.94);
    g.closePath();
    g.fill();

    if (t > 8.7) {
      const k = outCubic((t - 8.7) / 0.5);
      const at = angle + ((winner + 0.5) / 12) * Math.PI * 2;
      const px = cx + Math.cos(at) * r * 0.6;
      const py = cy + Math.sin(at) * r * 0.6;
      g.save();
      g.strokeStyle = `rgba(255,255,255,${k})`;
      g.lineWidth = r * 0.05;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(px - r * 0.07, py);
      g.lineTo(px - r * 0.02, py + r * 0.05);
      g.lineTo(px + r * 0.08, py - r * 0.06);
      g.stroke();
      g.restore();
    }

    const vig = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 2.2);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
    return;
  }

  const p = outCubic((t - 9.5) / 0.9);
  const arc = g.createRadialGradient(w * 0.8, h * 0.5, 0, w * 0.8, h * 0.5, h * 0.45);
  arc.addColorStop(0, 'rgba(255,255,255,0.18)');
  arc.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = arc;
  g.fillRect(0, 0, w, h);

  ctx.drawText('kicker', {
    x: w * 0.12, y: h * 0.46, w: w * 0.76, size: Math.round(h * 0.042), weight: 700,
    color: ctx.color('fg'), alpha: p,
  });

  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = Math.max(1, w * 0.004);
  g.beginPath();
  g.arc(w * 0.46, h * 0.5, h * 0.26, -0.35, -0.35 + 1.5 * p);
  g.stroke();
}
