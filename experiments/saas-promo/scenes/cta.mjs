// 12–16s: the ask. Title, price, one button, one line of small print.
export const id = 'cta';
export const kind = 'canvas2d';
export const slots = {
  title: { default: 'Kindle Scribe', role: 'title', maxChars: 32 },
  price: { default: '$339', role: 'data', maxChars: 12 },
  button: { default: 'Pre-order', role: 'label', maxChars: 24 },
  fine: { default: 'Includes Premium Pen · ships 12 May', role: 'caption', maxChars: 60 },
};
export const textUsage = { title: 1, price: 1, button: 1, fine: 1 };

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

  const glow = g.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, w * 0.6);
  glow.addColorStop(0, 'rgba(217, 164, 65, 0.16)');
  glow.addColorStop(1, 'rgba(217, 164, 65, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, h);

  const p = outCubic((t - 0.2) / 0.9);
  ctx.drawText('title', {
    x: w * 0.1,
    y: h * 0.28 - (1 - p) * h * 0.02,
    w: w * 0.8,
    size: Math.round(h * 0.1),
    weight: 600,
    color: ctx.color('fg'),
    alpha: p,
  });

  ctx.drawText('price', {
    x: w * 0.1,
    y: h * 0.47,
    w: w * 0.4,
    size: Math.round(h * 0.062),
    weight: 500,
    color: ctx.color('accent'),
    alpha: outCubic((t - 0.5) / 0.8),
  });

  // Button: drawn, so it can breathe with the film.
  const bp = outCubic((t - 0.9) / 0.7);
  if (bp > 0) {
    const bw = w * 0.26;
    const bh = h * 0.1;
    const bx = w * 0.1;
    const by = h * 0.62 + (1 - bp) * h * 0.04;
    const pulse = 1 + Math.sin((t - 0.9) * 2.4) * 0.012 * bp;
    g.save();
    g.globalAlpha = bp;
    g.translate(bx + bw / 2, by + bh / 2);
    g.scale(pulse, pulse);
    g.fillStyle = ctx.color('fg');
    g.beginPath();
    g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    g.fill();
    ctx.drawText('button', {
      x: -bw / 2 + bw * 0.16,
      y: -bh * 0.16,
      w: bw * 0.6,
      size: Math.round(h * 0.03),
      weight: 600,
      color: ctx.color('bg'),
      align: 'center',
    });
    g.restore();
  }

  ctx.drawText('fine', {
    x: w * 0.1,
    y: h * 0.8,
    w: w * 0.6,
    size: Math.round(h * 0.022),
    weight: 400,
    color: ctx.color('muted'),
    alpha: outCubic((t - 1.3) / 0.8),
  });
}
