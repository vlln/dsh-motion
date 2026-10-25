// One world, three shots.
//
// The mass is drawn once per shot (a different camera and a different light),
// painted once, hazed once, filmed once. Per frame each shot blits its plate and
// draws only what moves. Sharing this module is the point: the world is one
// place, and the three shots are three ways of looking at it.

export const LAMP = { x: 0.62, y: 0.44 };

const PUDDLES = [
  { x: 0.34, y: 0.84, rx: 0.12, ry: 0.035 },
  { x: 0.7, y: 0.9, rx: 0.16, ry: 0.045 },
  { x: 0.5, y: 0.76, rx: 0.08, ry: 0.022 },
];

/**
 * The mass: sky, silhouettes, road, the light and its pool, the puddles' bodies.
 *
 * `shot` moves the camera and the light only. Nothing here animates.
 */
export function drawMass(ctx, g, w, h) {
  const lampX = w * LAMP.x;
  const lampY = h * LAMP.y;

  const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#05080c');
  sky.addColorStop(0.55, '#0d161d');
  sky.addColorStop(0.86, '#24333d');
  sky.addColorStop(1, '#31424c');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  g.fillStyle = '#04070a';
  for (const b of [[0, 0.18, 0.24, 0.42], [0.24, 0.26, 0.18, 0.34], [0.78, 0.22, 0.22, 0.38]]) {
    g.fillRect(w * b[0], h * b[1], w * b[2], h * b[3]);
  }
  g.fillStyle = '#080d11';
  g.fillRect(w * 0.42, h * 0.31, w * 0.36, h * 0.29);

  // windows: a few are lit, most are not
  g.fillStyle = 'rgba(240,196,120,0.10)';
  for (let i = 0; i < 14; i++) {
    const x = w * 0.04 + ((i * 137) % Math.round(w * 0.7));
    const y = h * 0.22 + ((i * 53) % Math.round(h * 0.3));
    g.fillRect(x, y, w * 0.008, h * 0.014);
  }

  // the road, in one perspective: this is a single place, painted once
  const cam = ctx.paint.space({ w, h, eye: [0, 1.5, 3.2], look: [0, 1.25, -8], fov: 54 });
  const road = g.createLinearGradient(0, h * 0.6, 0, h);
  road.addColorStop(0, '#151c21');
  road.addColorStop(1, '#222b30');
  g.fillStyle = road;
  g.fill(cam.quad([-9, 0, -9], [9, 0, -9], [9, 0, 6], [-9, 0, 6]));

  // the light: cone and pool, at whatever strength this shot needs
  const cone = g.createLinearGradient(lampX, lampY, lampX, h * 0.9);
  cone.addColorStop(0, 'rgba(255,220,165,0.46)');
  cone.addColorStop(0.55, 'rgba(255,214,150,0.16)');
  cone.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(lampX - w * 0.012, lampY);
  g.lineTo(lampX - w * 0.15, h * 0.9);
  g.lineTo(lampX + w * 0.15, h * 0.9);
  g.lineTo(lampX + w * 0.012, lampY);
  g.closePath();
  g.fill();

  const pool = g.createRadialGradient(lampX, h * 0.82, 0, lampX, h * 0.82, w * 0.2);
  pool.addColorStop(0, 'rgba(255,210,150,0.32)');
  pool.addColorStop(1, 'rgba(255,210,150,0)');
  g.fillStyle = pool;
  g.fillRect(lampX - w * 0.25, h * 0.6, w * 0.5, h * 0.42);

  for (const p of PUDDLES) {
    const q = p;
    g.fillStyle = '#0a0f13';
    g.beginPath();
    g.ellipse(w * q.x, h * q.y, w * q.rx, h * q.ry, 0, 0, Math.PI * 2);
    g.fill();
  }
}

/** The detail: everything thinner than a stroke, drawn crisp on top. */
export function drawDetail(ctx, g, w, h, shot, t) {
  const cam = ctx.paint.space({ w, h, eye: [0, 1.5, 3.2], look: [0, 1.25, -8], fov: 54 });
  const lampX = w * shot.lampX;
  const lampY = h * shot.lampY;

  // lane markings
  for (let i = 0; i < 7; i++) {
    const z = -2 - i * 1.6;
    const [x0, y0, k] = cam.at(-0.9, 0.01, z);
    const [x1, y1] = cam.at(-0.9, 0.01, z - 0.8);
    g.strokeStyle = `rgba(196,190,150,${0.14 + 0.06 * (1 - i / 7)})`;
    g.lineWidth = Math.max(1, 0.06 * k);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }

  // reflection inside each puddle
  for (const p of PUDDLES) {
    const q = p;
    const refl = g.createLinearGradient(0, h * (q.y - q.ry), 0, h * (q.y + q.ry));
    refl.addColorStop(0, 'rgba(255,226,180,0.34)');
    refl.addColorStop(0.5, 'rgba(228,190,140,0.10)');
    refl.addColorStop(1, 'rgba(255,214,150,0.02)');
    g.save();
    g.beginPath();
    g.ellipse(w * q.x, h * q.y, w * q.rx * 0.9, h * q.ry * 0.85, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = refl;
    g.fillRect(w * (q.x - q.rx), h * (q.y - q.ry), w * q.rx * 2, h * q.ry * 2);
    g.restore();
  }

  // the lamp
  g.strokeStyle = '#080b0e';
  g.lineWidth = Math.max(3, w * 0.006);
  g.beginPath();
  g.moveTo(lampX, lampY);
  g.lineTo(lampX, h * (shot.lampY + 0.3));
  g.stroke();
  g.fillStyle = '#080b0e';
  g.fillRect(lampX - w * 0.018, lampY - h * 0.011, w * 0.036, h * 0.013);
  g.fillStyle = '#ffeecb';
  g.beginPath();
  g.ellipse(lampX, lampY + h * 0.001, w * 0.011, h * 0.0055, 0, 0, Math.PI * 2);
  g.fill();

  // rain: the same weather in every shot, at that shot's scale
  g.save();
  g.strokeStyle = 'rgba(190,210,225,0.20)';
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const x0 = (i * 149) % 1000;
    const y0 = (i * 83) % 1000;
    const speed = 700 + ((i * 61) % 420);
    const len = (20 + ((i * 37) % 40)) * shot.rainScale;
    const y = ((y0 + t * speed) % (h * 1.2)) - h * 0.1;
    const x = (x0 / 1000) * w + y * 0.06;
    g.lineWidth = 1 + (i % 3) * 0.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - len * 0.18, y - len);
    g.stroke();
  }
  g.restore();

  // ripples, only where a puddle is big enough to show them
  if (shot.ripples) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const phase = (t * 0.55 + i * 0.33) % 1;
      if (phase > 0.92) continue;
      g.strokeStyle = `rgba(220,230,240,${(1 - phase) * 0.16})`;
      g.lineWidth = Math.max(1, 2.2 * (1 - phase));
      g.beginPath();
      g.ellipse(w * 0.7, h * 0.9, w * 0.16 * phase, h * 0.045 * phase, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  // the actor: a paper cup, blown along, stepped at 8fps
  if (shot.cup) {
    const step = Math.floor(t * 8);
    const cx = w * (shot.cup.x + ((step * 0.012) % shot.cup.travel));
    const cy = h * shot.cup.y;
    const tumble = (step % 3) * 0.35;
    g.fillStyle = 'rgba(6,9,12,0.45)';
    g.beginPath();
    g.ellipse(cx, cy + 8, 18, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.save();
    g.translate(cx, cy);
    g.rotate(0.2 + tumble);
    const s = shot.cup.scale;
    g.fillStyle = '#d8d2c4';
    g.beginPath();
    g.moveTo(-14 * s, 6 * s);
    g.lineTo(14 * s, 6 * s);
    g.lineTo(10 * s, -10 * s);
    g.lineTo(-10 * s, -10 * s);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(-10 * s, -10 * s, 20 * s, 3 * s);
    g.restore();
  }
}

let shared = null;
let layer = null;
let layerStep = -1;

const BOIL = 6; // the surface re-seeds 6 times a second, not 24: 24 reads as flicker

/**
 * The base: the flat world, graded once. Everything that does not move.
 * Half resolution on purpose — the stroke layer above it is what the eye reads.
 */
export function getBase(ctx) {
  if (!shared) {
    const base = ctx.still((g, w, h) => drawMass(ctx, g, w, h), { scale: 1.6 });
    shared = ctx.medium.film(base, { grain: 0.05, halation: 0.16, vignette: 0.5, seed: 3 });
  }
  return shared;
}

/**
 * The stroke layer, over the base, re-seeded `BOIL` times a second.
 *
 * This is the difference between "a picture with a texture on it" and "a surface
 * made of marks": every cell of the frame gets a short stroke sampled from the
 * base, angled by the region (water runs sideways, buildings do not), and the
 * whole grid jumps to a new jitter on each boil step. Cached between steps —
 * recomputing it every frame is both slower and worse (it boils to mush).
 */
export function getLayer(ctx, t) {
  const base = getBase(ctx);
  const step = Math.floor(t * BOIL);
  if (step === layerStep && layer) return layer;
  layerStep = step;
  const angle = (x, y) => {
    // water: horizontal; sky: nearly still; buildings: vertical grain
    return Math.sin(y * 0.05 + x * 0.004) > 0.2 ? 0.06 : -0.02;
  };
  const palette = (x, y, col, rand) => {
    // warm the lit ground, cool the shadows: the same base, two materials
    const lum = (col[0] + col[1] + col[2]) / 3;
    if (lum > 90) return [Math.min(255, col[0] * 1.12 + 18), Math.min(255, col[1] * 1.05 + 6), col[2] * 0.92];
    if (lum < 28) return [col[0] * 0.9, col[1] * 0.95, Math.min(255, col[2] * 1.15 + 6)];
    void rand;
    return null;
  };
  layer = ctx.paint.strokes(base, {
    cell: 9, len: 26, width: 7, seed: 21, t, boil: BOIL, angle, palette, jitter: 22,
    outline: 0.32, outlineColor: '#0a1018', outlineMix: 0.5,
  });
  return layer;
}

/**
 * A window onto the painted surface. `view` is in fractions: {x, y, w, h}.
 * Detail is drawn in the painting's coordinates, so it scales with the window.
 */
export function drawView(ctx, g, w, h, view, shot, t) {
  const plate = getLayer(ctx, t);
  const pw = plate.width;
  const ph = plate.height;
  // A window that runs off the painting reads as a black bar, so clamp it.
  const v = {
    w: Math.min(1, view.w),
    h: Math.min(1, view.h),
    x: Math.min(Math.max(0, view.x), 1 - Math.min(1, view.w)),
    y: Math.min(Math.max(0, view.y), 1 - Math.min(1, view.h)),
  };
  g.drawImage(plate, v.x * pw, v.y * ph, v.w * pw, v.h * ph, 0, 0, w, h);

  g.save();
  const sx = w / (v.w * pw);
  const sy = h / (v.h * ph);
  g.setTransform(sx, 0, 0, sy, -v.x * pw * sx, -v.y * ph * sy);
  drawDetail(ctx, g, pw, ph, shot, t);
  g.restore();
}
