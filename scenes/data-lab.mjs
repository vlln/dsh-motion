// Fixture scene for data slots: the numbers are content, not layout, and the
// bars are derived from them — a chart without a chart library.

export const id = 'data-lab';
export const kind = 'canvas2d';
export const slots = {
  heading: { default: '数据槽：数字也是内容', role: 'title', maxChars: 40 },
};
export const textUsage = { heading: 1 };
export const values = {
  speed: { default: 21, min: 0, max: 200, step: 1, label: '速度', format: 'int', suffix: ' km/h' },
  growth: { default: 0.42, min: 0, max: 1, step: 0.01, label: '增长', format: 'percent' },
};

let ctx;
export function mount(context) {
  ctx = context;
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, ctx.width, ctx.height);

  ctx.drawText('heading', { x: 160, y: 120, w: 1600, size: 56, weight: 700 });

  ctx.drawValue('speed', { x: 160, y: 260, w: 900, size: 120, weight: 700, color: ctx.color('accent') });
  ctx.drawValue('growth', { x: 160, y: 430, w: 700, size: 72, weight: 600, color: ctx.color('muted') });
  ctx.drawValue('speed', { x: 160, y: 620, w: 900, size: 40, weight: 400 }); // same slot, second place

  const bar = (y, ratio, color) => {
    g.fillStyle = color;
    g.globalAlpha = 0.25;
    g.fillRect(160, y, 1400, 44);
    g.globalAlpha = 1;
    g.fillRect(160, y, Math.max(2, 1400 * Math.min(1, Math.max(0, ratio))), 44);
  };
  bar(720, ctx.value('speed') / 200, ctx.color('accent'));
  bar(800, ctx.value('growth'), ctx.color('fg'));

  void t;
}
