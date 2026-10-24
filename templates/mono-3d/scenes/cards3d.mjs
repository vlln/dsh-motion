// Real 3D, not a drawing of it: beveled cards on a dark stage, physically based
// material, an environment built from a few emissive strips, a shadow-catching
// floor, and a camera that circles. Everything is geometry and light.
import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Scene,
  Shape,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

export const id = 'cards3d';
export const kind = 'webgl';
export const slots = {};
export const textUsage = {};

let ctx = null;
let renderer = null;
let scene = null;
let camera = null;
let group = null;
const cards = [];

function roundedRect(w, h, r) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** The face of a card: a screen block, a number, a label. Drawn to a texture. */
function faceTexture(count, label) {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 392;
  const g = cv.getContext('2d');
  g.fillStyle = '#0c0c0d';
  g.fillRect(0, 0, 256, 392);
  const screen = g.createLinearGradient(0, 40, 0, 190);
  screen.addColorStop(0, '#5c5c5c');
  screen.addColorStop(1, '#191919');
  g.fillStyle = screen;
  g.beginPath();
  g.roundRect(22, 40, 212, 150, 16);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.94)';
  g.font = '500 44px -apple-system, system-ui, sans-serif';
  g.fillText(String(count), 22, 296);
  g.fillStyle = 'rgba(255,255,255,0.42)';
  g.font = '400 22px -apple-system, system-ui, sans-serif';
  g.fillText(label, 22, 330);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function mount(context) {
  ctx = context;
  const bg = new Color(ctx.color('bg'));

  renderer = new WebGLRenderer({ canvas: ctx.canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(ctx.dpr);
  renderer.setSize(ctx.width, ctx.height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  scene = new Scene();
  scene.background = bg;
  scene.fog = new Fog(bg, 7, 15);

  camera = new PerspectiveCamera(34, ctx.width / ctx.height, 0.1, 60);

  // Studio: three emissive strips for reflections, then a PMREM of that room.
  const room = new Scene();
  room.background = new Color('#050506');
  const strip = (x, y, z, w, h, rot, intensity) => {
    const m = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({ color: new Color(intensity, intensity, intensity), side: DoubleSide }),
    );
    m.position.set(x, y, z);
    m.rotation.set(rot[0], rot[1], rot[2]);
    room.add(m);
  };
  strip(0, 4, -3, 8, 3, [0, 0, 0], 1.0);
  strip(-4, 0, 0, 6, 8, [0, Math.PI / 2, 0], 0.55);
  strip(4, -1, 1, 4, 6, [0, -Math.PI / 2, 0], 0.25);

  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.06).texture;
  scene.environment = env;

  scene.add(new HemisphereLight(0xffffff, 0x0a0a0a, 0.35));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 6;
  key.shadow.camera.bottom = -6;
  key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new PointLight(0xffffff, 26, 18);
  rim.position.set(-3.2, 1.6, -2.4);
  scene.add(rim);

  const floor = new Mesh(
    new PlaneGeometry(40, 40),
    new MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.42, metalness: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.55;
  floor.receiveShadow = true;
  scene.add(floor);

  group = new Group();
  scene.add(group);

  const geom = new ExtrudeGeometry(roundedRect(1.02, 1.56, 0.16), {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 24,
  });
  geom.center();

  const values = [
    [15038, 'Views'],
    [518797, 'Views'],
    [9864421, 'Views'],
    [21204, 'Views'],
  ];
  const slotsX = [-1.75, -0.62, 0.62, 1.75];
  values.forEach(([count, label], i) => {
    const holder = new Group();
    holder.position.set(slotsX[i], i % 2 === 0 ? 0.14 : -0.16, i === 1 || i === 2 ? 0.2 : -0.25);
    holder.rotation.y = -slotsX[i] * 0.16;

    const body = new Mesh(
      geom,
      new MeshStandardMaterial({
        color: 0x161617,
        metalness: 0.85,
        roughness: 0.28,
        envMapIntensity: 1.4,
      }),
    );
    body.castShadow = true;
    body.receiveShadow = true;
    holder.add(body);

    const face = new Mesh(
      new PlaneGeometry(0.94, 1.44),
      new MeshBasicMaterial({ map: faceTexture(count, label), toneMapped: false }),
    );
    face.position.z = 0.078;
    holder.add(face);

    group.add(holder);
    cards.push({ holder, base: holder.rotation.y, phase: i * 0.7, y: holder.position.y });
  });
}

export function render(t) {
  group.rotation.y = Math.sin(t * 0.25) * 0.12;
  for (const card of cards) {
    card.holder.rotation.y = card.base + Math.sin(t * 0.7 + card.phase) * 0.28;
    card.holder.position.y = card.y + Math.sin(t * 0.8 + card.phase) * 0.045;
  }

  camera.position.set(Math.sin(t * 0.22) * 0.5, 0.55 + Math.sin(t * 0.4) * 0.06, 7.2);
  camera.lookAt(0, 0.02, 0);

  renderer.render(scene, camera);
}
