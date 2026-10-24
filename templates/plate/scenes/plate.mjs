// A film made the other way round: the world is a real painting, and the only
// thing that moves is one small actor.
//
// Replace `assets/plates/night.jpg` with any public-domain painting or photo
// (see CREDITS.md), keep the shape of this file, and you have a shot.
//
// Why it reads as expensive for very little code: the density of the picture is
// not drawn here, it is borrowed. The code only decides where the window goes,
// who walks through it, and what is in front of them.

export const id = 'plate';
export const assets = ['plate'];
export const slots = {};
export const textUsage = {};

const STEP = 10; // the actor moves at 10 frames a second; the camera moves at 24

let ctx;
let grain = null;
let vignette = null;

// A small figure. Four frames of a walk; the sprite keeps its own grid, which is
// what separates it from the painting behind it.
const P = { h: '#b8432f', s: '#f2c9a0', c: '#37597f', l: '#2b2b33', b: '#15151a' };
const BODY = [
  '..hhhhhh..',
  '.hhhhhhhh.',
  '.hssssssh.',
  '.hskssksh.',
  '.hssssssh.',
  '..ssssss..',
  '..cccccc..',
  '.cccccccc.',
  '.c.cccc.c.',
  '.c.cccc.c.',
  '..cccccc..',
];
const WALK = [
  [...BODY, '..ll..ll..', '..bb..bb..'],
  [...BODY, '...l..ll..', '...b..bb..'],
  [...BODY, '..ll...l..', '..bb...b..'],
  [...BODY, '..ll..l...', '..bb..b...'],
];

export function mount(context) {
  ctx = context;

  // Grain and vignette are the same every frame: build them once.
  grain = document.createElement('canvas');
  grain.width = 512;
  grain.height = 512;
  const gg = grain.getContext('2d');
  const img = gg.createImageData(512, 512);
  for (let i = 0, p = 0; i < 512 * 512; i++, p += 4) {
    const v = Math.sin(i * 0.37 + 11.3) * 43758.5453;
    const q = 128 + ((v - Math.floor(v)) - 0.5) * 255;
    img.data[p] = img.data[p + 1] = img.data[p + 2] = q;
    img.data[p + 3] = 255;
  }
  gg.putImageData(img, 0, 0);
}

/** The painting as the world: a cover-fit window that pushes in and drifts. */
function world(g, w, h, t) {
  const p = t / 8;
  const zoom = 1.06 + p * 0.1;
  const bw = w * zoom;
  const bh = h * zoom;
  ctx.image('plate', {
    x: -(bw - w) * (0.45 + p * 0.1),
    y: -(bh - h) * 0.5,
    w: bw,
    h: bh,
    fit: 'cover',
    focus: [0.42 + p * 0.16, 0.5],
  });
}

export function render(t) {
  const g = ctx.canvas.getContext('2d');
  const w = ctx.width;
  const h = ctx.height;
  g.fillStyle = '#0a0c10';
  g.fillRect(0, 0, w, h);

  world(g, w, h, t);

  // --- the actor ------------------------------------------------------------
  const frame = Math.floor(t * STEP) % WALK.length;
  const pose = WALK[frame];
  const s = Math.max(4, Math.round(h / 85)); // an actor is a fraction of the frame
  const groundY = h * 0.93;
  const x = w * (0.2 + 0.42 * Math.min(1, t / 8));

  // a hop on one step of the cycle: sprite motion, not a tween
  const hop = frame === 2 ? -s : 0;

  ctx.paint.sprite(g, pose, P, {
    x: x - 5 * s,
    y: groundY - pose.length * s + hop,
    scale: s,
    outline: '#0d0c10',
  });

  // --- what is in front of it ----------------------------------------------
  // Tall grass drawn from the bottom of the frame up over the actor's legs is
  // what puts it *inside* the painting instead of on top of it. Few and coarse:
  // this is a foreground, not a texture.
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    const bx = x - 7 * s + i * 1.7 * s + ((i * 37) % 11);
    const top = groundY - s * (2.4 + ((i * 13) % 9) / 4);
    g.strokeStyle = i % 3 === 0 ? 'rgba(232,196,110,0.92)' : 'rgba(176,140,62,0.9)';
    g.lineWidth = Math.max(2, s * (0.3 + ((i * 7) % 3) * 0.12));
    g.beginPath();
    g.moveTo(bx, h + s);
    g.quadraticCurveTo(bx - s * 0.6, (h + top) / 2, bx + s * 0.5, top);
    g.stroke();
  }
  g.restore();

  // --- grade ---------------------------------------------------------------
  // Grain with an offset that changes per step, so it shimmers like film rather
  // than sitting on the picture like a texture.
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.07;
  const ox = (Math.floor(t * 12) * 61) % 512;
  const oy = (Math.floor(t * 12) * 37) % 512;
  for (let y = -oy; y < h; y += 512) for (let x0 = -ox; x0 < w; x0 += 512) g.drawImage(grain, x0, y);
  g.restore();

  if (!vignette) {
    vignette = g.createRadialGradient(w / 2, h * 0.5, h * 0.3, w / 2, h * 0.5, h * 0.95);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
  }
  g.fillStyle = vignette;
  g.fillRect(0, 0, w, h);
}
