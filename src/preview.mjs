// Standalone preview: player + scene strip + read-only element inspector.
// Same kernel the capture script uses — if it looks right here, it exports right.

import { mountMotion } from './mount.mjs';
import { createComments } from './ui/comments.mjs';

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
const popover = $('popover');
const popT = $('popT');
const popText = $('popText');
const popSend = $('popSend');
const popSubmit = $('popSubmit');
const popClose = $('popClose');
const threadsEl = $('threads');
const threadCount = $('threadCount');
const knobsEl = $('knobs');
const knobList = $('knobList');
const knobScene = $('knobScene');
const knobNote = $('knobNote');
const undoBtn = $('undo');

const dpr = Math.min(2, window.devicePixelRatio || 1);
const { timeline, kernel } = await mountMotion({ canvas, dpr });

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
  buildKnobs(scene);
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

// --- params: dragging changes the frame now, releasing writes the file ---
let knobOwner = null;
let latestSnapshot = null;

function fmtKnob(value, step) {
  const decimals = Math.min(3, String(step).split('.')[1]?.length ?? 2);
  return value.toFixed(decimals);
}

async function refreshHistory() {
  try {
    const { snapshots } = await (await fetch('./api/history')).json();
    latestSnapshot = snapshots[0]?.id ?? null;
    undoBtn.disabled = !latestSnapshot;
    undoBtn.textContent = latestSnapshot ? `回退（${snapshots.length}）` : '回退';
  } catch {
    latestSnapshot = null;
    undoBtn.disabled = true;
  }
}

async function persistParam(sceneId, key, value) {
  try {
    const res = await fetch('./api/params', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scene: sceneId, key, value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    knobNote.textContent = `已保存 · 快照 ${data.snapshot.id.slice(25)}`;
    await refreshHistory();
  } catch (err) {
    knobNote.textContent = `保存失败：${err.message}`;
  }
}

function buildKnobs(scene, { force = false } = {}) {
  if (!force && knobOwner === scene.id) return;
  knobOwner = scene.id;
  const rows = kernel.describe().scenes.find((s) => s.id === scene.id)?.params ?? [];
  knobList.replaceChildren();
  knobsEl.hidden = rows.length === 0;
  knobScene.textContent = scene.name;

  for (const row of rows) {
    const label = document.createElement('label');
    label.className = 'knob';

    const head = document.createElement('span');
    head.className = 'knob-head';
    const name = document.createElement('span');
    name.textContent = row.label;
    const out = document.createElement('output');
    out.textContent = fmtKnob(row.value, row.step);
    head.append(name, out);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(row.min);
    input.max = String(row.max);
    input.step = String(row.step);
    input.value = String(row.value);
    input.dataset.key = row.key;
    input.addEventListener('input', () => {
      const value = Number(input.value);
      out.textContent = fmtKnob(value, row.step);
      kernel.setParam(scene.id, row.key, value);
      kernel.renderAt(t);
      knobNote.textContent = '未保存';
    });
    input.addEventListener('change', () => persistParam(scene.id, row.key, Number(input.value)));

    label.append(head, input);
    knobList.append(label);
  }

  knobNote.textContent = rows.length ? '拖动即时生效，松手写入 timeline.json。' : '这一幕没有可调参数。';
}

undoBtn.addEventListener('click', async () => {
  if (!latestSnapshot) return;
  try {
    const res = await fetch('./api/history/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: latestSnapshot }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    kernel.reload(data.timeline);
    kernel.renderAt(t);
    buildKnobs(currentScene(t), { force: true });
    await refreshHistory();
    knobNote.textContent = '已回退到上一版。';
  } catch (err) {
    knobNote.textContent = `回退失败：${err.message}`;
  }
});

const comments = createComments({
  canvas,
  box,
  selection,
  popover,
  popT,
  popText,
  popSend,
  popSubmit,
  popClose,
  threadsEl,
  threadCount,
  timeline,
  kernel,
  fmt,
  getTime: () => t,
  onSeek: (next) => {
    setTime(next);
    renderFrame();
  },
  onClearSelection: () => {
    selected = null;
  },
  onError: (message) => {
    inspector.innerHTML = `<p class="hint">${message}</p>`;
  },
});

canvas.addEventListener('click', (e) => {
  if (comments.consumeSuppress()) return; // that click ended a drag, not a pick
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

comments.refreshThreads();
refreshHistory();

window.__PREVIEW__ = {
  ready: true,
  time: () => t,
  setTime: (v) => {
    setTime(v);
    renderFrame();
  },
  selected: () => selected,
  audit: (t) => kernel.audit(t),
  pick: (x, y, at = t) => kernel.pick(x, y, at),
  play: () => playBtn.click(),
  scenes: timeline.scenes.map((s) => ({ id: s.id, start: s.start, length: s.length })),
  duration: total,
  boxRect: () => box.getBoundingClientRect(),
  comments: async () => (await (await fetch('./api/comments')).json()).threads,
  params: () => ({
    scene: knobOwner,
    knobs: [...knobList.querySelectorAll('input[data-key]')].map((input) => ({
      key: input.dataset.key,
      value: Number(input.value),
    })),
    status: knobNote.textContent,
  }),
  setParam: async (scene, key, value, persist = true) => {
    kernel.setParam(scene, key, value);
    kernel.renderAt(t);
    buildKnobs(currentScene(t), { force: true });
    if (persist) await persistParam(scene, key, value);
    return value;
  },
  history: async () => (await (await fetch('./api/history')).json()).snapshots,
  undo: async () => {
    undoBtn.click();
    await new Promise((r) => setTimeout(r, 200));
  },
  pixel: (x, y) => {
    const g = kernel.surface;
    const scale = g.canvas.width / timeline.width;
    const d = g.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  },
};
