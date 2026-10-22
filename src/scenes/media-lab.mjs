// Fixture scene for the media primitives: one clip (sprite sheet) and one image,
// both preloaded by the kernel before mount().

export const id = 'media-lab';
export const kind = 'canvas2d';
export const assets = ['clipA', 'plate'];
export const slots = {
  caption: { default: '实拍片段与静态图，同一条时间轴上', role: 'caption', maxChars: 60 },
};
export const textUsage = { caption: 1 };

let ctx;
export function mount(context) {
  ctx = context;
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, ctx.width, ctx.height);

  ctx.frame('clipA', t, { x: 120, y: 140, w: 900, h: 506, fit: 'cover' });
  ctx.image('plate', { x: 1140, y: 140, w: 560, h: 420, fit: 'contain' });
  ctx.drawText('caption', { x: 120, y: 760, w: 1500, size: 44, weight: 600 });
}
