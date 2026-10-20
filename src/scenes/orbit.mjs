import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Fog,
  GridHelper,
  Group,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusKnotGeometry,
  WebGLRenderer,
} from 'three';

export const id = 'orbit';
export const kind = 'webgl';
export const slots = {
  era: { default: 'The timeline, in three dimensions', role: 'caption', maxChars: 48 },
  title: { default: 'One object, every beat', role: 'title', maxChars: 48 },
  subtitle: { default: 'A torus knot orbiting with the track', role: 'subtitle', maxChars: 80 },
};
export const textUsage = { era: 1, title: 1, subtitle: 1 };

let ctx = null;
let renderer = null;
let scene = null;
let camera = null;
let knot = null;
let ring = null;

function beatPulse(t) {
  const grid = ctx.beats ?? [];
  if (!grid.length) return 0;
  const g = t + (ctx.sceneStart ?? 0);
  let nearest = Infinity;
  for (const b of grid) nearest = Math.min(nearest, Math.abs(b - g));
  return Math.exp(-Math.pow(nearest / 0.12, 2));
}

export function mount(context) {
  ctx = context;
  const bg = ctx.color('bg');
  const accent = ctx.color('accent');
  const grid = ctx.color('grid');
  const muted = ctx.color('muted');

  renderer = new WebGLRenderer({
    canvas: ctx.canvas,
    antialias: true,
    preserveDrawingBuffer: true,
    alpha: false,
  });
  renderer.setPixelRatio(ctx.dpr);
  renderer.setSize(ctx.width, ctx.height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(new Color(bg), 1);

  scene = new Scene();
  scene.fog = new Fog(new Color(bg), 7, 16);

  camera = new PerspectiveCamera(38, ctx.width / ctx.height, 0.1, 100);
  camera.position.set(0, 1.8, 6.4);
  camera.lookAt(-0.9, 0.1, 0);

  scene.add(new HemisphereLight(0x9fc4ff, 0x0a1020, 0.7));
  const key = new DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 8, 4);
  scene.add(key);
  const rim = new PointLight(new Color(accent), 28, 22);
  rim.position.set(-2.5, 1.2, 2.5);
  scene.add(rim);

  const geo = new TorusKnotGeometry(1.15, 0.3, 240, 32);
  const mat = new MeshStandardMaterial({
    color: new Color(accent),
    metalness: 0.72,
    roughness: 0.24,
    emissive: new Color(accent).multiplyScalar(0.14),
  });
  knot = new Mesh(geo, mat);
  scene.add(knot);

  ring = new Group();
  const pinMat = new MeshStandardMaterial({
    color: new Color(muted),
    metalness: 0.4,
    roughness: 0.4,
    emissive: new Color(accent).multiplyScalar(0.35),
  });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const pin = new Mesh(new SphereGeometry(0.1, 20, 20), pinMat);
    pin.position.set(Math.cos(a) * 2.5, Math.sin(a) * 0.5, Math.sin(a) * 2.5);
    ring.add(pin);
  }
  scene.add(ring);

  const gridHelper = new GridHelper(14, 14, new Color(grid), new Color(grid));
  gridHelper.position.y = -1.5;
  scene.add(gridHelper);
}

export function render(t) {
  const pulse = beatPulse(t);

  knot.rotation.x = t * 1.1;
  knot.rotation.y = t * 1.7;
  const s = 1 + pulse * 0.06;
  knot.scale.setScalar(s);

  ring.rotation.y = t * 1.4;
  ring.rotation.x = Math.sin(t * 0.3) * 0.15;

  const a = t * 1.05;
  const r = 6.0 + 0.9 * Math.sin(t * 1.6);
  camera.position.set(Math.cos(a) * r, 1.7 + 0.5 * Math.sin(t * 0.7), Math.sin(a) * r);
  camera.lookAt(-0.9, 0.1, 0);

  renderer.render(scene, camera);
}

// Typography is drawn on the display canvas after the WebGL composite,
// so a 3D scene uses the same text slots and palette as 2D scenes.
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export function overlay(g, context, t) {
  const W = context.width;
  const H = context.height;
  const a = Math.min(1, Math.max(0, (t - 0.1) / 0.7));

  // left scrim: keeps typography readable over a bright 3D subject
  const bg = context.color('bg');
  const grad = g.createLinearGradient(0, 0, W * 0.46, 0);
  grad.addColorStop(0, rgba(bg, 0.96));
  grad.addColorStop(0.6, rgba(bg, 0.82));
  grad.addColorStop(1, rgba(bg, 0));
  g.fillStyle = grad;
  g.fillRect(0, 0, W * 0.46, H);

  g.globalAlpha = a;
  g.fillStyle = context.color('muted');
  g.font = `600 ${Math.round(H * 0.018)}px ${context.font('sans')}`;
  g.fillText(context.text('era').toUpperCase(), W * 0.08, H * 0.16);

  g.fillStyle = context.color('fg');
  g.font = `500 ${Math.round(H * 0.072)}px ${context.font('serif')}`;
  g.fillText(context.text('title'), W * 0.08, H * 0.26);

  g.globalAlpha = Math.min(1, Math.max(0, (t - 0.4) / 0.8));
  g.fillStyle = context.color('muted');
  g.font = `${Math.round(H * 0.026)}px ${context.font('sans')}`;
  g.fillText(context.text('subtitle'), W * 0.08, H * 0.325);
  g.globalAlpha = 1;
}
