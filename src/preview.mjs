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
const playBtn = $('play');
const loopBtn = $('loop');
const scenesEl = $('scenes');
const playhead = $('playhead');
const sceneName = $('sceneName');
const modeEl = $('mode');
const popover = $('popover');
const popT = $('popT');
const popText = $('popText');
const popSubmit = $('popSubmit');
const popClose = $('popClose');
const threadsEl = $('threads');
const threadCount = $('threadCount');
const assetsEl = $('assets');
const assetList = $('assetList');
const assetScope = $('assetScope');
const assetNote = $('assetNote');
const staleEl = $('stale');
const projectScope = $('projectScope');
const projectPick = $('projectPick');
const projectTemplate = $('projectTemplate');
const projectName = $('projectName');
const projectCreate = $('projectCreate');
const projectNote = $('projectNote');
const exportOpen = $('exportOpen');
const exportModal = $('exportModal');
const exportClose = $('exportClose');
const exportCancel = $('exportCancel');
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
const params = new URLSearchParams(location.search);
const requested = params.get('timeline');
// The host tells the panel which session it belongs to; without it the panel is
// a standalone preview and cannot speak.
// The host mounts this page under /p/<session>/…; standalone has neither.
const sessionId =
  params.get('session') ??
  (() => {
    const hit = /\/p\/([^/]+)\//.exec(location.pathname);
    return hit ? decodeURIComponent(hit[1]) : '';
  })();
const target = requested && /^(\.\/|\/plugins\/dsh-motion\/)/.test(requested) ? requested : null;
const body = (payload) => JSON.stringify(target ? { ...payload, timeline: target } : payload);

const dpr = Math.min(2, window.devicePixelRatio || 1);

/**
 * A workspace with no film is a normal state, not an error: the panel says so
 * and points at the conversation, which is where a film gets asked for.
 */
function showEmptyFilm() {
  document.querySelector('.app')?.remove();
  document.querySelector('.timeline')?.remove();
  const empty = document.createElement('div');
  empty.className = 'empty-film';
  empty.innerHTML = `
    <div class="empty-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" focusable="false">
        <path d="M9 7.5v9l7.5-4.5z" fill="currentColor" />
      </svg>
    </div>
    <h2>这个工作区还没有片子</h2>
    <p>在对话里告诉 agent 你想做什么。它会在工作区的 <code>motion/</code> 里建一条，画面会出现在这里。</p>`;
  document.body.append(empty);
  document.body.dataset.empty = 'film';

  // The film can appear while this page is open — the agent is often still
  // working when the column is opened. Watch for it instead of waiting for a
  // manual refresh.
  const timer = setInterval(async () => {
    try {
      const res = await fetch('./timeline.json', { cache: 'no-store' });
      if (res.ok) {
        clearInterval(timer);
        location.reload();
      }
    } catch {
      /* the host may be restarting; try again next tick */
    }
  }, 2000);
}

let mounted;
try {
  mounted = await mountMotion({ canvas, dpr });
} catch (error) {
  if (error?.code !== 'NO_FILM') throw error;
  showEmptyFilm();
  // Stop this module here: everything below expects a film to exist.
  await new Promise(() => {});
}
const { kernel } = mounted;
let timeline = mounted.timeline;

let total = timeline.duration;
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

// scene strip — rebuilt whenever the film's structure changes, because a scene
// that got shorter moves every scene after it
let chips = [];

function buildChips(scenes) {
  for (const { el } of chips) el.remove();
  chips = scenes.map((scene) => {
    const el = document.createElement('div');
    el.className = 'chip';
    el.dataset.scene = scene.id;
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.style.flexGrow = String(scene.length);
    el.style.flexBasis = '0';
    el.innerHTML = `<span class="chip-label">${scene.name} <span class="len">· ${scene.length.toFixed(1)}s</span></span>
      <button class="chip-more" aria-label="这一段的操作" title="这一段的操作">⋯</button>`;
    el.addEventListener('click', (e) => {
      if (e.target.closest('.chip-more')) return;
      if (suppressChip) {
        suppressChip = false;
        return;
      }
      setTime(scene.start + 0.001);
      renderFrame();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      setTime(scene.start + 0.001);
      renderFrame();
    });
    el.querySelector('.chip-more').addEventListener('click', (e) => {
      e.stopPropagation();
      openChipMenu(scene, el);
    });
    scenesEl.insertBefore(el, playhead);
    return { el, scene };
  });
}

buildChips(timeline.scenes);

/** Take a reloaded timeline: the clock, the strip and the duration all follow. */
function adoptTimeline(next) {
  timeline = next;
  total = next.duration;
  durEl.textContent = fmt(total);
  if (t > total - 0.001) t = Math.max(0, total - 0.001);
  buildChips(next.scenes);
  setTime(t);
}

// Per-scene menu: lives in the strip, opens above the chip that owns it.
const chipMenu = document.createElement('div');
chipMenu.className = 'chip-menu';
chipMenu.hidden = true;
scenesEl.append(chipMenu);

function closeChipMenu() {
  chipMenu.hidden = true;
}

function openChipMenu(scene, chipEl) {
  hoverFrame.hidden = true;
  hoverAt = -1;
  chipMenu.innerHTML = `
    <p class="chip-menu-name">${scene.name}</p>
    <button id="chipDelete" type="button">删除这一段</button>`;
  chipMenu.hidden = false;
  const left = Math.min(
    Math.max(chipEl.offsetLeft + chipEl.offsetWidth - chipMenu.offsetWidth, 0),
    scenesEl.clientWidth - chipMenu.offsetWidth,
  );
  chipMenu.style.left = `${left}px`;
  chipMenu.querySelector('#chipDelete').addEventListener('click', async (e) => {
    e.stopPropagation();
    closeChipMenu();
    try {
      const res = await fetch('./api/scene', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body({ scene: scene.id, delete: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      kernel.reload(data.timeline);
      adoptTimeline(data.timeline);
    } catch (err) {
      sceneNote.textContent = `删除失败：${err.message}`;
    }
  });
}

window.addEventListener('pointerdown', (e) => {
  if (!chipMenu.hidden && !e.target.closest('.chip-menu') && !e.target.closest('.chip-more')) closeChipMenu();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeChipMenu();
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
  tc.textContent = fmt(t);
  playhead.style.left = `${(t / total) * 100}%`;
  const scene = currentScene(t);
  sceneName.textContent = scene.name;
  for (const { el, scene: s } of chips) {
    el.setAttribute('aria-current', String(s.id === scene.id));
    // Keep the playing scene visible in a strip that scrolls.
    if (s.id === scene.id) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
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
  // With a score, the audio IS the clock: frame-stepping from rAF alone drifts
  // against it within seconds. Without one, the accumulator is the clock.
  let next = sound && !sound.paused ? sound.currentTime - audioOffset : t + dt;
  if (next < 0) next = 0;
  if (next >= total) {
    if (looping) {
      next = 0;
      soundSeek(0);
    }
    else {
      next = total - 0.001;
      playing = false;
      soundPause();
      updatePlayButton();
    }
  }
  t = next;
  kernel.renderAt(t);
  setTime(t);
  if (playing) raf = requestAnimationFrame(tick);
}

// The film may carry a score. Playback is frame-stepped, so the audio is not
// "the video's soundtrack" — it is a track kept in sync with the same clock.
const audioOffset = Number(timeline.audio?.start ?? 0);
const sound = timeline.audio?.src
  ? new Audio(new URL(timeline.audio.src, location.href).href)
  : null;
if (sound) sound.preload = 'auto';

const muteBtn = $('mute');
const volume = $('volume');

function setMuted(muted) {
  if (!sound) return;
  sound.muted = muted;
  $('muteWaves').style.display = muted ? 'none' : 'inline';
  $('muteSlash').style.display = muted ? 'inline' : 'none';
  muteBtn?.setAttribute('aria-pressed', String(muted));
  muteBtn?.setAttribute('aria-label', muted ? '取消静音' : '静音');
}

if (sound) {
  sound.volume = Number(volume?.value ?? 0.8);
  setMuted(false);
  muteBtn?.addEventListener('click', () => setMuted(!sound.muted));
  volume?.addEventListener('input', () => {
    sound.volume = Number(volume.value);
    if (sound.volume > 0 && sound.muted) setMuted(false);
  });
} else {
  if (muteBtn) muteBtn.hidden = true;
  if (volume) volume.hidden = true;
}

function soundSeek(at) {
  if (!sound) return;
  const next = Math.max(0, at + audioOffset);
  if (Math.abs(sound.currentTime - next) > 0.05) sound.currentTime = next;
}

function soundPlay() {
  if (!sound) return;
  soundSeek(t);
  sound.play().catch(() => {
    /* the browser may refuse before a gesture; the next play click retries */
  });
}

function soundPause() {
  sound?.pause();
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
  if (playing) {
    raf = requestAnimationFrame(tick);
    soundPlay();
  } else {
    cancelAnimationFrame(raf);
    soundPause();
  }
});

loopBtn.addEventListener('click', () => {
  looping = !looping;
  loopBtn.setAttribute('aria-pressed', String(looping));
});


// --- live changes: the agent writes the same files this panel reads ---
// Data can be applied in place; code cannot, because the browser caches the
// module, so that case only raises a banner.
const timelineSrc = target ?? './timeline.json';
let revision = null;

const dataOnly = (value) => JSON.stringify({ ...value, beats: undefined });

async function pollRevision() {
  try {
    const query = target ? `?timeline=${encodeURIComponent(target)}` : '';
    const res = await fetch(`./api/revision${query}`, { cache: 'no-store' });
    if (!res.ok) return;
    const next = await res.json();
    if (!revision) {
      // First contact: if the file already moved between mount and now, apply it
      // too — otherwise that edit would be silently adopted as the baseline.
      revision = next;
      const latest = await (await fetch(timelineSrc, { cache: 'no-store' })).json();
      if (dataOnly(latest) !== dataOnly(kernel.timeline)) {
        kernel.reload(latest);
        kernel.renderAt(t);
        adoptTimeline(latest);
      }
      return;
    }

    if (next.tree !== revision.tree) staleEl.hidden = false;
    if (next.timeline === revision.timeline) return;

    // Never overwrite a field someone is typing into: try again next tick.
    const active = document.activeElement;
    if (active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName)) return;

    revision = next;
    const latest = await (await fetch(timelineSrc, { cache: 'no-store' })).json();
    if (dataOnly(latest) === dataOnly(kernel.timeline)) return; // our own write
    kernel.reload(latest);
    kernel.renderAt(t);
    adoptTimeline(latest);
  } catch {
    /* the host may be restarting */
  }
}

pollRevision();
setInterval(pollRevision, 2000);
$('staleReload').addEventListener('click', () => location.reload());

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
const segValue = (field) =>
  document.querySelector(`.seg[data-field="${field}"] button[aria-pressed="true"]`)?.dataset.value;

for (const field of ['format', 'height', 'fps', 'quality']) {
  for (const button of document.querySelectorAll(`.seg[data-field="${field}"] button`)) {
    button.addEventListener('click', () => {
      for (const other of button.parentElement.children) other.setAttribute('aria-pressed', String(other === button));
      syncExportEstimate();
    });
  }
}

function syncExportEstimate() {
  const fps = Number(segValue('fps') ?? 60);
  const height = Number(segValue('height') ?? 1080);
  const quality = segValue('quality') ?? 'high';
  const gif = (segValue('format') ?? 'mp4') === 'gif';
  const ss = expSs.checked ? 2 : 1;
  // Measured on this film's own exports (1080p, high): ~0.15 MB/s at 60fps.
  const rate =
    0.15 *
    (height / 1080) ** 1.4 *
    (fps / 60) *
    ({ high: 1, medium: 0.62, low: 0.38 }[quality] ?? 1) *
    (gif ? 1.6 : ss === 2 ? 1.35 : 1);
  const mb = Math.max(0.1, total * rate);
  const secs = Math.round(total * (fps / 60) * (height / 1080) ** 1.2 * (ss === 2 ? 2.2 : 1) * 0.6);
  expEstimate.textContent = `约 ${mb.toFixed(1)} MB · 约 ${secs} 秒`;
}

expSs.addEventListener('change', syncExportEstimate);

const setExportOpen = (open) => {
  exportModal.hidden = !open;
  if (open) {
    syncExportEstimate();
    expResult.textContent = '';
  }
};

exportOpen.addEventListener('click', () => setExportOpen(true));
exportClose.addEventListener('click', () => setExportOpen(false));
exportCancel.addEventListener('click', () => setExportOpen(false));
exportModal.addEventListener('click', (e) => {
  if (e.target === exportModal) setExportOpen(false);
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !exportModal.hidden) setExportOpen(false);
});

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
        format: segValue('format') ?? 'mp4',
        fps: Number(segValue('fps') ?? 60),
        height: Number(segValue('height') ?? 1080),
        quality: segValue('quality') ?? 'high',
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
  const sceneIndex = timeline.scenes.findIndex((s) => s.id === scene.id) + 1;
  sceneCardName.textContent = `${sceneIndex} / ${timeline.scenes.length}`;
  if (document.activeElement !== sceneNameInput) sceneNameInput.value = scene.name;
  sceneLen.value = String(scene.length);
  sceneSpeed.value = String(scene.speed ?? 1);
}

function buildScene(scene) {
  if (sceneKey === scene.id) return;
  sceneKey = scene.id;
  syncSceneFields(scene);
}

const prevSceneBtn = $('prevScene');
const nextSceneBtn = $('nextScene');
const sceneNameInput = $('sceneNameInput');

const sceneIndexAt = (at) => timeline.scenes.findIndex((s) => s.id === currentScene(at).id);

prevSceneBtn?.addEventListener('click', () => {
  const i = sceneIndexAt(t);
  if (i > 0) {
    setTime(timeline.scenes[i - 1].start + 0.001);
    renderFrame();
  }
});

nextSceneBtn?.addEventListener('click', () => {
  const i = sceneIndexAt(t);
  if (i >= 0 && i < timeline.scenes.length - 1) {
    setTime(timeline.scenes[i + 1].start + 0.001);
    renderFrame();
  }
});

// Renaming is local to the document: no reflow, so no reload.
sceneNameInput?.addEventListener('change', async () => {
  const scene = currentScene(t);
  const name = sceneNameInput.value.trim();
  if (!name || name === scene.name) {
    sceneNameInput.value = scene.name;
    return;
  }
  try {
    const res = await fetch('./api/scene', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ scene: scene.id, name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    scene.name = data.scene.name;
    const chip = chips.find((c) => c.scene.id === scene.id);
    if (chip) chip.el.innerHTML = `${data.scene.name} <span class="len">· ${data.scene.length.toFixed(1)}s</span>`;
    sceneName.textContent = data.scene.name;
  } catch (err) {
    sceneNote.textContent = `改名失败：${err.message}`;
    sceneNameInput.value = scene.name;
  }
});

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
  textScope.textContent = '';

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
    undoBtn.textContent = '回退';
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
  session: sessionId,
});

// Two modes the human switches on, the way the reference does: the rail is a
// door (Tweaks), and annotating is a mode (click an object, no drag needed).
const tweaksBtn = $('tweaksToggle');
const commentBtn = $('commentMode');

function setTweaks(on) {
  document.body.classList.toggle('tweaks', on);
  tweaksBtn?.setAttribute('aria-pressed', String(on));
  try {
    localStorage.setItem('dshm:tweaks', on ? '1' : '0');
  } catch {
    /* private mode */
  }
}

let storedTweaks = '1';
try {
  storedTweaks = localStorage.getItem('dshm:tweaks') ?? '0';
} catch {
  /* private mode */
}
setTweaks(storedTweaks === '1');
tweaksBtn?.addEventListener('click', () => setTweaks(!document.body.classList.contains('tweaks')));

commentBtn?.addEventListener('click', () => {
  const on = !document.body.classList.contains('commenting');
  document.body.classList.toggle('commenting', on);
  commentBtn.setAttribute('aria-pressed', String(on));
});

canvas.addEventListener('click', (e) => {
  if (comments.consumeSuppress()) return; // that click ended a drag, not a pick
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * timeline.width;
  const y = ((e.clientY - rect.top) / rect.height) * timeline.height;
  const hit = kernel.pick(x, y, t);

  // In annotate mode a plain click is enough: annotate the object under the
  // pointer, or the spot itself when nothing is there.
  if (document.body.classList.contains('commenting')) {
    comments.annotateAt(hit ? { x: hit.x, y: hit.y, w: hit.w, h: hit.h } : { x: x - 60, y: y - 30, w: 120, h: 60 });
    return;
  }
  if (!hit) {
    selected = null;
    selection.hidden = true;
    inspector.innerHTML = '<p class="hint">这里没有元素。点卡片或时间轴上的圆点。</p>';
    return;
  }
  selected = hit;
  refreshSelection();
  if (hit.slot) {
    // Clicking a word is a request to edit it: open the rail if it is closed,
    // so the field it focuses is actually visible.
    if (!document.body.classList.contains('tweaks')) setTweaks(true);
    const input = textList.querySelector(`input[data-text-scene="${currentScene(t).id}"][data-text-slot="${hit.slot}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  }
});

// --- fullscreen ---
const fullscreenBtn = $('fullscreen');
fullscreenBtn?.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    /* the host may not grant it to an embedded frame */
  }
});
document.addEventListener('fullscreenchange', () => {
  fullscreenBtn?.setAttribute('aria-pressed', String(!!document.fullscreenElement));
});

// --- hovering the strip peeks at that frame ---
const hoverFrame = $('hoverFrame');
const hoverCanvas = $('hoverCanvas');
const hoverTime = $('hoverTime');
const hoverCtx = hoverCanvas.getContext('2d');
let hoverRaf = 0;
let hoverAt = -1;

function paintHover(at, clientX) {
  if (Math.abs(at - hoverAt) > 0.05) {
    // Draw the peek frame, copy it out, then restore the frame the transport is on.
    kernel.renderAt(at);
    hoverCtx.clearRect(0, 0, hoverCanvas.width, hoverCanvas.height);
    hoverCtx.drawImage(canvas, 0, 0, hoverCanvas.width, hoverCanvas.height);
    kernel.renderAt(t);
    hoverAt = at;
  }
  hoverTime.textContent = fmt(at);
  const rect = scenesEl.getBoundingClientRect();
  const card = hoverFrame.getBoundingClientRect();
  const left = Math.min(Math.max(clientX - rect.left - card.width / 2, 0), rect.width - card.width);
  hoverFrame.style.left = `${left}px`;
  hoverFrame.hidden = false;
}

scenesEl.addEventListener('pointermove', (e) => {
  if (stripDrag || playing || !chipMenu.hidden) {
    hoverFrame.hidden = true;
    return;
  }
  const rect = scenesEl.getBoundingClientRect();
  const at = Math.min(total - 0.001, Math.max(0, ((e.clientX - rect.left) / rect.width) * total));
  const x = e.clientX;
  if (hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0;
    paintHover(at, x);
  });
});

scenesEl.addEventListener('pointerleave', () => {
  hoverFrame.hidden = true;
  hoverAt = -1;
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
  revision: () => revision,
  stale: () => !staleEl.hidden,
  assets: () => kernel.assets(),
  setAssetSrc: async (name, src) => {
    kernel.timeline.assets[name].src = src;
    await kernel.reloadAssets();
    kernel.renderAt(t);
    refreshAssets();
  },
  pick: (x, y, at = t) => kernel.pick(x, y, at),
  // Same path the popover uses: store the pin, then say it in the conversation.
  comment: (payload) => comments.addComment(payload),
  session: () => sessionId,
  sound: () =>
    sound ? { src: sound.src, at: sound.currentTime, paused: sound.paused, muted: sound.muted, volume: sound.volume } : null,
  play: () => playBtn.click(),
  scenes: timeline.scenes.map((s) => ({ id: s.id, start: s.start, length: s.length })),
  get duration() {
    return total;
  },
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
