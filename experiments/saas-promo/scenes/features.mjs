// 08–12s: three cards slide in over a paper field, each with a drawn icon.
export const id = 'features';
export const kind = 'canvas2d';
export const slots = {
  a: { default: 'Write', role: 'label', maxChars: 24 },
  an: { default: 'Ink that keeps up', role: 'caption', maxChars: 40 },
  b: { default: 'Read', role: 'label', maxChars: 24 },
  bn: { default: 'Glare-free, 300 ppi', role: 'caption', maxChars: 40 },
  c: { default: 'Sync', role: 'label', maxChars: 24 },
  cn: { default: 'Every note, everywhere', role: 'caption', maxChars: 40 },
};
export const textUsage = { a: 1, an: 1, b: 1, bn: 1, c: 1, cn: 1 };

let ctx;
export function mount(context) {
  ctx = context;
}
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const outCubic = (v) => 1 - (1 - clamp01(v)) ** 3;

function icon(g, kind, x, y, size, color) {
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = Math.max(1.5, size * 0.09);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (kind === 'pen') {
    g.beginPath();
    g.moveTo(x + size * 0.2, y + size * 0.8);
    g.lineTo(x + size * 0.75, y + size * 0.2);
    g.stroke();
    g.beginPath();
    g.moveTo(x + size * 0.2, y + size * 0.8);
    g.lineTo(x + size * 0.12, y + size * 0.94);
    g.lineTo(x + size * 0.34, y + size * 0.88);
    g.closePath();
    g.fill();
  } else if (kind === 'book') {
    g.beginPath();
    g.moveTo(x + size * 0.5, y + size * 0.2);
    g.quadraticCurveTo(x + size * 0.25, y + size * 0.1, x + size * 0.1, y + size * 0.2);
    g.lineTo(x + size * 0.1, y + size * 0.82);
    g.quadraticCurveTo(x + size * 0.3, y + size * 0.72, x + size * 0.5, y + size * 0.82);
    g.stroke();
    g.beginPath();
    g.moveTo(x + size * 0.5, y + size * 0.2);
    g.quadraticCurveTo(x + size * 0.75, y + size * 0.1, x + size * 0.9, y + size * 0.2);
    g.lineTo(x + size * 0.9, y + size * 0.82);
    g.quadraticCurveTo(x + size * 0.7, y + size * 0.72, x + size * 0.5, y + size * 0.82);
    g.stroke();
  } else {
    // Cloud: three arcs on one baseline, then a soft underline.
    g.beginPath();
    g.arc(x + size * 0.34, y + size * 0.58, size * 0.15, Math.PI * 0.55, Math.PI * 1.55);
    g.arc(x + size * 0.5, y + size * 0.46, size * 0.2, Math.PI * 1.05, Math.PI * 1.95);
    g.arc(x + size * 0.66, y + size * 0.58, size * 0.14, Math.PI * 1.45, Math.PI * 0.55);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(x + size * 0.36, y + size * 0.9);
    g.lineTo(x + size * 0.62, y + size * 0.9);
    g.stroke();
  }
  g.restore();
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, w, h);

  // A faint grid keeps the paper from reading as an empty slide.
  g.strokeStyle = ctx.color('grid');
  g.globalAlpha = 0.5;
  g.lineWidth = 1;
  for (let x = w * 0.08; x < w * 0.92; x += w * 0.04) {
    g.beginPath();
    g.moveTo(x, h * 0.16);
    g.lineTo(x, h * 0.84);
    g.stroke();
  }
  g.globalAlpha = 1;

  const cards = [
    { x: 0.07, title: 'a', note: 'an', kind: 'pen' },
    { x: 0.37, title: 'b', note: 'bn', kind: 'book' },
    { x: 0.67, title: 'c', note: 'cn', kind: 'cloud' },
  ];
  const cw = w * 0.26;
  const ch = h * 0.52;
  cards.forEach((card, i) => {
    const p = outCubic((t - 0.25 - i * 0.2) / 0.7);
    if (p <= 0) return;
    const x = w * card.x;
    const y = h * 0.24 + (1 - p) * h * 0.12;
    g.save();
    g.globalAlpha = Math.min(1, p * 1.4);
    g.shadowColor = 'rgba(60, 44, 28, 0.18)';
    g.shadowBlur = h * 0.04;
    g.shadowOffsetY = h * 0.012;
    g.fillStyle = ctx.color('panel');
    g.beginPath();
    g.roundRect(x, y, cw, ch, Math.min(16, w * 0.012));
    g.fill();
    g.shadowBlur = 0;
    g.shadowOffsetY = 0;
    g.strokeStyle = 'rgba(24, 21, 16, 0.1)';
    g.lineWidth = 1;
    g.stroke();

    icon(g, card.kind, x + cw * 0.1, y + ch * 0.12, Math.min(cw, ch) * 0.34, ctx.color('accent'));
    ctx.drawText(card.title, {
      x: x + cw * 0.1,
      y: y + ch * 0.56,
      w: cw * 0.8,
      size: Math.round(h * 0.038),
      weight: 600,
      color: ctx.color('fg'),
    });
    ctx.drawText(card.note, {
      x: x + cw * 0.1,
      y: y + ch * 0.72,
      w: cw * 0.8,
      size: Math.round(h * 0.022),
      weight: 400,
      color: ctx.color('muted'),
      maxLines: 2,
    });
    g.fillStyle = 'rgba(24, 21, 16, 0.1)';
    g.fillRect(x + cw * 0.1, y + ch * 0.9, cw * 0.8, Math.max(2, h * 0.006));
    g.fillStyle = ctx.color('accent');
    g.fillRect(x + cw * 0.1, y + ch * 0.9, cw * 0.8 * p, Math.max(2, h * 0.006));
    g.restore();
  });
}
