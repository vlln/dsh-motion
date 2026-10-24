// Lime field, three words, each rising through its own mask. The template keeps
// the palette in timeline.json, so recolouring it is one edit.
export const id = 'kinetic';
export const kind = 'canvas2d';
export const slots = {
  a: { default: 'MAKE', role: 'title', maxChars: 12 },
  b: { default: 'IT', role: 'title', maxChars: 12 },
  c: { default: 'MOVE', role: 'title', maxChars: 12 },
  label: { default: '01 — KINETIC TYPE', role: 'label', maxChars: 32 },
};
export const textUsage = { a: 1, b: 1, c: 1, label: 1 };

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

  const pad = w * 0.08;
  ctx.drawText('label', {
    x: pad,
    y: h * 0.14,
    w: w * 0.8,
    size: Math.round(h * 0.018),
    weight: 500,
    color: ctx.color('muted'),
    alpha: outCubic((t - 0.15) / 0.6),
  });

  const size = Math.round(h * 0.13);
  const words = ['a', 'b', 'c'];
  const at = [0.35, 0.55, 0.75];
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  words.forEach((slot, i) => {
    const p = outCubic((t - 0.25 - i * 0.22) / 0.7);
    if (p <= 0) return;
    const text = ctx.text(slot);
    const y = h * at[i];
    g.save();
    // The mask and the text share one baseline: no per-glyph boxes involved.
    g.beginPath();
    g.rect(0, y - size * 1.05, w, size * 1.35);
    g.clip();
    g.fillStyle = ctx.color('fg');
    g.font = `700 ${size}px ${ctx.font('display')}`;
    g.letterSpacing = '-0.035em';
    g.fillText(text, pad, y + (1 - p) * size * 0.9);
    g.letterSpacing = '0em';
    g.restore();
  });

  const rule = outCubic((t - 1.4) / 0.9);
  if (rule > 0) {
    g.strokeStyle = ctx.color('fg');
    g.lineWidth = Math.max(1, h * 0.003);
    g.beginPath();
    g.moveTo(pad, h * 0.9);
    g.lineTo(pad + w * 0.32 * rule, h * 0.9);
    g.stroke();
  }
}
