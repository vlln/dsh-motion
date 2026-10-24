// Built-in scenes that render one of the gallery's samples. The preview and the
// film share the same draw function, so what you pick is what you get.
import { SAMPLES } from '../starters.mjs';
import { finish } from '../look.mjs';

export function makeSampleScene(id) {
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) throw new Error(`no sample "${id}"`);
  let ctx = null;
  return {
    id,
    kind: 'canvas2d',
    slots: {},
    textUsage: {},
    mount(context) {
      ctx = context;
    },
    render(t) {
      const g = ctx.canvas.getContext('2d');
      const loop = (t + 0.8) % 6;
      g.clearRect(0, 0, ctx.width, ctx.height);
      // Start on content, not on the blank frame every entrance begins with:
      // a film created from a sample opens showing the sample.
      sample.draw(g, ctx.width, ctx.height, loop);
      finish(g, ctx.width, ctx.height, loop, sample.look);
    },
  };
}
