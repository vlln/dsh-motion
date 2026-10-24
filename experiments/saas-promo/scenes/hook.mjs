// 00–04s: one line, typed onto a dark page, then a hairline under it.
export const id = 'hook';
export const kind = 'canvas2d';
export const slots = {
  title: { default: 'Write it down.', role: 'title', maxChars: 32 },
  sub: { default: 'Kindle Scribe', role: 'caption', maxChars: 32 },
};
export const textUsage = { title: 1, sub: 1 };

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
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, w, h);

  // A typed line: clip grows across the text, so the kernel still owns layout.
  const typed = outCubic((t - 0.25) / 1.5);
  g.save();
  g.beginPath();
  g.rect(0, 0, w * typed, h);
  g.clip();
  ctx.drawText('title', {
    x: w * 0.08,
    y: h * 0.36,
    w: w * 0.7,
    size: Math.round(h * 0.11),
    weight: 600,
    lineHeight: 1.1,
    color: ctx.color('fg'),
  });
  g.restore();

  // Caret, alive while typing and gone after.
  if (typed > 0.02 && typed < 0.995) {
    g.fillStyle = ctx.color('accent');
    g.fillRect(w * 0.08 + w * 0.7 * typed * 0.55, h * 0.3, Math.max(2, w * 0.004), h * 0.13);
  }

  const sub = outCubic((t - 1.4) / 0.8);
  if (sub > 0) {
    g.save();
    g.globalAlpha = sub;
    ctx.drawText('sub', {
      x: w * 0.08,
      y: h * 0.56 + (1 - sub) * h * 0.02,
      w: w * 0.4,
      size: Math.round(h * 0.028),
      weight: 500,
      color: ctx.color('muted'),
    });
    g.restore();
  }

  const rule = clamp01((t - 1.8) / 1.2);
  g.strokeStyle = ctx.color('accent');
  g.lineWidth = Math.max(1, h * 0.003);
  g.beginPath();
  g.moveTo(w * 0.08, h * 0.64);
  g.lineTo(w * 0.08 + w * 0.3 * rule, h * 0.64);
  g.stroke();
}
