// Twelve seconds, one stage, everything three-dimensional.
//
//   0.0–4.2   beveled cards on a dark stage, counters on their faces
//   4.2–7.6   metal coins fall into three stacks
//   7.6–10.4  a twelve-segment wheel spins and lands under the pointer
//   10.4–12.0 type
//
// PBR materials, an environment built from emissive strips, a shadow floor,
// and a bloom pass — the same three the engine already ships for 3D scenes.
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  Scene,
  Shape,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const id = 'cards3d';
export const kind = 'webgl';
export const slots = {};
export const textUsage = {};

let ctx = null;
let renderer = null;
let composer = null;
let scene = null;
let camera = null;
let cardGroup = null;
let coinGroup = null;
let wheelGroup = null;
let wheelMesh = null;
let typeGroup = null;
let pointer = null;
const falling = [];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const ease = (v) => {
  const x = clamp01(v);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};
const lerp = (a, b, k) => a + (b - a) * k;

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

function texture(w, h, draw) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function faceTexture(count) {
  return texture(256, 392, (g, w, h) => {
    g.fillStyle = '#0b0b0c';
    g.fillRect(0, 0, w, h);
    const screen = g.createLinearGradient(0, 40, 0, 190);
    screen.addColorStop(0, '#6a6a6a');
    screen.addColorStop(1, '#1b1b1b');
    g.fillStyle = screen;
    g.beginPath();
    g.roundRect(22, 40, w - 44, 150, 16);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.font = '500 44px -apple-system, system-ui, sans-serif';
    g.fillText(String(count), 22, 296);
    g.fillStyle = 'rgba(255,255,255,0.42)';
    g.font = '400 22px -apple-system, system-ui, sans-serif';
    g.fillText('Views', 22, 330);
  });
}

function wheelTexture() {
  return texture(512, 512, (g, w, h) => {
    const c = w / 2;
    const r = w * 0.48;
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const a1 = ((i + 1) / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(c, c);
      g.arc(c, c, r, a0, a1);
      g.closePath();
      g.fillStyle = i % 2 ? '#1b1b1c' : '#2a2a2c';
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.stroke();
      const mid = (a0 + a1) / 2;
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.font = '600 34px -apple-system, system-ui, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(i % 2 ? '×' : '+', c + Math.cos(mid) * r * 0.62, c + Math.sin(mid) * r * 0.62);
    }
    g.fillStyle = '#0a0a0b';
    g.beginPath();
    g.arc(c, c, r * 0.12, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 3;
    g.stroke();
  });
}

function typeTexture(text, sub) {
  return texture(1024, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = '700 84px -apple-system, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(text, w / 2, h * 0.52);
    if (sub) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.font = '400 44px -apple-system, system-ui, sans-serif';
      g.fillText(sub, w / 2, h * 0.68);
    }
  });
}

export function mount(context) {
  ctx = context;
  const bg = new Color(ctx.color('bg'));

  renderer = new WebGLRenderer({ canvas: ctx.canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(ctx.dpr);
  renderer.setSize(ctx.width, ctx.height, false);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  scene = new Scene();
  scene.background = bg;
  scene.fog = new Fog(bg, 9, 20);

  // A backdrop with a gradient instead of a flat clear colour: the stage gets
  // depth, and the cards stop floating in a void.
  const backdrop = texture(16, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2b2b36');
    grad.addColorStop(0.55, '#111119');
    grad.addColorStop(1, '#06060a');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const backdropMesh = new Mesh(
    new PlaneGeometry(46, 26),
    new MeshBasicMaterial({ map: backdrop, toneMapped: false, fog: false }),
  );
  backdropMesh.position.set(0, 3, -9);
  scene.add(backdropMesh);

  camera = new PerspectiveCamera(36, ctx.width / ctx.height, 0.1, 80);

  // Studio environment: three emissive strips, baked through PMREM.
  const room = new Scene();
  room.background = new Color('#050506');
  const strip = (x, y, z, w, h, rot, rgb, scale = 1) => {
    const m = new Mesh(
      new PlaneGeometry(w, h),
      new MeshBasicMaterial({
        color: new Color(rgb[0], rgb[1], rgb[2]).multiplyScalar(scale),
        side: DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    m.rotation.set(rot[0], rot[1], rot[2]);
    room.add(m);
  };
  strip(0, 4, -3, 9, 3, [0, 0, 0], [1, 1, 1], 1.0);
  // Coloured sidelights in the environment, not just in the light rig: this is
  // what puts a magenta-to-cyan edge on every glossy surface in the frame.
  strip(-4, 0.5, 0, 6, 8, [0, Math.PI / 2, 0], [1, 0.24, 0.5], 2.6);
  strip(4, -0.5, 1, 4, 6, [0, -Math.PI / 2, 0], [0.2, 0.62, 1], 2.0);
  strip(0, -2.4, 2, 10, 4, [-Math.PI / 2, 0, 0], [0.30, 0.30, 0.42], 0.5);
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(room, 0.06).texture;

  scene.add(new HemisphereLight(0xffffff, 0x09090a, 0.35));
  const key = new DirectionalLight(0xffffff, 2.6);
  key.position.set(3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.bias = -0.0007;
  scene.add(key);
  const rim = new PointLight(0xff4f9a, 42, 20);
  rim.position.set(-3.5, 1.8, -2.6);
  scene.add(rim);
  const rim2 = new PointLight(0x4fc3ff, 26, 18);
  rim2.position.set(3.4, 0.6, -2.2);
  scene.add(rim2);

  const floor = new Mesh(
    new PlaneGeometry(50, 50),
    new MeshStandardMaterial({ color: 0x08080a, roughness: 0.22, metalness: 0.65, envMapIntensity: 1.4 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.55;
  floor.receiveShadow = true;
  scene.add(floor);

  // --- the halo behind the cards: a glowing ring plus a soft wash, which is
  //     what gives the dark stage a centre and a colour.
  const wash = texture(256, 256, (g, w, h) => {
    const grad = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(120, 170, 255, 0.55)');
    grad.addColorStop(0.45, 'rgba(90, 120, 220, 0.16)');
    grad.addColorStop(1, 'rgba(90, 120, 220, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const washMesh = new Mesh(
    new PlaneGeometry(9, 9),
    new MeshBasicMaterial({ map: wash, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, fog: false }),
  );
  washMesh.position.set(0, 0.9, -2.6);
  scene.add(washMesh);

  const halo = new Mesh(
    new TorusGeometry(2.05, 0.012, 12, 160),
    new MeshBasicMaterial({ color: new Color(0.72, 0.85, 1).multiplyScalar(2.2), toneMapped: false, fog: false }),
  );
  halo.position.set(0, 0.55, -2.2);
  scene.add(halo);

  // --- cards
  cardGroup = new Group();
  const cardGeom = new ExtrudeGeometry(roundedRect(1.02, 1.56, 0.16), {
    depth: 0.07,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 4,
    curveSegments: 24,
  });
  cardGeom.center();
  const cardMat = new MeshPhysicalMaterial({
    color: 0x17171b,
    metalness: 0.42,
    roughness: 0.15,
    envMapIntensity: 2.4,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  [
    [15038, -1.55, 0.18],
    [518797, -0.5, -0.18],
    [9864421, 0.6, 0.22],
    [21204, 1.6, -0.2],
  ].forEach(([count, x, y], i) => {
    const holder = new Group();
    holder.position.set(x, y, i % 2 ? 0.15 : -0.1);
    holder.rotation.y = -x * 0.2 + 0.1;
    const body = new Mesh(cardGeom, cardMat);
    body.castShadow = true;
    body.receiveShadow = true;
    holder.add(body);
    const face = new Mesh(
      new PlaneGeometry(0.94, 1.44),
      new MeshBasicMaterial({ map: faceTexture(count), toneMapped: false }),
    );
    face.position.z = 0.09;
    holder.add(face);
    cardGroup.add(holder);
  });
  scene.add(cardGroup);

  // --- coins
  coinGroup = new Group();
  coinGroup.position.set(0, -1.55, 0);
  const coinGeom = new CylinderGeometry(0.22, 0.22, 0.07, 40);
  const coinMat = new MeshStandardMaterial({ color: 0xbfbfbf, metalness: 1, roughness: 0.22, envMapIntensity: 1.8 });
  [-0.7, 0, 0.7].forEach((x, s) => {
    for (let i = 0; i < 14; i++) {
      const coin = new Mesh(coinGeom, coinMat);
      coin.castShadow = true;
      coin.receiveShadow = true;
      const restY = 0.04 + i * 0.072;
      coin.position.set(x, restY, 0);
      coinGroup.add(coin);
      falling.push({ coin, restY, delay: 4.35 + s * 0.35 + i * 0.055, from: 3.2 });
    }
  });
  scene.add(coinGroup);

  // --- wheel
  wheelGroup = new Group();
  wheelGroup.position.set(0, 0.1, 0);
  wheelMesh = new Mesh(
    new CircleGeometry(1.12, 72),
    new MeshStandardMaterial({ map: wheelTexture(), metalness: 0.1, roughness: 0.6, envMapIntensity: 0.6 }),
  );
  wheelMesh.castShadow = true;
  wheelGroup.add(wheelMesh);
  const ring = new Mesh(
    new TorusGeometry(1.13, 0.035, 16, 96),
    new MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.2, emissive: 0x333333 }),
  );
  wheelGroup.add(ring);
  pointer = new Mesh(
    new CircleGeometry(0.1, 3),
    new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  pointer.position.set(0, 1.3, 0.2);
  pointer.rotation.z = Math.PI;
  wheelGroup.add(pointer);
  scene.add(wheelGroup);

  // --- type
  typeGroup = new Group();
  const typePlane = new Mesh(
    new PlaneGeometry(2.6, 1.3),
    new MeshBasicMaterial({ map: typeTexture('CREATE TO EARN'), transparent: true, toneMapped: false }),
  );
  typePlane.position.set(0, 0, 1.2);
  typeGroup.add(typePlane);
  scene.add(typeGroup);

  // --- bloom
  composer = new EffectComposer(renderer);
  composer.setSize(ctx.width, ctx.height);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector3(ctx.width, ctx.height), 0.34, 0.6, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

const CARD_POS = new Vector3(0, 0.45, 6.5);
const COIN_POS = new Vector3(0, 1.0, 7.0);
const WHEEL_POS = new Vector3(0, 0.2, 6.2);
const TYPE_POS = new Vector3(0, 0.15, 7.0);

export function render(t) {
  const cardBeat = t < 4.2;
  const coinBeat = t >= 4.2 && t < 7.6;
  const wheelBeat = t >= 7.6 && t < 10.4;

  cardGroup.visible = cardBeat;
  coinGroup.visible = coinBeat;
  wheelGroup.visible = wheelBeat;
  typeGroup.visible = t >= 10.4;

  // Camera: one slow move per beat.
  if (cardBeat) {
    camera.position.copy(CARD_POS);
    camera.position.x = Math.sin(t * 0.25) * 0.5;
    camera.position.y = 0.55 + Math.sin(t * 0.4) * 0.05;
    camera.lookAt(0, 0.02, 0);
  } else if (coinBeat) {
    camera.position.copy(COIN_POS);
    camera.position.y = 1.0 - ease((t - 4.2) / 3.2) * 0.5;
    camera.lookAt(0, -0.4, 0);
  } else if (wheelBeat) {
    camera.position.copy(WHEEL_POS);
    camera.position.x = Math.sin((t - 7.6) * 0.3) * 0.4;
    camera.lookAt(0, 0.05, 0);
  } else {
    camera.position.copy(TYPE_POS);
    camera.lookAt(0, 0.15, 0);
  }

  for (const item of falling) {
    const k = clamp01((t - item.delay) / 0.55);
    item.coin.position.y = lerp(item.from, item.restY, ease(k));
    item.coin.visible = k > 0;
    item.coin.rotation.z = (1 - k) * 2.4;
  }

  if (wheelBeat) {
    const spin = ease((t - 7.6) / 2.2);
    const winner = 3;
    const settle = -Math.PI / 2 - ((winner + 0.5) / 12) * Math.PI * 2;
    wheelMesh.rotation.z = settle - Math.PI * 2 * 2.4 * (1 - spin);
    pointer.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
  }

  if (!cardBeat && !coinBeat && !wheelBeat) {
    typeGroup.rotation.y = Math.sin(t * 0.5) * 0.06;
  }

  composer.render();
}
