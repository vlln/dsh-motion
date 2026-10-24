// 04–08s: the device itself, drawn — a tablet at a three-quarter angle with a
// page on it and a pen beside it. The camera pushes in; nothing else moves.
export const id = 'device';
export const kind = 'canvas2d';
export const slots = {
  spec: { default: '10.2 in · 300 ppi', role: 'caption', maxChars: 40 },
  note: { default: 'A page that feels like paper', role: 'subtitle', maxChars: 60 },
};
export const textUsage = { spec: 1, note: 1 };

let ctx;
export function mount(context) {
  ctx = context;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const outCubic = (v) => 1 - (1 - clamp01(v)) ** 3;

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  const bg = ctx.color('bg');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // Paper light: a soft warm falloff, no image needs to be loaded.
  const light = g.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, w * 0.7);
  light.addColorStop(0, 'rgba(255, 250, 238, 0.9)');
  light.addColorStop(1, 'rgba(255, 250, 238, 0)');
  g.fillStyle = light;
  g.fillRect(0, 0, w, h);

  const push = 1 + 0.035 * outCubic(t / 4);
  const bob = Math.sin(t * 0.5) * h * 0.004;
  g.save();
  g.translate(w * 0.5, h * 0.52 + bob);
  g.scale(push, push);
  g.rotate(-0.045);
  g.transform(1, 0.035, -0.12, 1, 0, 0);

  const dw = w * 0.46;
  const dh = h * 0.62;

  // Shadow first, then the slab.
  g.save();
  g.filter = `blur(${Math.max(6, w * 0.012)}px)`;
  g.fillStyle = 'rgba(70, 52, 34, 0.22)';
  g.beginPath();
  g.ellipse(0, dh * 0.56, dw * 0.52, dh * 0.06, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  g.fillStyle = '#26262a';
  g.beginPath();
  g.roundRect(-dw / 2, -dh / 2, dw, dh, Math.min(18, w * 0.014));
  g.fill();

  const inset = Math.min(dw, dh) * 0.035;
  g.fillStyle = '#fbf7ec';
  g.beginPath();
  g.roundRect(-dw / 2 + inset, -dh / 2 + inset, dw - inset * 2, dh - inset * 2, Math.min(10, w * 0.008));
  g.fill();

  // The page: a heading, ruled text, one hand-drawn stroke and a highlight.
  const px = -dw / 2 + inset * 2.2;
  const py = -dh / 2 + inset * 2.4;
  const pw = dw - inset * 4.4;
  g.fillStyle = 'rgba(24, 21, 16, 0.82)';
  g.fillRect(px, py, pw * 0.52, Math.max(2, h * 0.012));
  g.fillStyle = 'rgba(24, 21, 16, 0.28)';
  for (let i = 0; i < 11; i++) {
    g.fillRect(px, py + h * (0.05 + i * 0.042), pw * (i % 4 === 0 ? 0.62 : 0.9), Math.max(1, h * 0.006));
  }
  const drawP = clamp01((t - 0.9) / 1.6);
  g.save();
  g.strokeStyle = ctx.color('accent');
  g.lineWidth = Math.max(2, w * 0.004);
  g.lineCap = 'round';
  g.beginPath();
  const sx = px + pw * 0.16;
  const sy = py + h * 0.24;
  g.moveTo(sx, sy);
  const len = pw * 0.5 * drawP;
  for (let i = 1; i <= 20; i++) {
    const k = (i / 20) * len;
    g.lineTo(sx + k, sy + Math.sin(i * 0.9) * h * 0.012);
  }
  g.stroke();
  g.restore();

  // Stylus: a rounded barrel with a dark nib, resting along the right edge.
  g.save();
  g.translate(dw * 0.58, dh * 0.08);
  g.rotate(0.28);
  g.fillStyle = '#e6e0d4';
  g.beginPath();
  g.roundRect(0, 0, w * 0.013, dh * 0.4, w * 0.0065);
  g.fill();
  g.fillStyle = '#c9c2b5';
  g.fillRect(0, dh * 0.06, w * 0.013, dh * 0.02);
  g.fillStyle = '#3a3733';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(w * 0.0065, -dh * 0.03);
  g.lineTo(w * 0.013, 0);
  g.closePath();
  g.fill();
  g.restore();
  g.restore();

  const specP = outCubic((t - 0.5) / 0.8);
  ctx.drawText('spec', {
    x: w * 0.07,
    y: h * 0.86,
    w: w * 0.4,
    size: Math.round(h * 0.024),
    weight: 500,
    color: ctx.color('muted'),
    alpha: specP,
  });
  ctx.drawText('note', {
    x: w * 0.07,
    y: h * 0.14,
    w: w * 0.6,
    size: Math.round(h * 0.034),
    weight: 600,
    color: ctx.color('fg'),
    alpha: outCubic((t - 0.3) / 0.8),
  });
}
