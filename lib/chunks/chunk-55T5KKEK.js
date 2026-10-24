import {
  SAMPLES
} from "./chunk-O6EKPI55.js";

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
      g.clearRect(0, 0, ctx.width, ctx.height);
      sample.draw(g, ctx.width, ctx.height, t % 6);
    }
  };
}

export {
  makeSampleScene
};
