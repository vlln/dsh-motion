// A code-drawn shot that still has material.
//
// The architecture is the point of this file, so it is three steps:
//
//   1. draw the world ONCE, in mount(), into a canvas the size of the render
//      (`ctx.still`) — geometry, camera, light, nothing that moves;
//   2. paint it — a material pass (strokes) and a film pass (halation, grain,
//      vignette), also once;
//   3. every frame: blit the painted plate, then draw only what moves on top —
//      rain, ripples, a flicker, and one small actor.
//
// A scene that redraws its geometry every frame can never afford step 2, which
// is why it ends up looking like flat graphics. Draw once, paint once, move on
// top.

export const id = 'street';
export const slots = {};
export const textUsage = {};

let ctx;
let plate = null;

const LAMP = { x: 0.62, y: 0.44 };

/**
 * The mass: the big shapes that carry the picture. This is what gets painted —
 * painterly strokes at this scale replace them faithfully, because there is
 * nothing smaller than a stroke inside them.
 */
function drawMass(g, w, h) {
  // Night sky with the city's own glow in it: dark at the top, brighter at the
  // horizon. Without that band the buildings have nothing to be silhouetted
  // against and the whole frame collapses to one value.
  const sky = g.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#05080c');
  sky.addColorStop(0.55, '#0d161d');
  sky.addColorStop(0.86, '#24333d');
  sky.addColorStop(1, '#31424c');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  // far buildings: flat silhouettes, two tones only
  g.fillStyle = '#04070a';
  g.fillRect(0, h * 0.18, w * 0.24, h * 0.42);
  g.fillRect(w * 0.24, h * 0.26, w * 0.18, h * 0.34);
  g.fillRect(w * 0.78, h * 0.22, w * 0.22, h * 0.38);
  g.fillStyle = '#080d11';
  g.fillRect(w * 0.42, h * 0.31, w * 0.36, h * 0.29);

  // a few dead windows
  g.fillStyle = 'rgba(240,196,120,0.10)';
  for (let i = 0; i < 14; i++) {
    const x = w * 0.04 + ((i * 137) % Math.round(w * 0.7));
    const y = h * 0.22 + ((i * 53) % Math.round(h * 0.3));
    g.fillRect(x, y, w * 0.008, h * 0.014);
  }

  // the road, in perspective: one plane, lines converging
  const cam = ctx.paint.space({ w, h, eye: [0, 1.5, 3.2], look: [0, 1.25, -8], fov: 54 });
  // the road: mid value, warmer where the light hits it
  const road = g.createLinearGradient(0, h * 0.6, 0, h);
  road.addColorStop(0, '#151c21');
  road.addColorStop(1, '#222b30');
  g.fillStyle = road;
  g.fill(cam.quad([-9, 0, -9], [9, 0, -9], [9, 0, 6], [-9, 0, 6]));

  // the light itself is mass; the fixture that makes it is detail
  const lx = w * LAMP.x;
  const ly = h * LAMP.y;
  const cone = g.createLinearGradient(lx, ly, lx, h * 0.86);
  cone.addColorStop(0, 'rgba(255,220,165,0.46)');
  cone.addColorStop(0.55, 'rgba(255,214,150,0.16)');
  cone.addColorStop(1, 'rgba(255,214,150,0)');
  g.fillStyle = cone;
  g.beginPath();
  g.moveTo(lx - w * 0.012, ly);
  g.lineTo(lx - w * 0.15, h * 0.9);
  g.lineTo(lx + w * 0.15, h * 0.9);
  g.lineTo(lx + w * 0.012, ly);
  g.closePath();
  g.fill();

  // the pool of light on the wet road
  const pool = g.createRadialGradient(lx, h * 0.82, 0, lx, h * 0.82, w * 0.2);
  pool.addColorStop(0, 'rgba(255,210,150,0.32)');
  pool.addColorStop(1, 'rgba(255,206,140,0)');
  g.fillStyle = pool;
  g.fillRect(lx - w * 0.25, h * 0.6, w * 0.5, h * 0.42);

  // puddles: the dark mass only; the reflection and the ripples are details
  for (const p of PUDDLES) {
    g.fillStyle = '#0a0f13';
    g.beginPath();
    g.ellipse(w * p.x, h * p.y, w * p.rx, h * p.ry, 0, 0, Math.PI * 2);
    g.fill();
  }
}

const PUDDLES = [
  { x: 0.34, y: 0.84, rx: 0.12, ry: 0.035 },
  { x: 0.7, y: 0.9, rx: 0.16, ry: 0.045 },
  { x: 0.5, y: 0.76, rx: 0.08, ry: 0.022 },
];

/**
 * The detail: lines thin enough that a stroke would swallow them. Drawn crisp,
 * every frame, on top of the painted plate. Block in, then draw the line — that
 * is how the two halves coexist without one destroying the other.
 */
function drawDetail(g, w, h) {
  const cam = ctx.paint.space({ w, h, eye: [0, 1.5, 3.2], look: [0, 1.25, -8], fov: 54 });

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
    const refl = g.createLinearGradient(0, h * (p.y - p.ry), 0, h * (p.y + p.ry));
    refl.addColorStop(0, 'rgba(255,226,180,0.34)');
    refl.addColorStop(0.5, 'rgba(228,190,140,0.10)');
    refl.addColorStop(1, 'rgba(255,214,150,0.02)');
    g.save();
    g.beginPath();
    g.ellipse(w * p.x, h * p.y, w * p.rx * 0.9, h * p.ry * 0.85, 0, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = refl;
    g.fillRect(w * (p.x - p.rx), h * (p.y - p.ry), w * p.rx * 2, h * p.ry * 2);
    g.restore();
  }

  // the lamp itself: post, arm, head
  const lx = w * LAMP.x;
  const ly = h * LAMP.y;
  g.strokeStyle = '#080b0e';
  g.lineWidth = Math.max(3, w * 0.006);
  g.beginPath();
  g.moveTo(lx, ly);
  g.lineTo(lx, h * 0.74);
  g.stroke();
  g.fillStyle = '#080b0e';
  g.fillRect(lx - w * 0.018, ly - h * 0.011, w * 0.036, h * 0.013);
  g.fillStyle = '#ffeecb';
  g.beginPath();
  g.ellipse(lx, ly + h * 0.001, w * 0.011, h * 0.0055, 0, 0, Math.PI * 2);
  g.fill();
}

export function mount(context) {
  ctx = context;
  const base = ctx.still(drawMass);
  // Paint once, at a stroke size the mass can survive. Detail is *not* painted:
  // it is drawn on top of the plate every frame.
  const painted = ctx.medium.broken(base, { density: 1.1, size: 0.5, seed: 11 });

  // Haze, masked to the distance. A soft pass over the whole frame just mushes
  // the paint; fog belongs where the air is thick — near the horizon — and the
  // mask is what makes it a place rather than a filter.
  const haze = document.createElement('canvas');
  haze.width = base.width;
  haze.height = base.height;
  const hz = haze.getContext('2d');
  hz.drawImage(ctx.medium.mist(painted, { density: 1, seed: 5 }), 0, 0);
  hz.globalCompositeOperation = 'destination-in';
  // A band, not a veil: the air is thick at the horizon and clear at the feet.
  const mask = hz.createLinearGradient(0, base.height * 0.24, 0, base.height * 0.66);
  mask.addColorStop(0, 'rgba(0,0,0,0)');
  mask.addColorStop(0.45, 'rgba(0,0,0,0.5)');
  mask.addColorStop(0.72, 'rgba(0,0,0,0.25)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  hz.fillStyle = mask;
  hz.fillRect(0, 0, base.width, base.height);

  // Three layers, in order: paint, then the masked haze *over* it, then film.
  // Passing the haze layer to film() on its own would throw the picture away —
  // the mask leaves most of it transparent.
  const composed = document.createElement('canvas');
  composed.width = base.width;
  composed.height = base.height;
  const cg = composed.getContext('2d');
  cg.drawImage(painted, 0, 0);
  cg.drawImage(haze, 0, 0);

  plate = ctx.medium.film(composed, { grain: 0.05, halation: 0.16, vignette: 0.5, seed: 3 });
}

const drop = (i) => ({ x: (i * 149) % 1000, y: (i * 83) % 1000, len: 20 + ((i * 37) % 40), speed: 700 + ((i * 61) % 420) });

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;

  // 1. the plate, with the only smooth motion in the shot: a slow push
  const zoom = 1.02 + (t / 8) * 0.06;
  const bw = w * zoom;
  const bh = h * zoom;
  g.drawImage(plate, -(bw - w) * 0.5, -(bh - h) * 0.62, bw, bh);
  // the crisp half, on the same zoom, so plate and line stay registered
  g.save();
  g.translate(-(bw - w) * 0.5, -(bh - h) * 0.62);
  g.scale(zoom, zoom);
  drawDetail(g, w, h);
  g.restore();

  // 2. rain: thin, fast, and few — it is a texture, not a weather system
  g.save();
  g.strokeStyle = 'rgba(190,210,225,0.20)';
  g.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const d = drop(i);
    const y = ((d.y + t * d.speed) % (h * 1.2)) - h * 0.1;
    const x = (d.x / 1000) * w + y * 0.06;
    g.lineWidth = 1 + (i % 3) * 0.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - d.len * 0.18, y - d.len);
    g.stroke();
  }
  g.restore();

  // 3. ripples in the big puddle: three rings, looping on their own clocks
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const phase = ((t * 0.55 + i * 0.33) % 1);
    if (phase > 0.92) continue;
    g.strokeStyle = `rgba(220,230,240,${(1 - phase) * 0.16})`;
    g.lineWidth = Math.max(1, 2.2 * (1 - phase));
    g.beginPath();
    g.ellipse(w * 0.7, h * 0.9, w * 0.16 * phase, h * 0.045 * phase, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();

  // 4. the lamp breathes once, late: one event, on the same clock as the cut
  const flicker = t > 5.2 && t < 5.42 ? 0.5 + 0.5 * Math.sin((t - 5.2) * 90) : 1;
  if (flicker < 1) {
    g.save();
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = `rgba(4,7,9,${(1 - flicker) * 0.35})`;
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  // 5. the actor: a paper cup blown across, stepped at 8fps, no tweening
  const step = Math.floor(t * 8);
  const cx = w * (0.18 + ((step * 0.012) % 0.5));
  const cy = h * 0.86;
  const tumble = (step % 3) * 0.35;
  g.save();
  g.translate(cx, cy);
  g.rotate(0.2 + tumble);
  g.fillStyle = '#d8d2c4';
  g.beginPath();
  g.moveTo(-14, 6);
  g.lineTo(14, 6);
  g.lineTo(10, -10);
  g.lineTo(-10, -10);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(-10, -10, 20, 3);
  g.restore();

  // 6. shadow under the actor, hard and dark: it has to sit in the picture
  g.fillStyle = 'rgba(6,9,12,0.45)';
  g.beginPath();
  g.ellipse(cx, cy + 8, 18, 4, 0, 0, Math.PI * 2);
  g.fill();
}
