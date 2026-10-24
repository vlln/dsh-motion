// A monochrome beat: glowing view-cards floating in the dark, counters ticking,
// then one number owns the frame and the film cuts to type. Everything is drawn;
// the only "material" is gradient, glow and blur.
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
const inOut = (v) => {
  const x = clamp01(v);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

function cardFace(g, w, h, label) {
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1b1b1b');
  grad.addColorStop(0.55, '#0f0f0f');
  grad.addColorStop(1, '#1f1f1f');
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(0, 0, w, h, w * 0.1);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = Math.max(1, w * 0.008);
  g.stroke();
  // the "thumbnail" block and the count
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.beginPath();
  g.roundRect(w * 0.12, h * 0.12, w * 0.76, h * 0.5, w * 0.05);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.72)';
  g.font = `500 ${h * 0.075}px ${'-apple-system, system-ui, sans-serif'}`;
  g.fillText(label, w * 0.12, h * 0.78);
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.font = `400 ${h * 0.05}px ${'-apple-system, system-ui, sans-serif'}`;
  g.fillText('Views', w * 0.12, h * 0.86);
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, w, h);

  // The film is two shots: cards in the dark, then type on black.
  const toType = t > 3.9;

  if (!toType) {
    // Depth: a dim pool of light behind the cards.
    const pool = g.createRadialGradient(w * 0.5, h * 0.46, 0, w * 0.5, h * 0.46, w * 0.85);
    pool.addColorStop(0, 'rgba(255,255,255,0.07)');
    pool.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = pool;
    g.fillRect(0, 0, w, h);

    const enter = inOut(t / 1.1);
    const drift = t * 0.012;

    const cards = [
      { x: 0.52, y: 0.44, s: 0.22, v: 518797, dim: 0.45 },
      { x: 0.3, y: 0.62, s: 0.32, v: 21204, dim: 0.8 },
      { x: 0.62, y: 0.72, s: 0.4, v: 9864421, dim: 1 },
    ];
    for (const c of cards) {
      const cw = w * c.s;
      const ch = cw * 1.55;
      const x = w * c.x - cw / 2;
      const y = h * c.y - ch / 2 - (1 - enter) * h * 0.12 - drift * h * 0.4;
      g.save();
      g.globalAlpha = c.dim * enter;
      g.shadowColor = 'rgba(255,255,255,0.35)';
      g.shadowBlur = w * 0.12;
      g.translate(x, y);
      cardFace(g, cw, ch, String(Math.round(c.v * outCubic((t - 0.2) / 1.4))));
      g.restore();
    }

    // The headline number.
    const count = 2000000 * outCubic((t - 0.5) / 1.6);
    const size = Math.round(h * 0.078);
    g.save();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.textAlign = 'center';
    ctx.drawText('big', {
      x: w * 0.12,
      y: h * 0.155,
      w: w * 0.76,
      size,
      weight: 600,
      align: 'center',
      color: ctx.color('fg'),
      alpha: enter,
    });
    ctx.drawText('unit', {
      x: w * 0.12,
      y: h * 0.155 + size * 1.02,
      w: w * 0.76,
      size: Math.round(h * 0.032),
      weight: 400,
      align: 'center',
      color: ctx.color('muted'),
      alpha: enter,
    });
    g.restore();

    // Vignette: the frame is lit from the middle.
    const vig = g.createRadialGradient(w * 0.5, h * 0.5, h * 0.25, w * 0.5, h * 0.5, h * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.75)');
    g.fillStyle = vig;
    g.fillRect(0, 0, w, h);
    return;
  }

  // Shot two: type, with one arc of light. A white beat covers the cut.
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
