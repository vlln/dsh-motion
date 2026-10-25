// SAMPLE — not engine API. Delete this file and the engine is unaffected.
//
// Opt-in finishing. Nothing calls this unless a scene does: a film whose own
// surface is the point (flat colour, pixel art, a wall painting) must NOT be
// graded, or the palette turns to mud and the edges go soft. That is why this
// lives here and not on the render path.

import { rng } from './brush.mjs';

/**
 * Halation, vignette, grain, warm/cool split. Everything is a pure function of
 * (t, w, h) and a seed; call it last, once per frame.
 */
export function grade(g, w, h, t, { halation = 0.16, vignette = 0.26, grain = 0.05, split = 0.06, seed = 7 } = {}) {
  g.save();

  if (halation > 0) {
    // Light bleeds out of the highlights: screen a blurred copy of them.
    const glow = document.createElement('canvas');
    glow.width = Math.max(1, w >> 2);
    glow.height = Math.max(1, h >> 2);
    const gg = glow.getContext('2d');
    gg.drawImage(g.canvas, 0, 0, glow.width, glow.height);
    g.globalCompositeOperation = 'screen';
    g.globalAlpha = halation;
    g.filter = 'blur(6px)';
    g.drawImage(glow, 0, 0, w, h);
    g.filter = 'none';
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  if (split > 0) {
    // Shadows a touch cold, highlights a touch warm — the cheapest way to stop
    // a picture reading as a diagram.
    const grad = g.createLinearGradient(0, 0, w * 0.6, h);
    grad.addColorStop(0, `rgba(40,60,110,${split})`);
    grad.addColorStop(0.55, 'rgba(0,0,0,0)');
    grad.addColorStop(1, `rgba(140,90,40,${split})`);
    g.globalCompositeOperation = 'overlay';
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  }

  if (vignette > 0) {
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, `rgba(0,0,0,${vignette})`);
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
  }

  if (grain > 0) {
    // Three tiles built once, then tiled with an offset that moves with t, so
    // the grain crawls instead of freezing.
    const rand = rng(seed);
    const tile = document.createElement('canvas');
    tile.width = 96;
    tile.height = 96;
    const tg = tile.getContext('2d');
    const img = tg.createImageData(96, 96);
    for (let i = 0; i < 96 * 96; i++) {
      const v = 128 + (rand() - 0.5) * 255;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    tg.putImageData(img, 0, 0);
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = grain;
    const off = Math.floor(t * 24) % 96;
    for (let y = -96; y < h + 96; y += 96) for (let x = -96; x < w + 96; x += 96) g.drawImage(tile, x + off, y);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  g.restore();
  return g.canvas;
}
