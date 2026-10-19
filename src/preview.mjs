// Standalone preview: player + scene strip + read-only element inspector.
// Same kernel the capture script uses — if it looks right here, it exports right.

import { createKernel } from './kernel.mjs';
import { assertTimeline } from './validate.mjs';
import { modules } from './scenes/index.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const box = $('canvasBox');
const selection = $('selection');
const inspector = $('inspector');
const tc = $('tc');
const durEl = $('dur');
const scrub = $('scrub');
const playBtn = $('play');
const loopBtn = $('loop');
const scenesEl = $('scenes');
const playhead = $('playhead');
const sceneName = $('sceneName');
const modeEl = $('mode');

const timeline = await (await fetch('../timeline.json')).json();
try {
  const res = await fetch('../out/beats.json');
  if (res.ok) timeline.beats = await res.json();
} catch {}

assertTimeline(timeline, modules);

const dpr = Math.min(2, window.devicePixelRatio || 1);
const kernel = createKernel({ timeline, modules });
await kernel.mountAll(canvas, { width: timeline.width, height: timeline.height, dpr });

const total = timeline.duration;
let t = 0;
let playing = false;
let looping = true;
let selected = null;
let raf = 0;
let last = 0;

const fmt = (s) => {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec.toFixed(2).padStart(5, '0')}`;
};

// scene strip
const chips = timeline.scenes.map((scene) => {
  const el = document.createElement('button');
  el.className = 'chip';
  el.dataset.scene = scene.id;
  el.style.flexGrow = String(scene.length);
  el.style.flexBasis = '0';
  el.innerHTML = `${scene.name} <span class="len">· ${scene.length.toFixed(1)}s</span>`;
  el.addEventListener('click', () => {
    setTime(scene.start + 0.001);
    renderFrame();
  });
  scenesEl.insertBefore(el, playhead);
  return { el, scene };
});

function currentScene(at) {
  return timeline.scenes.find((s) => at >= s.start && at < s.start + s.length) ?? timeline.scenes.at(-1);
}

function setTime(next) {
  t = Math.max(0, Math.min(total - 0.001, next));
  scrub.value = String(t);
  tc.textContent = fmt(t);
  playhead.style.left = `${(t / total) * 100}%`;
  const scene = currentScene(t);
  sceneName.textContent = scene.name;
  for (const { el, scene: s } of chips) el.setAttribute('aria-current', String(s.id === scene.id));
  refreshSelection();
}

function showSelection(hit) {
  selection.hidden = false;
  selection.style.left = `${(hit.x / timeline.width) * 100}%`;
  selection.style.top = `${(hit.y / timeline.height) * 100}%`;
  selection.style.width = `${(hit.w / timeline.width) * 100}%`;
  selection.style.height = `${(hit.h / timeline.height) * 100}%`;
}

function refreshSelection() {
  if (!selected) return;
  const hit = kernel.pick(selected.x + selected.w / 2, selected.y + selected.h / 2, t);
  if (!hit || hit.id !== selected.id) {
    selected = null;
    selection.hidden = true;
    inspector.innerHTML = '<p class="hint">该时刻这个元素不可见。再点一次画面里的元素试试。</p>';
    return;
  }
  selected = hit;
  showSelection(hit);
  inspector.innerHTML = `
    <div class="row"><span>id</span><strong>${hit.id}</strong></div>
    <div class="row"><span>t</span><span>${hit.at.toFixed(2)}s</span></div>
    <div class="row"><span>x / y</span><span>${hit.x} , ${hit.y}</span></div>
    <div class="row"><span>w × h</span><span>${hit.w} × ${hit.h}</span></div>
    <div class="row"><span>label</span><span>${hit.label ?? '—'}</span></div>`;
}

function renderFrame() {
  kernel.renderAt(t);
  setTime(t);
}

function tick(now) {
  if (!playing) return;
  if (!last) last = now;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  let next = t + dt;
  if (next >= total) {
    if (looping) next = 0;
    else {
      next = total - 0.001;
      playing = false;
      updatePlayButton();
    }
  }
  t = next;
  kernel.renderAt(t);
  setTime(t);
  if (playing) raf = requestAnimationFrame(tick);
}

function updatePlayButton() {
  playBtn.textContent = playing ? '⏸' : '▶';
  modeEl.textContent = playing ? 'playing' : 'paused';
}

playBtn.addEventListener('click', () => {
  playing = !playing;
  last = 0;
  updatePlayButton();
  if (playing) raf = requestAnimationFrame(tick);
  else cancelAnimationFrame(raf);
});

loopBtn.addEventListener('click', () => {
  looping = !looping;
  loopBtn.setAttribute('aria-pressed', String(looping));
});

scrub.max = String(total);
scrub.addEventListener('input', () => {
  t = Number(scrub.value);
  kernel.renderAt(t);
  setTime(t);
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * timeline.width;
  const y = ((e.clientY - rect.top) / rect.height) * timeline.height;
  const hit = kernel.pick(x, y, t);
  if (!hit) {
    selected = null;
    selection.hidden = true;
    inspector.innerHTML = '<p class="hint">这里没有元素。点卡片或时间轴上的圆点。</p>';
    return;
  }
  selected = hit;
  refreshSelection();
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    playBtn.click();
  } else if (e.code === 'ArrowRight') {
    setTime(t + 1 / (timeline.fps ?? 30));
    renderFrame();
  } else if (e.code === 'ArrowLeft') {
    setTime(t - 1 / (timeline.fps ?? 30));
    renderFrame();
  }
});

durEl.textContent = fmt(total);
scrub.max = String(total);
updatePlayButton();
renderFrame();

window.__PREVIEW__ = {
  ready: true,
  time: () => t,
  setTime: (v) => {
    setTime(v);
    renderFrame();
  },
  selected: () => selected,
  play: () => playBtn.click(),
  scenes: timeline.scenes.map((s) => ({ id: s.id, start: s.start, length: s.length })),
  duration: total,
  boxRect: () => box.getBoundingClientRect(),
};
