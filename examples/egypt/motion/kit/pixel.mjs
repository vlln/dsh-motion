// SAMPLE — not engine API. Delete this file and the engine is unaffected.
//
// The pixel kit. A closed-palette grid language is a *construction*, not a
// filter: you cannot get it by drawing smooth shapes and adding grain. Draw on
// the grid, snap every coordinate, quantise the colour, then outline by hand.
//
// The numbers below are the ones from a real 8-bit film: 240×135 at 8×, a
// ~30-colour palette, alpha cut at 110 to kill anti-aliasing, and a 1px black
// outline around each part (not around the whole figure — parts need their own
// inner contour or hair, face and arm melt together).

export function raster({ w = 240, h = 135, scale = 8 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;

  /** Whole pixels only. A half pixel is the whole difference. */
  const px = (x, y, rw = 1, rh = 1, color) => {
    g.fillStyle = color;
    g.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh));
  };

  /** Tiles of a motif: bricks, clouds, a wall pattern. Never a gradient. */
  const tile = (cell, fn) => {
    for (let y = 0, j = 0; y < h; y += cell, j++) {
      for (let x = -cell + ((j % 2) * cell) / 2, i = 0; x < w + cell; x += cell, i++) fn(x, y, i, j);
    }
  };

  /** Two-colour checkerboard where two flat colours meet — the only gradient an 8-bit palette has. */
  const dither = (x0, y0, rw, rh, a, b, phase = 0) => {
    for (let y = y0; y < y0 + rh; y++) {
      for (let x = x0; x < x0 + rw; x++) px(x, y, 1, 1, (x + y + phase) % 2 ? b : a);
    }
  };

  /**
   * Quantise a layer that was drawn with smooth paths: cut the alpha, snap each
   * pixel to the palette, then draw the 1px outline into the transparent ring.
   * This is how a rigged character survives being taken down to 240×135.
   */
  const quantise = (palette, { alphaCut = 110, outline = '#000000' } = {}) => {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const solid = new Uint8Array(w * h);
    const rgb = palette.map((hex) => {
      const n = parseInt(hex.replace('#', ''), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    });
    for (let i = 0; i < w * h; i++) {
      if (d[i * 4 + 3] < alphaCut) {
        d[i * 4 + 3] = 0;
        continue;
      }
      const r = d[i * 4];
      const gg = d[i * 4 + 1];
      const b = d[i * 4 + 2];
      let best = 0;
      let dist = Infinity;
      for (let k = 0; k < rgb.length; k++) {
        const [pr, pg, pb] = rgb[k];
        const dd = (r - pr) ** 2 + (gg - pg) ** 2 + (b - pb) ** 2;
        if (dd < dist) {
          dist = dd;
          best = k;
        }
      }
      d[i * 4] = rgb[best][0];
      d[i * 4 + 1] = rgb[best][1];
      d[i * 4 + 2] = rgb[best][2];
      d[i * 4 + 3] = 255;
      solid[i] = 1;
    }
    if (outline !== null) {
      const n = parseInt(outline.replace('#', ''), 16);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (solid[i]) continue;
          const edge =
            (x > 0 && solid[i - 1]) ||
            (x < w - 1 && solid[i + 1]) ||
            (y > 0 && solid[i - w]) ||
            (y < h - 1 && solid[i + w]);
          if (!edge) continue;
          d[i * 4] = (n >> 16) & 255;
          d[i * 4 + 1] = (n >> 8) & 255;
          d[i * 4 + 2] = n & 255;
          d[i * 4 + 3] = 255;
        }
      }
    }
    g.putImageData(img, 0, 0);
  };

  /** Blit to the film at integer scale, smoothing off. */
  const upscale = (dest, dx = 0, dy = 0, dw = w * scale, dh = h * scale) => {
    dest.imageSmoothingEnabled = false;
    dest.drawImage(canvas, 0, 0, w, h, dx, dy, dw, dh);
    dest.imageSmoothingEnabled = true;
  };

  return { canvas, g, w, h, scale, px, tile, dither, quantise, upscale };
}
