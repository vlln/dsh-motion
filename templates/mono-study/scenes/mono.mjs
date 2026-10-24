// A monochrome beat: view-cards turning in space, counters ticking, then type.
//
// The cards are real boxes: eight vertices, rotated around Y (and tipped around
// X), projected with a perspective divide, shaded by face normal, painted back
// to front. The face texture is a canvas, mapped onto the projected quad with an
// affine transform — at these angles that reads as a turning slab, not a sticker.
// Whatever "material" there is, is gradient, glow and a rim light.

export const id = 'mono';
export const kind = 'canvas2d';
export const slots = {
  big: { default: '2 million+', role: 'title', maxChars: 24 },
  unit: { default: 'Views', role: 'caption', maxChars: 16 },
  kicker: { default: 'CREATE TO EARN', role: 'label', maxChars: 40 },
};
export const textUsage = { big: 1, unit: 1, kicker: 1 };

let ctx;
export function mount(context) {
  ctx = context;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const outCubic = (v) => 1 - (1 - clamp01(v)) ** 3;

/* ---- a small 3D box renderer ------------------------------------------- */

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
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  return [x1, y2, z2];
}

const FACES = [
  { n: [0, 0, 1], idx: [4, 5, 6, 7], shade: 1.0, face: true }, // front
  { n: [0, 0, -1], idx: [1, 0, 3, 2], shade: 0.9 }, // back
  { n: [1, 0, 0], idx: [5, 1, 2, 6], shade: 0.8 }, // right
  { n: [-1, 0, 0], idx: [0, 4, 7, 3], shade: 0.7 }, // left
  { n: [0, -1, 0], idx: [0, 1, 5, 4], shade: 0.85 }, // top (screen-up)
  { n: [0, 1, 0], idx: [3, 7, 6, 2], shade: 0.6 }, // bottom
];

function box(w, h, d) {
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  return [
    [-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z],
    [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z],
  ];
}

function shadeOf(normal, ry, rx) {
  const n = rotate(normal, ry, rx);
  const lambert = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  return 0.35 + 0.65 * lambert;
}

/**
 * A card texture: dark slab, a screen block, a counter and a label.
 * Kept small (256×400) because it is redrawn while the number moves.
 */
function cardTexture(w, h, label, count) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 400;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 400);
  grad.addColorStop(0, '#3a3a3a');
  grad.addColorStop(0.5, '#171717');
  grad.addColorStop(1, '#2e2e2e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 400);
  const screen = g.createLinearGradient(0, 60, 0, 220);
  screen.addColorStop(0, '#5a5a5a');
  screen.addColorStop(1, '#262626');
  g.fillStyle = screen;
  g.beginPath();
  g.roundRect(28, 56, 200, 150, 14);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.font = '500 42px -apple-system, system-ui, sans-serif';
  g.fillText(String(count), 28, 300);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.font = '400 22px -apple-system, system-ui, sans-serif';
  g.fillText(label, 28, 332);
  return cv;
}

/**
 * Draw one slab. Returns nothing; everything is painted into g.
 * cx/cy is the card's centre in screen space, `size` its width in px.
 */
function drawCard(g, cx, cy, size, t, card) {
  const w = size;
  const h = size * 1.55;
  const d = Math.max(6, size * 0.09);
  // A turntable, not a full spin: the face stays readable while it turns.
  const ry = card.base + Math.sin(t * card.spin + card.phase) * 0.95;
  const rx = -0.14 + Math.sin(t * 0.4 + card.phase) * 0.04;

  const f = Math.max(w, h) * 2.4;
  const camZ = 1400;
  const verts = box(w, h, d).map((p) => rotate(p, ry, rx));
  const proj = verts.map(([x, y, z]) => {
    const s = f / (z + camZ);
    return [cx + x * s, cy + y * s, z];
  });

  const count = Math.round(card.value * outCubic((t - card.delay) / 1.2));
  const texture = cardTexture(w, h, 'Views', count);

  // Back faces first, front last, decided by each face's mean depth.
  const order = FACES.map((face) => ({
    face,
    depth: face.idx.reduce((sum, i) => sum + proj[i][2], 0) / 4,
    normalZ: rotate(face.n, ry, rx)[2],
  })).sort((a, b) => a.depth - b.depth);

  for (const item of order) {
    const { face } = item;
    const pts = face.idx.map((i) => proj[i]);
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath();

    const shade = shadeOf(face.n, ry, rx) * face.shade;
    const lit = Math.round(30 + shade * 46);
    g.fillStyle = `rgb(${lit},${lit},${lit})`;
    g.fill();

    if (face.face && item.normalZ > 0.02) {
      // Map the texture onto the front quad (affine from three corners).
      const [p0, p1, , p3] = pts;
      g.save();
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.closePath();
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

    // Rim: the edge catches the light.
    g.strokeStyle = `rgba(255,255,255,${0.12 + shade * 0.3})`;
    g.lineWidth = 1.2;
    g.stroke();
  }
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, w, h);

  const toType = t > 3.9;

  if (!toType) {
    const pool = g.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.9);
    pool.addColorStop(0, 'rgba(255,255,255,0.06)');
    pool.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = pool;
    g.fillRect(0, 0, w, h);

    const enter = outCubic(t / 1.2);
    const cards = [
      { x: 0.25, y: 0.4, s: 0.32, value: 15038, base: -0.45, phase: 0.2, spin: 1.15, delay: 0.2, glow: 1 },
      { x: 0.75, y: 0.33, s: 0.2, value: 518797, base: 0.5, phase: 1.4, spin: 0.9, delay: 0.35, glow: 0.7 },
      { x: 0.32, y: 0.74, s: 0.17, value: 21204, base: -0.3, phase: 2.6, spin: 1.0, delay: 0.5, glow: 0.6 },
      { x: 0.71, y: 0.76, s: 0.36, value: 9864421, base: 0.4, phase: 3.4, spin: 0.8, delay: 0.15, glow: 1 },
    ];
    for (const card of cards) {
      g.save();
      g.globalAlpha = enter;
      g.shadowColor = `rgba(255,255,255,${0.25 * card.glow})`;
      g.shadowBlur = w * 0.18;
      drawCard(g, w * card.x, h * card.y + (1 - enter) * h * 0.06, w * card.s, t, card);
      g.restore();
    }

    const count = 2000000 * outCubic((t - 0.5) / 1.6);
    const size = Math.round(h * 0.078);
    ctx.drawText('big', {
      x: w * 0.1,
      y: h * 0.1,
      w: w * 0.8,
      size,
      weight: 600,
      align: 'center',
      color: ctx.color('fg'),
      alpha: enter,
    });
    ctx.drawText('unit', {
      x: w * 0.1,
      y: h * 0.1 + size * 1.02,
      w: w * 0.8,
      size: Math.round(h * 0.032),
      weight: 400,
      align: 'center',
      color: ctx.color('muted'),
      alpha: enter,
    });
    void count;

    const vig = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.25, w * 0.5, h * 0.5, h * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.78)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
    return;
  }

  const flash = t < 4.12 ? Math.sin(clamp01((t - 3.9) / 0.22) * Math.PI) : 0;
  const p = outCubic((t - 4.0) / 0.9);
  const arc = g.createRadialGradient(w * 0.78, h * 0.5, 0, w * 0.78, h * 0.5, h * 0.42);
  arc.addColorStop(0, 'rgba(255,255,255,0.16)');
  arc.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = arc;
  g.fillRect(0, 0, w, h);

  ctx.drawText('kicker', {
    x: w * 0.14,
    y: h * 0.44,
    w: w * 0.72,
    size: Math.round(h * 0.05),
    weight: 700,
    color: ctx.color('fg'),
    alpha: p,
  });

  g.strokeStyle = 'rgba(255,255,255,0.45)';
  g.lineWidth = Math.max(1, w * 0.004);
  g.beginPath();
  g.arc(w * 0.46, h * 0.5, h * 0.26, -0.35, -0.35 + 1.5 * p);
  g.stroke();

  if (flash > 0) {
    g.fillStyle = `rgba(255,255,255,${flash})`;
    g.fillRect(0, 0, w, h);
  }
}
