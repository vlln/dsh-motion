// The starter scene every new film gets. It is deliberately plain: a
// background, a rule, a title and a subtitle, all from the palette. The agent
// replaces or rewrites this file — it lives in the film, not in this package.

export const id = 'blank';

export const slots = {
  title: { default: 'Untitled', role: 'title', maxChars: 80 },
  subtitle: { default: '', role: 'body', maxChars: 160 },
};

export const textUsage = { title: 1, subtitle: 1 };

let ctx;

export function mount(context) {
  ctx = context;
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, ctx.width, ctx.height);

  // A short entrance so the film never opens on a frozen frame.
  const ease = Math.min(1, Math.max(0, (t - 0.15) / 0.9));
  const lift = (1 - ease) * ctx.height * 0.02;

  const x = ctx.width * 0.08;
  const w = ctx.width * 0.62;

  g.save();
  g.globalAlpha = ease;
  g.translate(0, lift);

  ctx.drawText('title', {
    x,
    y: ctx.height * 0.38,
    w,
    size: Math.round(ctx.height * 0.09),
    weight: 700,
    lineHeight: 1.15,
  });

  g.fillStyle = ctx.color('accent');
  const ruleY = ctx.height * 0.56;
  g.fillRect(x, ruleY, Math.round(ctx.width * 0.06 * ease), Math.max(2, Math.round(ctx.height * 0.004)));

  ctx.drawText('subtitle', {
    x,
    y: ruleY + ctx.height * 0.07,
    w: w * 0.9,
    size: Math.round(ctx.height * 0.032),
    lineHeight: 1.5,
    maxLines: 2,
    color: ctx.color('muted'),
  });

  g.restore();
}
