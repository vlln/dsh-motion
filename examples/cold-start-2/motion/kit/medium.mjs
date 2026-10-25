// SAMPLE — not engine API. Delete this file and the engine is unaffected.
//
// Two material channels, as opposed to "a vector drawing with noise on top".
// A channel takes the shape layer and puts the picture THROUGH a physical
// process: pigment into plaster, brush onto canvas. Write your own the same
// way — shape layer first, then one pass that behaves like a material.
//
// A style that needs a third channel should get a third function here in the
// project, not a new engine verb.

import { clamp, rng, strokes } from './brush.mjs';

/** Paint over the shape layer: the picture is rebuilt out of marks, warm in the light and cool in the shadow. */
export function broken(base, { cell = 10, len = 20, width = 6, angle = 0, seed = 1, t = 0, boil = 0, warmth = 26, palette } = {}) {
  return strokes(base, {
    cell,
    len,
    width,
    seed,
    t,
    boil,
    angle,
    palette:
      palette ??
      ((x, y, [r, g, b]) => {
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const warm = (luma / 255 - 0.5) * warmth;
        return [clamp(r + warm), clamp(g + warm * 0.25), clamp(b - warm * 0.7)];
      }),
  });
}

/**
 * Wet plaster: the pigment is eaten by the lime.
 *
 * Three layers, all cheap and all measurable: mottled plaster under the
 * picture, a multiply pass that pulls the colour into the wall, and pinholes
 * plus one seam, which is what a photograph of a fresco actually shows.
 */
export function fresco(w, h, { seed = 3, mottle = 18, stains = 5, pinholes = 900, seam = true } = {}) {
  const under = document.createElement('canvas');
  under.width = w;
  under.height = h;
  const u = under.getContext('2d');
  u.fillStyle = '#efe6d2';
  u.fillRect(0, 0, w, h);

  const rand = rng(seed);
  // Lime mottle: overlapping soft discs, never a flat fill.
  for (let i = 0; i < 260; i++) {
    const r = 20 + rand() * 120;
    const g = u.createRadialGradient(rand() * w, rand() * h, 0, rand() * w, rand() * h, r);
    const v = 235 + rand() * mottle;
    g.addColorStop(0, `rgba(${v},${v - 6},${v - 22},0.22)`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    u.fillStyle = g;
    u.fillRect(0, 0, w, h);
  }
  // Age stains, mostly low and at the edges.
  for (let i = 0; i < stains; i++) {
    const x = rand() * w;
    const y = h * (0.5 + rand() * 0.55);
    const r = 60 + rand() * 180;
    const g = u.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(120,96,64,0.10)');
    g.addColorStop(1, 'rgba(120,96,64,0)');
    u.fillStyle = g;
    u.fillRect(0, 0, w, h);
  }

  /** Multiply the shape layer onto the wall and take the light out of it. */
  const apply = (shape) => {
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const g = out.getContext('2d');
    g.drawImage(under, 0, 0);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.92;
    g.drawImage(shape, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    // Pinholes: plaster losses, small and darker than the wall.
    const rand2 = rng(seed + 11);
    g.fillStyle = 'rgba(120,104,80,0.35)';
    for (let i = 0; i < pinholes; i++) {
      const r = 0.4 + rand2() * 1.6;
      g.beginPath();
      g.arc(rand2() * w, rand2() * h, r, 0, Math.PI * 2);
      g.fill();
    }
    if (seam) {
      const x = w * (0.3 + rand2() * 0.4);
      g.strokeStyle = 'rgba(96,80,58,0.35)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(x, 0);
      for (let y = 0; y <= h; y += 40) g.lineTo(x + Math.sin(y * 0.01) * 6, y);
      g.stroke();
    }
    return out;
  };

  return { under, apply };
}
