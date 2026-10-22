// A fixture scene for the text primitive: long Chinese + mixed Latin, no
// hitTest of its own — everything the panel needs comes from ctx.drawText.

export const id = 'text-lab';
export const kind = 'canvas2d';
export const slots = {
  title: { default: '把方法公开，因为我们需要让更多人看懂这套流程', role: 'title', maxChars: 60 },
  body: {
    default:
      'Every primitive must draw, hit-test, expose what is editable, and survive export. 这条规则同样适用于文字。',
    role: 'body',
    maxChars: 200,
  },
};
export const textUsage = { title: 1, body: 1 };

let ctx;
export function mount(context) {
  ctx = context;
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  g.fillStyle = ctx.color('bg');
  g.fillRect(0, 0, ctx.width, ctx.height);

  ctx.drawText('title', {
    x: ctx.width * 0.08,
    y: ctx.height * 0.16,
    w: ctx.width * 0.6,
    size: Math.round(ctx.height * 0.075),
    weight: 700,
    lineHeight: 1.25,
  });

  ctx.drawText('body', {
    x: ctx.width * 0.08,
    y: ctx.height * 0.56,
    w: ctx.width * 0.5,
    size: Math.round(ctx.height * 0.026),
    lineHeight: 1.5,
    maxLines: 3,
  });

  void t;
}
