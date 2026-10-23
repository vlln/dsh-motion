// Standalone preview: player + scene strip + read-only element inspector.
// Same kernel the capture script uses — if it looks right here, it exports right.

import { mountMotion } from './mount.mjs';
import { createComments } from './ui/comments.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const box = $('canvasBox');
const selection = $('selection');
const slotHl = $('slotHl');
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
const assetsEl = $('assets');
const assetList = $('assetList');
const assetScope = $('assetScope');
const assetNote = $('assetNote');
const projectScope = $('projectScope');
const projectPick = $('projectPick');
const projectTemplate = $('projectTemplate');
const projectName = $('projectName');
const projectCreate = $('projectCreate');
const projectNote = $('projectNote');
const exportScope = $('exportScope');
const expFormat = $('expFormat');
const expFps = $('expFps');
const expSs = $('expSs');
const expEstimate = $('expEstimate');
const expRun = $('expRun');
const expResult = $('expResult');
const sceneCardName = $('sceneCardName');
const sceneLen = $('sceneLen');
const sceneSpeed = $('sceneSpeed');
const sceneNote = $('sceneNote');
const textsEl = $('texts');
const textList = $('textList');
const textScope = $('textScope');
const textNote = $('textNote');
const knobsEl = $('knobs');
const knobList = $('knobList');
const knobScene = $('knobScene');
const knobNote = $('knobNote');
const undoBtn = $('undo');

// If this page was opened with ?timeline=, writes must land in that same file.
const requested = new URLSearchParams(location.search).get('timeline');
const target = requested && /^(\.\/|\/plugins\/dsh-motion\/)/.test(requested) ? requested : null;
const body = (payload) => JSON.stringify(target ? { ...payload, timeline: target } : payload);

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
    if (suppressChip) {
      suppressChip = false;
      return;
    }
    setTime(scene.start + 0.001);
    renderFrame();
  });
  scenesEl.insertBefore(el, playhead);
  return { el, scene };
});

// Dragging anywhere on the strip scrubs; a click without movement still jumps
// to that scene's start (the chip handler), so suppress that click after a drag.
let stripDrag = null;
let suppressChip = false;

function timeFromStrip(clientX, rect) {
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  return ratio * (total - 0.001);
}

function currentScene(at) {
  return timeline.scenes.find((s) => at >= s.start && at < s.start + s.length) ?? timeline.scenes.at(-1);
}

scenesEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  // A new press always starts a fresh gesture: clear any pending suppression so a
  // plain click after a drag still seeks.
  suppressChip = false;
  stripDrag = { x: e.clientX, moved: false, rect: scenesEl.getBoundingClientRect() };
});

scenesEl.addEventListener('pointermove', (e) => {
  if (!stripDrag) return;
  if (!stripDrag.moved && Math.abs(e.clientX - stripDrag.x) < 3) return;
  stripDrag.moved = true;
  const next = timeFromStrip(e.clientX, stripDrag.rect);
  setTime(next);
  kernel.renderAt(next);
});

window.addEventListener('pointerup', () => {
  if (stripDrag?.moved) suppressChip = true;
  stripDrag = null;
});

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
  buildScene(scene);
  syncExportEstimate();
  refreshTexts();
  refreshAssets();
}

// Outline whatever the focused field edits, so "this input" and "that box" are one thing.
let hlTimer = 0;
function highlightRect(rect, ms = 0) {
  clearTimeout(hlTimer);
  if (!rect || rect.w <= 0 || rect.h <= 0) {
    slotHl.hidden = true;
    return;
  }
  slotHl.hidden = false;
  slotHl.style.left = `${(rect.x / timeline.width) * 100}%`;
  slotHl.style.top = `${(rect.y / timeline.height) * 100}%`;
  slotHl.style.width = `${(rect.w / timeline.width) * 100}%`;
  slotHl.style.height = `${(rect.h / timeline.height) * 100}%`;
  if (ms) hlTimer = setTimeout(() => (slotHl.hidden = true), ms);
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
  const icon = playBtn.querySelector('.i-play');
  const pause = playBtn.querySelector('.i-pause');
  // `hidden` is an HTML attribute; on SVG paths it does nothing, so both icons
  // would paint on top of each other.
  if (icon && pause) {
    icon.style.display = playing ? 'none' : 'inline';
    pause.style.display = playing ? 'inline' : 'none';
  }
  playBtn.setAttribute('aria-label', playing ? 'pause' : 'play');
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

// --- projects: switch files, or seed a new one from a template ---
const currentFile = (target ?? './timeline.json').replace(/^\.\//, '');

async function loadProjects() {
  try {
    const data = await (await fetch('./api/projects')).json();
    projectPick.replaceChildren();
    for (const project of data.projects) {
      const option = document.createElement('option');
      option.value = project.file;
      option.textContent = `${project.file} · ${project.scenes} 幕 · ${project.duration}s`;
      option.selected = project.file === currentFile;
      projectPick.append(option);
    }
    projectTemplate.replaceChildren();
    for (const template of data.templates) {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = `${template.title}（${template.note}）`;
      projectTemplate.append(option);
    }
    projectScope.textContent = currentFile;
  } catch {
    projectNote.textContent = '读取项目列表失败。';
  }
}

projectPick.addEventListener('change', () => {
  location.href = `?timeline=./${projectPick.value}`;
});

projectCreate.addEventListener('click', async () => {
  projectCreate.disabled = true;
  try {
    const res = await fetch('./api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: projectName.value, template: projectTemplate.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    location.href = `?timeline=./${data.file}`;
  } catch (err) {
    projectNote.textContent = `新建失败：${err.message}`;
  } finally {
    projectCreate.disabled = false;
  }
});

// --- export: the panel should be where a film leaves ---
function estimateExport() {
  const fps = Number(expFps.value);
  const ss = expSs.checked ? 2 : 1;
  const gif = expFormat.value === 'gif';
  // Rates are measured on this repo's demo (1080p, crf 18): ~0.22 MB/s at 60fps.
  const mb = gif ? 0.9 * total * (fps / 60) : 0.22 * total * (fps / 60) * (ss === 2 ? 1.15 : 1);
  const secs = Math.round(total * (fps / 60) * 1.2 * (ss === 2 ? 3.4 : 1));
  return `约 ${mb.toFixed(1)} MB · 约 ${secs} 秒`;
}

function syncExportEstimate() {
  // The summary is what you see while the card is folded, so it carries the
  // price of the export rather than the frame rate.
  exportScope.textContent = estimateExport();
  expEstimate.textContent = `${total.toFixed(1)}s · ${expFps.value}fps · 估算按示例片实测速率`;
}

expFps.addEventListener('change', syncExportEstimate);
expFormat.addEventListener('change', syncExportEstimate);
expSs.addEventListener('change', syncExportEstimate);

expRun.addEventListener('click', async () => {
  expRun.disabled = true;
  const started = Date.now();
  const tick = setInterval(() => {
    expResult.textContent = `渲染中… ${Math.round((Date.now() - started) / 1000)}s`;
  }, 500);
  try {
    const res = await fetch('./api/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({
        format: expFormat.value,
        fps: Number(expFps.value),
        supersample: expSs.checked ? 2 : 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    expResult.textContent = `完成 · ${data.path} · ${(data.bytes / 1e6).toFixed(1)} MB · ${(data.ms / 1000).toFixed(0)}s`;
  } catch (err) {
    expResult.textContent = `导出失败：${err.message}`;
  } finally {
    clearInterval(tick);
    expRun.disabled = false;
  }
});

// --- scene level: length and speed (structural, so the shell reloads) ---
let sceneKey = '';

async function persistScene(patch) {
  const scene = currentScene(t);
  try {
    const res = await fetch('./api/scene', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ scene: scene.id, ...patch }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    sceneNote.textContent = `已保存 · 总时长 ${data.duration}s，正在刷新…`;
    setTimeout(() => location.reload(), 350);
  } catch (err) {
    sceneNote.textContent = `保存失败：${err.message}`;
    syncSceneFields(scene);
  }
}

function syncSceneFields(scene) {
  sceneCardName.textContent = scene.name;
  sceneLen.value = String(scene.length);
  sceneSpeed.value = String(scene.speed ?? 1);
}

function buildScene(scene) {
  if (sceneKey === scene.id) return;
  sceneKey = scene.id;
  syncSceneFields(scene);
}

sceneLen.addEventListener('change', () => persistScene({ length: Number(sceneLen.value) }));
sceneSpeed.addEventListener('change', () => persistScene({ speed: Number(sceneSpeed.value) }));

// --- on-screen assets: repoint an image at another file, live ---
let assetKey = '';

async function persistAsset(name, src) {
  try {
    const res = await fetch('./api/assets', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ name, src }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    kernel.timeline.assets[name].src = data.src;
    await kernel.reloadAssets();
    kernel.renderAt(t);
    assetNote.textContent = `已保存 · 快照 ${data.snapshot.id.slice(25)}`;
    await refreshHistory();
    refreshAssets();
  } catch (err) {
    assetNote.textContent = `保存失败：${err.message}`;
  }
}

async function persistRebake(name, src) {
  try {
    assetNote.textContent = '重烘中…';
    const res = await fetch('./api/assets/rebake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ name, src }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    kernel.timeline.assets[name].src = data.src;
    await kernel.reloadAssets();
    kernel.renderAt(t);
    assetNote.textContent = `已重烘 · ${data.manifest.count} 帧 ${data.manifest.cols}×${data.manifest.rows}`;
    refreshAssets();
  } catch (err) {
    assetNote.textContent = `重烘失败：${err.message}`;
  }
}

function refreshAssets() {
  const items = kernel.assets();
  assetsEl.hidden = items.length === 0;
  assetScope.textContent = items.length ? `${items.length} 个` : '';

  const key = items.map((item) => `${item.kind}:${item.name}`).join('|');
  if (key !== assetKey) {
    assetList.replaceChildren();
    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'asset-row';

      const name = document.createElement('span');
      name.className = 'slot';
      name.textContent = `${item.name} · ${item.kind}`;

      const line = document.createElement('div');
      line.className = 'asset-line';

      const input = document.createElement('input');
      input.value = item.src;
      input.disabled = !item.editable && !item.rebakeable;
      input.dataset.assetName = item.name;
      input.addEventListener('focus', () => highlightRect(item.box));
      input.addEventListener('blur', () => highlightRect(null));
      if (item.editable) input.addEventListener('change', () => persistAsset(item.name, input.value));

      line.append(input);
      if (item.rebakeable) {
        const bake = document.createElement('button');
        bake.className = 'btn ghost';
        bake.textContent = '重烘';
        bake.dataset.bake = item.name;
        bake.addEventListener('click', () => persistRebake(item.name, input.value));
        line.append(bake);
      }

      row.append(name, line);
      assetList.append(row);
    }
    assetKey = key;
    return;
  }

  for (const input of assetList.querySelectorAll('input')) {
    if (document.activeElement === input) continue;
    const item = items.find((i) => i.name === input.dataset.assetName);
    if (item && input.value !== item.src) input.value = item.src;
  }
}

// --- on-screen text: edit what the current frame actually shows ---
let textKey = '';

async function persistValue(sceneId, key, value) {
  try {
    const res = await fetch('./api/values', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ scene: sceneId, key, value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    textNote.textContent = `已保存 · 快照 ${data.snapshot.id.slice(25)}`;
    await refreshHistory();
  } catch (err) {
    textNote.textContent = `保存失败：${err.message}`;
  }
}

async function persistText(sceneId, slot, value) {
  try {
    const res = await fetch('./api/texts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ scene: sceneId, slot, value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    textNote.textContent = `已保存 · 快照 ${data.snapshot.id.slice(25)}`;
    await refreshHistory();
  } catch (err) {
    textNote.textContent = `保存失败：${err.message}`;
  }
}

function refreshTexts() {
  const items = kernel.texts();
  textsEl.hidden = items.length === 0;
  textScope.textContent = items.length ? `${items.length} 处` : '';

  const key = items.map((item) => `${item.scene}/${item.slot}`).join('|');
  if (key !== textKey) {
    textList.replaceChildren();
    for (const item of items) {
      const isValue = item.kind === 'value';
      const spec = isValue ? kernel.describeValues(item.scene).find((v) => v.key === item.key) : null;

      const row = document.createElement('label');
      row.className = 'text-row';

      const name = document.createElement('span');
      name.className = 'slot';
      name.textContent = isValue
        ? `${spec?.label ?? item.key} · 数值`
        : item.truncated
          ? `${item.slot} · 已截断`
          : item.slot;

      const input = document.createElement('input');
      input.dataset.textScene = item.scene;
      input.dataset.textSlot = item.slot;
      if (isValue) {
        input.type = 'number';
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(item.value);
        input.addEventListener('focus', () => highlightRect(item.box));
      input.addEventListener('blur', () => highlightRect(null));
      input.addEventListener('input', () => {
          kernel.setValue(item.scene, item.key, Number(input.value));
          kernel.renderAt(t);
          textNote.textContent = '未保存';
        });
        input.addEventListener('change', () => persistValue(item.scene, item.key, Number(input.value)));
      } else {
        input.value = item.text;
        input.addEventListener('focus', () => highlightRect(item.box));
        input.addEventListener('blur', () => highlightRect(null));
        input.addEventListener('input', () => {
          kernel.setText(item.scene, item.slot, input.value);
          kernel.renderAt(t);
          textNote.textContent = '未保存';
        });
        input.addEventListener('change', () => persistText(item.scene, item.slot, input.value));
      }

      row.append(name, input);
      textList.append(row);
    }
    textKey = key;
    return;
  }

  for (const input of textList.querySelectorAll('input')) {
    if (document.activeElement === input) continue;
    const item = items.find((i) => i.scene === input.dataset.textScene && i.slot === input.dataset.textSlot);
    if (!item) continue;
    const next = item.kind === 'value' ? String(item.value) : item.text;
    if (input.value !== next) input.value = next;
  }
}

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
      body: body({ scene: sceneId, key, value }),
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
      body: body({ id: latestSnapshot }),
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
  onHighlight: (rect) => highlightRect(rect, 1600),
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
  if (hit.slot) {
    const input = textList.querySelector(`input[data-text-scene="${currentScene(t).id}"][data-text-slot="${hit.slot}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  }
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
loadProjects();

window.__PREVIEW__ = {
  ready: true,
  time: () => t,
  setTime: (v) => {
    setTime(v);
    renderFrame();
  },
  selected: () => selected,
  audit: (t) => kernel.audit(t),
  texts: () => kernel.texts(),
  assets: () => kernel.assets(),
  setAssetSrc: async (name, src) => {
    kernel.timeline.assets[name].src = src;
    await kernel.reloadAssets();
    kernel.renderAt(t);
    refreshAssets();
  },
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
