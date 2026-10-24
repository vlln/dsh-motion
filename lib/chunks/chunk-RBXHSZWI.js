import {
  SAMPLES,
  finish
} from "./chunk-EQH5C3H5.js";

// src/scenes/from-sample.mjs
function makeSampleScene(id) {
  const sample = SAMPLES.find((s) => s.id === id);
  if (!sample) throw new Error(`no sample "${id}"`);
  let ctx = null;
  return {
    id,
    kind: "canvas2d",
    slots: {},
    textUsage: {},
    mount(context) {
      ctx = context;
    },
    render(t) {
      const g = ctx.canvas.getContext("2d");
      const loop = (t + 0.8) % 6;
      g.clearRect(0, 0, ctx.width, ctx.height);
      sample.draw(g, ctx.width, ctx.height, loop);
      finish(g, ctx.width, ctx.height, loop, sample.look);
    }
  };
}

export {
  makeSampleScene
};
