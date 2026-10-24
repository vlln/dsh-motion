// The last pass every sample goes through before it is shown.
//
// A flat drawing reads as a diagram; the same drawing with a glow on its
// highlights, a vignette, moving grain and a slight warm/cool split reads as
// footage. None of it belongs inside a sample — it is the same for all of
// them, and a sample can opt out with `look.finish === false`.
//
// Everything here is a pure function of (t, w, h): no clock, no random().

const cache = new Map();

function scratch(key, w, h) {
  let c = cache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = Math.max(1, w);
    c.height = Math.max(1, h);
    cache.set(key, c);
  }
  return c;
}

/** Perceptual lightness of a look's background, 0..1. */
function luma(hex) {
  if (typeof hex !== 'string') return 0;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Three 96px grain tiles built once. Enough for a 6s loop — the eye reads it as
// film grain, not as a texture.
const GRAIN = 96;
let grainTiles = null;

function grain() {
  if (grainTiles) return grainTiles;
  grainTiles = [];
  for (let phase = 0; phase < 3; phase++) {
    const c = document.createElement('canvas');
    c.width = GRAIN;
    c.height = GRAIN;
    const g = c.getContext('2d');
    const img = g.createImageData(GRAIN, GRAIN);
    for (let i = 0; i < GRAIN * GRAIN; i++) {
      const n = Math.sin((i + phase * 977) * 12.9898) * 43758.5453;
      const v = 128 + (n - Math.floor(n) - 0.5) * 190;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    grainTiles.push(c);
  }
  return grainTiles;
}

/**
 * Bloom, grade, vignette, grain. Mutates the canvas the sample just drew.
 * @param {CanvasRenderingContext2D} g
 * @param {number} w
 * @param {number} h
 * @param {number} t   seconds inside the loop (may be negative)
 * @param {object} look  the sample's look ({ bg, ink, accent, ... })
 */
export function finish(g, w, h, t, look = {}) {
  if (look.finish === false) return;
  const min = Math.min(w, h);
  const dark = luma(look.bg) < 0.35;

  // 1. Bloom, thresholded. Downsample, blur, square twice (which crushes the
  //    midtones and keeps only real highlights), then add back. The squaring is
  //    what stops a bright background from turning into milk.
  const bw = Math.max(8, Math.round(w / 4));
  const bh = Math.max(8, Math.round(h / 4));
  const a = scratch(`bloom-a${bw}x${bh}`, bw, bh);
  const b = scratch(`bloom-b${bw}x${bh}`, bw, bh);
  const ag = a.getContext('2d');
  const bg = b.getContext('2d');
  ag.globalCompositeOperation = 'source-over';
  ag.clearRect(0, 0, bw, bh);
  ag.filter = `blur(${Math.max(1.5, min * 0.012)}px)`;
  ag.drawImage(g.canvas, 0, 0, bw, bh);
  ag.filter = 'none';
  bg.globalCompositeOperation = 'copy';
  bg.drawImage(a, 0, 0);
  bg.globalCompositeOperation = 'multiply';
  bg.drawImage(a, 0, 0);
  ag.globalCompositeOperation = 'copy';
  ag.drawImage(b, 0, 0);
  ag.globalCompositeOperation = 'multiply';
  ag.drawImage(b, 0, 0);
  ag.globalCompositeOperation = 'source-over';
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = dark ? 0.85 : 0.34;
  g.drawImage(b, 0, 0, w, h);
  g.restore();

  // 2. Split tone: warm on the light side, cool in the shadow. Two low-alpha
  //    washes with soft-light, not a colour cast over everything.
  g.save();
  g.globalCompositeOperation = 'soft-light';
  const warm = g.createLinearGradient(0, 0, w, h);
  warm.addColorStop(0, dark ? 'rgba(255, 176, 120, 0.30)' : 'rgba(255, 190, 140, 0.20)');
  warm.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  warm.addColorStop(1, dark ? 'rgba(70, 110, 255, 0.30)' : 'rgba(90, 120, 230, 0.18)');
  g.fillStyle = warm;
  g.fillRect(0, 0, w, h);
  g.restore();

  // 3. Key light from above. Only on dark grounds — on paper it just fogs.
  if (dark) {
    g.save();
    const key = g.createLinearGradient(0, 0, 0, h * 0.7);
    key.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
    key.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = key;
    g.fillRect(0, 0, w, h * 0.7);
    g.restore();
  }

  // 4. Vignette.
  g.save();
  const vig = g.createRadialGradient(
    w * 0.5,
    h * 0.46,
    min * 0.3,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.78,
  );
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.65, dark ? 'rgba(0, 0, 0, 0.12)' : 'rgba(40, 28, 16, 0.05)');
  vig.addColorStop(1, dark ? 'rgba(0, 0, 0, 0.38)' : 'rgba(40, 28, 16, 0.16)');
  g.fillStyle = vig;
  g.fillRect(0, 0, w, h);
  g.restore();

  // 5. Grain, tiled and offset by the frame so it moves.
  const tiles = grain();
  const tile = tiles[Math.floor(Math.abs(t) * 24) % tiles.length];
  const off = (Math.abs(t) * 37) % GRAIN;
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = dark ? 0.16 : 0.09;
  for (let y = -GRAIN - off * 0.6; y < h; y += GRAIN) {
    for (let x = -GRAIN - off; x < w; x += GRAIN) g.drawImage(tile, x, y);
  }
  g.restore();
}
