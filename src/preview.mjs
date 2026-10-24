// Standalone preview: player + scene strip + annotation overlay.
// Same kernel the capture script uses — if it looks right here, it exports right.

import { mountMotion } from './mount.mjs';
import { createComments } from './ui/comments.mjs';
import { SAMPLES, CATEGORIES, LOOP_SECONDS } from './starters.mjs';
import { finish } from './look.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const box = $('canvasBox');
const selection = $('selection');
const slotHl = $('slotHl');
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
const assetsEl = $('assets');
const assetList = $('assetList');
const assetScope = $('assetScope');
const assetNote = $('assetNote');
const staleEl = $('stale');
let beatPeek = document.getElementById('beatPeek');
let beatStills = [];
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

// The artboard is width-driven, so its ceiling has to come from the stage's own
// height — otherwise a wide window lets it overflow the row and cover the reel.
const stageStack = document.querySelector('.stage-stack');
if (stageStack && 'ResizeObserver' in window) {
  const fit = () => stageStack.style.setProperty('--stage-h', `${Math.max(120, stageStack.clientHeight - 34)}px`);
  new ResizeObserver(fit).observe(stageStack);
  fit();
}

/**
 * No film yet: the workspace opens on a gallery of short loops instead of an
 * error. Each tile is a real animation (canvas 2D, pure function of time), and
 * each carries the prompt that would rebuild it — copy it, or send it to the
 * conversation and let the agent make the film for real.
 */
function showEmptyFilm() {
  document.querySelector('.app')?.remove();
  document.querySelector('.timeline')?.remove();

  const empty = document.createElement('div');
  empty.className = 'explore';
  const featured = SAMPLES.find((s) => s.featured) ?? SAMPLES[0];
  const rest = SAMPLES.filter((s) => s !== featured);
  const tile = (sample, extra = '') => `
    <button class="tile${extra}" data-id="${sample.id}" data-tag="${sample.tag}"
            aria-label="${sample.title}" style="--tile-bg:${sample.backdrop ?? sample.look.bg};--tile-ink:${sample.look.ink}">
      <span class="tile-shot" style="aspect-ratio:${sample.ratio.toFixed(4)}">
        <canvas aria-hidden="true"></canvas>
        <span class="tile-dur">0:0${LOOP_SECONDS}</span>
      </span>
      ${extra ? '' : `<span class="tile-title">${sample.title}</span>`}
    </button>`;

  empty.innerHTML = `
    <header class="explore-head">
      <h1>探索动效</h1>
      <span class="explore-count">${SAMPLES.length} 段</span>
    </header>
    ${tile(featured, ' tile-feature')}
    <nav class="explore-tabs" aria-label="动效分类">
      ${CATEGORIES.map(
        (tag, i) => `<button class="tab" data-tag="${tag}" aria-pressed="${i === 0}">${tag}</button>`,
      ).join('')}
    </nav>
    <div class="masonry">
      ${rest.map((s) => tile(s)).join('')}
    </div>
    <div class="sheet" hidden>
      <div class="sheet-dismiss" data-close></div>
      <div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <button class="sheet-x" data-close aria-label="关闭">✕</button>
        <div class="sheet-stage">
          <canvas aria-hidden="true"></canvas>
          <span class="tile-dur sheet-dur">0:0${LOOP_SECONDS}</span>
        </div>
        <div class="sheet-body">
          <h2 id="sheetTitle"></h2>
          <div class="sheet-meta">
            <span class="sheet-tag" id="sheetTag"></span>
            <span class="sheet-len">${LOOP_SECONDS}s · 循环</span>
          </div>
          <p class="sheet-prompt" id="sheetPrompt"></p>
          <div class="sheet-actions">
            <button class="btn ghost" id="sheetCopy">复制提示词</button>
            <button class="btn" id="sheetSend">让 Agent 复刻</button>
            <button class="btn" id="sheetUse" hidden>用这个样板开始</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.append(empty);
  document.body.dataset.empty = 'film';

  const tiles = [...empty.querySelectorAll('.tile')];
  const players = playTiles(empty, tiles);

  // Categories are a filter, not a new page: keep the scroll position.
  for (const tab of empty.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      for (const other of empty.querySelectorAll('.tab')) {
        other.setAttribute('aria-pressed', String(other === tab));
      }
      const tag = tab.dataset.tag;
      for (const tile of tiles) tile.hidden = tag !== '全部' && tile.dataset.tag !== tag;
      players.refresh();
    });
  }

  const sheet = empty.querySelector('.sheet');
  const sheetCanvas = sheet.querySelector('canvas');
  const sheetTitle = sheet.querySelector('#sheetTitle');
  const sheetTag = sheet.querySelector('#sheetTag');
  const sheetPrompt = sheet.querySelector('#sheetPrompt');
  const sheetCopy = sheet.querySelector('#sheetCopy');
  const sheetSend = sheet.querySelector('#sheetSend');
  const sheetUse = sheet.querySelector('#sheetUse');
  let open = null;
  let player = null;

  const stage = sheet.querySelector('.sheet-stage');

  const sizeStage = (sample) => {
    const cardW = sheet.querySelector('.sheet-card').clientWidth;
    const maxH = Math.min(window.innerHeight * 0.52, 520);
    const w = Math.max(120, Math.min(cardW, maxH * sample.ratio));
    const h = w / sample.ratio;
    stage.style.height = `${h}px`;
    sheetCanvas.style.width = `${w}px`;
    sheetCanvas.style.height = `${h}px`;
  };

  const close = () => {
    sheet.hidden = true;
    document.body.classList.remove('sheet-open');
    open = null;
    player?.stop();
    player = null;
  };

  for (const tile of tiles) {
    tile.addEventListener('click', () => {
      const sample = SAMPLES.find((s) => s.id === tile.dataset.id);
      if (!sample) return;
      open = sample;
      sheetTitle.textContent = sample.title;
      sheetTag.textContent = sample.tag;
      sheetPrompt.textContent = sample.prompt;
      sheetSend.disabled = !sessionId;
      sheetSend.textContent = sessionId ? '让 Agent 复刻' : '在对话里打开才能发送';
      sheetUse.hidden = !sample.template;
      sheetUse.disabled = false;
      sheetUse.textContent = '用这个样板开始';
      sheet.hidden = false;
      document.body.classList.add('sheet-open');
      sizeStage(sample);
      player?.stop();
      player = playOne(sheetCanvas, sample);
      sheet.querySelector('.sheet-card').focus?.();
    });
  }

  for (const closer of sheet.querySelectorAll('[data-close]')) closer.addEventListener('click', close);
  window.addEventListener('resize', () => {
    if (!open) return;
    sizeStage(open);
    player?.resize();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sheet.hidden) close();
  });

  sheetCopy.addEventListener('click', async () => {
    if (!open) return;
    try {
      await navigator.clipboard.writeText(open.prompt);
      sheetCopy.textContent = '已复制';
    } catch {
      sheetPrompt.focus();
      sheetCopy.textContent = '选中后自行复制';
    }
    setTimeout(() => (sheetCopy.textContent = '复制提示词'), 1600);
  });

  sheetUse.addEventListener('click', async () => {
    if (!open?.template) return;
    sheetUse.disabled = true;
    sheetUse.textContent = '正在建片…';
    try {
      const res = await fetch('./api/template', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: open.template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'template failed');
      sheetUse.textContent = '已创建，正在打开…';
      const next = new URL(location.href);
      next.searchParams.set('from', 'template');
      location.replace(next);
    } catch (error) {
      sheetUse.disabled = false;
      sheetUse.textContent = '没建成，再试一次';
      console.error(error);
    }
  });

  sheetSend.addEventListener('click', () => {
    if (!open || !sessionId) return;
    window.parent.postMessage(
      { type: 'dshm:comment', id: `replicate-${Date.now()}`, session: sessionId, text: open.prompt },
      location.origin,
    );
    sheetSend.textContent = '已发送';
    sheetSend.disabled = true;
    setTimeout(() => {
      sheetSend.textContent = '让 Agent 复刻';
      sheetSend.disabled = false;
    }, 2000);
  });

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

/** Size a canvas to its CSS box, once. */
function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w: rect.width, h: rect.height };
}

let threeModule;
const loadThree = () => (threeModule ??= import('three'));

/**
 * A WebGL tile: the sample brings its own scene builder, the gallery brings the
 * renderer and the clock. Same three chunk the 3D film scenes load.
 */
async function makeGL(canvas, sample) {
  const THREE = await loadThree();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  // Tiles size the canvas with CSS; the sheet has no frame height of its own,
  // so there the drawing buffer defines the box. Either way: measure first.
  const measure = () => {
    const r = canvas.getBoundingClientRect();
    return { w: Math.max(1, r.width), h: Math.max(1, r.height) };
  };
  let { w, h } = measure();
  const player = sample.build({ THREE, renderer, width: w, height: h });
  player.resize(w, h);
  return {
    render(t) {
      const now = measure();
      if (now.w > 1 && now.h > 1 && (Math.abs(now.w - w) > 0.5 || Math.abs(now.h - h) > 0.5)) {
        w = now.w;
        h = now.h;
        player.resize(w, h);
      }
      player.render(t);
    },
  };
}

/** One sample, one canvas, one clock — used by the detail sheet. */
function playOne(canvas, sample) {
  if (sample.engine === 'webgl') {
    let raf = 0;
    let start = performance.now();
    let gl = null;
    makeGL(canvas, sample).then((player) => {
      gl = player;
      const tick = (now) => {
        gl.render(((now - start) / 1000) % LOOP_SECONDS);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return {
      stop() {
        cancelAnimationFrame(raf);
      },
      seek() {},
      resize() {},
    };
  }

  let raf = 0;
  let start = performance.now();
  let paused = false;
  let shown = 0;
  let size = fitCanvas(canvas);

  const draw = (t) => {
    if (!size) size = fitCanvas(canvas);
    if (!size) return;
    size.g.clearRect(0, 0, size.w, size.h);
    sample.draw(size.g, size.w, size.h, t);
    finish(size.g, size.w, size.h, t, sample.look);
  };

  const tick = (now) => {
    const rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width - (size?.w ?? 0)) > 1 || Math.abs(rect.height - (size?.h ?? 0)) > 1) {
      size = fitCanvas(canvas);
    }
    shown = ((now - start) / 1000) % LOOP_SECONDS;
    draw(shown);
    raf = requestAnimationFrame(tick);
  };
  draw(0);
  if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(raf);
      raf = 0;
    },
    seek(t) {
      shown = t;
      draw(t);
    },
    resize() {
      size = fitCanvas(canvas);
      draw(shown);
    },
    get paused() {
      return paused;
    },
  };
}

/**
 * One clock drives every tile: the samples run in sync, off-screen ones sleep,
 * a hidden tab sleeps, and reduced motion gets the settled frame.
 */
function playTiles(root, tiles) {
  const items = tiles.map((tile) => ({
    tile,
    sample: SAMPLES.find((s) => s.id === tile.dataset.id),
    canvas: tile.querySelector('canvas'),
    g: null,
    gl: null,
    w: 0,
    h: 0,
    on: true,
  }));

  // The 3D study loads three (~1.6 MB) — only when its tile is actually seen.
  const wake = (item) => {
    if (item.sample.engine !== 'webgl' || item.gl || item.waking) return;
    item.waking = true;
    makeGL(item.canvas, item.sample).then((player) => {
      item.gl = player;
    });
  };

  const measure = () => {
    for (const item of items) {
      if (item.sample.engine === 'webgl') continue;
      const rect = item.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      item.canvas.width = Math.round(rect.width * dpr);
      item.canvas.height = Math.round(rect.height * dpr);
      item.g = item.canvas.getContext('2d');
      item.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      item.w = rect.width;
      item.h = rect.height;
    }
  };

  const frame = (t) => {
    for (const item of items) {
      if (!item.on || item.tile.hidden) continue;
      if (item.gl) {
        item.gl.render(t);
        continue;
      }
      if (!item.w) continue;
      item.g.clearRect(0, 0, item.w, item.h);
      item.sample.draw(item.g, item.w, item.h, t);
      finish(item.g, item.w, item.h, t, item.sample.look);
    }
  };

  measure();
  if (!('IntersectionObserver' in window)) for (const item of items) wake(item);
  const start = performance.now();

  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => {
      measure();
      frame(0);
    });
    for (const item of items) ro.observe(item.canvas);
  }

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    frame(2.4);
    return { refresh: () => frame(2.4) };
  }

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const item = items.find((c) => c.canvas === entry.target);
          if (item) {
            item.on = entry.isIntersecting;
            if (entry.isIntersecting) wake(item);
          }
        }
      },
      { root: root, threshold: 0.05 },
    );
    for (const item of items) io.observe(item.canvas);
  }

  // Ten canvases on one clock: 30fps is plenty for samples and halves the work.
  let raf = 0;
  let drewAt = 0;
  const tick = (now) => {
    if (now - drewAt > 30) {
      drewAt = now;
      frame(((now - start) / 1000) % LOOP_SECONDS);
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(tick);
  });

  return {
    refresh() {
      measure();
      frame(((performance.now() - start) / 1000) % LOOP_SECONDS);
    },
  };
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

/** Beat stills from out/ref/storyboard.json, if this film was read from a reference. */
let beatStillsLoading = false;
function applyStills() {
  chips.forEach(({ el }, i) => {
    const beat = beatStills[i];
    el.dataset.still = beat?.still ?? '';
    el.dataset.beat = beat?.name ?? '';
  });
}
function loadBeatStills() {
  if (beatStillsLoading || beatStills.length) return;
  beatStillsLoading = true;
  fetch('./out/ref/storyboard.json', { cache: 'no-store' })
    .then((res) => (res.ok ? res.json() : null))
    .then((story) => {
      const beats = Array.isArray(story?.beats) ? story.beats : [];
      beatStills = beats.filter((beat) => typeof beat.still === 'string' && beat.still.startsWith('out/ref/'));
      applyStills();
    })
    .catch(() => {})
    .finally(() => {
      beatStillsLoading = false;
    });
}

/** A still of this beat, shown over the strip while the pointer rests on a chip. */
function showBeatPeek(el) {
  const still = el.dataset.still;
  if (!still || !beatPeek) return;
  const img = beatPeek.querySelector('img');
  const label = beatPeek.querySelector('.beat-peek-label');
  img.src = `./${still}`;
  label.textContent = `${el.dataset.beat ?? ''} ${el.querySelector('.len')?.textContent ?? ''}`.trim();
  const rect = el.getBoundingClientRect();
  beatPeek.hidden = false;
  const width = beatPeek.offsetWidth || 148;
  beatPeek.style.left = `${Math.min(window.innerWidth - width - 8, Math.max(8, rect.left + rect.width / 2 - width / 2))}px`;
  beatPeek.style.top = `${Math.max(8, rect.top - beatPeek.offsetHeight - 8)}px`;
}

function buildChips(scenes) {
  const sameOrder = chips.length === scenes.length && chips.every((c, i) => c.scene.id === scenes[i].id);
  if (sameOrder) {
    // Same scenes, new lengths: update in place. Rebuilding would kill a hover
    // (and the ... menu) every time the poll applies an edit.
    chips.forEach(({ el }, i) => {
      const scene = scenes[i];
      el.style.flexGrow = String(scene.length);
      el.querySelector('.chip-label').innerHTML = `${scene.name} <span class="len">· ${scene.length.toFixed(1)}s</span>`;
      el.dataset.scene = scene.id;
      chips[i].scene = scene;
    });
    applyStills();
    loadBeatStills();
    return;
  }
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
      // Keyboard activation has no pointer, so it uses the scene's start; a
      // pointer press was already served by the strip's seek.
      const now = timeline.scenes.find((s) => s.id === el.dataset.scene);
      if (!now) return;
      seekTo(now.start + 0.001);
    });
    el.addEventListener('pointerenter', () => showBeatPeek(el));
    el.addEventListener('pointerleave', () => {
      if (beatPeek) beatPeek.hidden = true;
    });
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const now = timeline.scenes.find((s) => s.id === el.dataset.scene);
      if (!now) return;
      seekTo(now.start + 0.001);
    });
    el.querySelector('.chip-more').addEventListener('click', (e) => {
      e.stopPropagation();
      const now = timeline.scenes.find((s) => s.id === el.dataset.scene) ?? scene;
      openChipMenu(now, el);
    });
    scenesEl.insertBefore(el, playhead);
    return { el, scene };
  });
  applyStills();
  loadBeatStills();
}

buildChips(timeline.scenes);


/** A compact overview of the sections above the film; clicking a pill seeks. */
const reelEl = $('reel');
let reel = [];

function buildReel(scenes) {
  reel = [];
  reelEl.innerHTML = '';
  const count = document.createElement('span');
  count.className = 'reel-count';
  count.textContent = `1 / ${scenes.length} 段`;
  const track = document.createElement('div');
  track.className = 'reel-track';
  reelEl.append(count, track);
  scenes.forEach((scene, i) => {
    const seg = document.createElement('button');
    seg.type = 'button';
    seg.className = 'reel-seg';
    seg.dataset.seg = scene.id;
    seg.title = scene.name;
    seg.setAttribute('aria-label', scene.name);
    seg.addEventListener('click', () => {
      seekTo(scene.start + 0.001);
    });
    track.append(seg);
    reel.push({ seg, scene });
    void i;
  });
  reelEl.dataset.count = String(scenes.length);
  reelEl.dataset.index = '0';
}

buildReel(timeline.scenes);

/** Take a reloaded timeline: the clock, the strip and the duration all follow. */
function adoptTimeline(next) {
  timeline = next;
  total = next.duration;
  durEl.textContent = fmt(total);
  if (t > total - 0.001) t = Math.max(0, total - 0.001);
  timeline = kernel.timeline ?? next;
  buildChips(timeline.scenes);
  buildReel(timeline.scenes);
  buildStyles();
  applyStyle(currentStyle);
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
    <button id="chipPoster" type="button">用当前帧作封面 · ${fmt(t)}</button>
    <button id="chipDelete" type="button">删除这一段</button>`;
  chipMenu.hidden = false;
  const left = Math.min(
    Math.max(chipEl.offsetLeft + chipEl.offsetWidth - chipMenu.offsetWidth, 0),
    scenesEl.clientWidth - chipMenu.offsetWidth,
  );
  chipMenu.style.left = `${left}px`;
  chipMenu.querySelector('#chipPoster').addEventListener('click', async (e) => {
    e.stopPropagation();
    const button = e.currentTarget;
    try {
      const res = await fetch('./api/poster', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body({ time: t }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      timeline.poster = data.poster;
      button.textContent = `封面：${fmt(data.poster)}`;
      setTimeout(closeChipMenu, 700);
    } catch (err) {
      button.textContent = `失败：${err.message}`;
    }
  });
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
  // The chip's ... button and its menu are controls, not strip gestures.
  if (e.target.closest('.chip-more') || e.target.closest('.chip-menu')) return;
  // Keep the browser from starting a text selection on the strip. The seek no
  // longer depends on the click, so cancelling the press costs nothing.
  e.preventDefault();
  // A new press always starts a fresh gesture: clear any pending suppression so a
  // plain click after a drag still seeks.
  suppressChip = false;
  stripDrag = { x: e.clientX, moved: false, rect: scenesEl.getBoundingClientRect() };
});

scenesEl.addEventListener('pointermove', (e) => {
  if (!stripDrag) return;
  if (!stripDrag.moved && Math.abs(e.clientX - stripDrag.x) < 3) return;
  stripDrag.moved = true;
  seekTo(timeFromStrip(e.clientX, stripDrag.rect));
});

window.addEventListener('pointerup', (e) => {
  const drag = stripDrag;
  stripDrag = null;
  if (!drag) return;
  if (drag.moved) {
    suppressChip = true;
    return;
  }
  // A press without movement is a seek to the pointer — not to the start of the
  // scene under it, and not a no-op while the film is playing.
  if (e.button !== 0) return;
  seekTo(timeFromStrip(e.clientX, drag.rect));
  suppressChip = true;
});

function setTime(next) {
  t = Math.max(0, Math.min(total - 0.001, next));
  tc.textContent = fmt(t);
  playhead.style.left = `${(t / total) * 100}%`;
  const scene = currentScene(t);
  sceneName.textContent = scene.name;
  const reelIndex = timeline.scenes.findIndex((s) => s.id === scene.id);
  if (reelEl.dataset.index !== String(reelIndex)) {
    reelEl.dataset.index = String(reelIndex);
    reelEl.firstChild.textContent = `${reelIndex + 1} / ${timeline.scenes.length} 段`;
    for (const { seg, scene: s } of reel) seg.classList.toggle('done', s.start <= t);
  }
  for (const { el, scene: s } of chips) {
    el.setAttribute('aria-current', String(s.id === scene.id));
    // Keep the playing scene visible in a strip that scrolls.
    if (s.id === scene.id) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  refreshSelection();
  comments.refreshAnchors();
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
    return;
  }
  selected = hit;
  showSelection(hit);
}

function renderFrame() {
  kernel.renderAt(t);
  setTime(t);
}

/**
 * Move the film to a time, playing or not. While playing the audio is the clock,
 * so a seek that does not also move the audio is undone by the next frame.
 */
function seekTo(next) {
  setTime(next);
  kernel.renderAt(t);
  if (playing) soundSeek(t);
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
let pendingTree = null;
let pendingSince = 0;

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

    // Scene *code* cannot be hot-swapped (the browser caches the module), so a
    // banner is not enough: the panel would keep showing the old film while the
    // agent thinks it shipped a new one. Wait until the tree stops changing,
    // then reload the whole page.
    if (next.tree !== revision.tree) {
      staleEl.hidden = false;
      const now = Date.now();
      if (pendingTree !== next.tree) {
        pendingTree = next.tree;
        pendingSince = now;
      } else if (now - pendingSince > 1500) {
        location.reload();
        return;
      }
    } else {
      pendingTree = null;
    }
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

// --- versions: what the agent finished, switchable from the top bar ---
const versionMenu = $('versionMenu');
const versionList = $('versionList');
const versionLabel = $('versionLabel');
const versionDot = $('versionDot');

function renderVersions(data) {
  const rows = data.versions ?? [];
  const current = rows[0];
  versionLabel.textContent = current ? `${current.id} · ${current.title}` : '还没有版本';
  versionDot.hidden = !data.dirty;
  versionDot.title = data.dirty ? '有未保存为版本的修改' : '';
  versionList.innerHTML = rows.length
    ? rows
        .map(
          (row, i) => `
        <button class="version-row" data-id="${row.id}" aria-current="${i === 0}">
          <span class="id">${row.id}</span>
          <span class="title">${row.title}</span>
          <span class="meta">${row.author === 'user' ? '我' : 'agent'}</span>
        </button>`,
        )
        .join('')
    : '<p class="hint">agent 改完一段并收尾后，这里会出现可切换的版本。</p>';
  for (const button of versionList.querySelectorAll('.version-row')) {
    button.addEventListener('click', async () => {
      const id = button.dataset.id;
      if (id === rows[0]?.id) {
        versionMenu.open = false;
        return;
      }
      button.disabled = true;
      try {
        const res = await fetch('./api/versions/use', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body({ id }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? res.statusText);
        }
        // Scene code changed with the version: a reload is the honest refresh.
        location.reload();
      } catch (error) {
        button.disabled = false;
        versionList.insertAdjacentHTML('afterbegin', `<p class="hint">切换失败：${error.message}</p>`);
      }
    });
  }
}

// A dropdown closes when you click anywhere else or press Escape — the same
// contract every other menu on the page follows.
window.addEventListener('pointerdown', (e) => {
  if (versionMenu?.open && !e.target.closest('#versionMenu')) versionMenu.open = false;
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && versionMenu?.open) versionMenu.open = false;
});

async function loadVersions() {
  try {
    renderVersions(await (await fetch('./api/versions')).json());
  } catch {
    versionLabel.textContent = '版本';
  }
}

// --- style: the film's palettes are data, so a style is one lookup away ---
const styleList = $('styleList');
const paletteEditor = $('paletteEditor');
const paletteTokens = $('paletteTokens');
const paletteName = $('paletteName');
const paletteNote = $('paletteNote');
const palettePickHint = $('palettePickHint');
const TOKEN_ORDER = ['bg', 'panel', 'grid', 'accent', 'fg', 'muted'];
const railTabs = [...document.querySelectorAll('.rail-tab')];
const railPanels = [...document.querySelectorAll('.rail-panel')];
const authoredPalette = new Map(timeline.scenes.map((s) => [s.id, s.palette]));
let currentStyle = '';
try {
  currentStyle = localStorage.getItem('dshm:style') ?? '';
} catch {
  /* private mode */
}

const allComments = $('allComments');
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The 批注 page: every note, grouped by the section it was made in. */
async function loadAllComments() {
  try {
    const { threads = [] } = await (await fetch('./api/comments')).json();
    if (!threads.length) {
      allComments.innerHTML = '<p class="hint">还没有批注。开启批注模式，在画面上点选或框选。</p>';
      return;
    }
    const groups = new Map();
    for (const thread of threads) {
      const t = Number(thread.anchor?.t ?? 0);
      const scene =
        timeline.scenes.find((sc) => t >= sc.start && t < sc.start + sc.length) ?? timeline.scenes.at(-1);
      if (!scene) continue;
      if (!groups.has(scene.id)) groups.set(scene.id, { scene, rows: [] });
      groups.get(scene.id).rows.push(thread);
    }
    allComments.innerHTML = [...groups.values()]
      .sort((a, b) => a.scene.start - b.scene.start)
      .map(
        ({ scene, rows }) => `
        <section class="comment-group">
          <h3>${escapeHtml(scene.name)}<span>${rows.length}</span></h3>
          ${rows
            .sort((a, b) => Number(a.anchor.t) - Number(b.anchor.t))
            .map(
              (thread) => `
            <button class="comment-row" data-t="${Number(thread.anchor.t)}">
              <span class="t">${fmt(Number(thread.anchor.t))}</span>
              <span class="txt">${escapeHtml(thread.messages?.[0]?.text ?? '')}</span>
            </button>`,
            )
            .join('')}
        </section>`,
      )
      .join('');
    const rectOf = new Map(threads.map((thread) => [Number(thread.anchor?.t), thread.anchor?.rect ?? null]));
    for (const row of allComments.querySelectorAll('.comment-row')) {
      row.addEventListener('click', () => {
        const at = Number(row.dataset.t);
        seekTo(at);
        // Same behaviour the 调整 page used to have: jump there and show the box.
        const rect = rectOf.get(at);
        if (rect) highlightRect(rect, 1600);
      });
    }
  } catch {
    allComments.innerHTML = '<p class="hint">读不到批注。</p>';
  }
}

function setRailTab(name) {
  for (const tab of railTabs) tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
  for (const panel of railPanels) panel.hidden = panel.dataset.panel !== name;
  if (name === 'comments') loadAllComments();
  try {
    localStorage.setItem('dshm:rail', name);
  } catch {
    /* private mode */
  }
}

for (const tab of railTabs) tab.addEventListener('click', () => setRailTab(tab.dataset.tab));
try {
  setRailTab(localStorage.getItem('dshm:rail') ?? 'tweaks');
} catch {
  setRailTab('tweaks');
}

function applyStyle(name) {
  currentStyle = name;
  for (const scene of timeline.scenes) {
    scene.palette = name || authoredPalette.get(scene.id) || 'main';
  }
  try {
    localStorage.setItem('dshm:style', name);
  } catch {
    /* private mode */
  }
  for (const button of styleList.querySelectorAll('.palette')) {
    button.setAttribute('aria-pressed', String(button.dataset.style === name));
  }
  renderPaletteEditor(name);
  // Scenes bake palette colours into sprites at mount, so rebuilding them is the
  // difference between a new style and a new style that does not paint.
  kernel.remount?.();
  kernel.renderAt(t);
  refreshSelection();
}

/** Which colours this palette actually uses, merged with the base so the list
 *  shows effective values, not just the overridden ones. */
function paletteTokensOf(name) {
  const base = timeline.palettes?.main ?? {};
  const own = timeline.palettes?.[name] ?? {};
  const merged = { ...base, ...own };
  const extra = Object.keys(merged).filter((token) => !TOKEN_ORDER.includes(token)).sort();
  return [...TOKEN_ORDER.filter((token) => token in merged), ...extra].map((token) => ({
    token,
    value: merged[token],
    own: token in own,
  }));
}

function renderPaletteEditor(name) {
  const has = Boolean(name && timeline.palettes?.[name]);
  paletteEditor.hidden = !has;
  palettePickHint.hidden = has;
  if (!has) return;
  paletteName.textContent = name;
  paletteTokens.innerHTML = paletteTokensOf(name)
    .map(
      ({ token, value }) => `
      <div class="token-row" data-token="${token}">
        <span class="token-name">${token}</span>
        <input class="token-hex" data-token="${token}" value="${value}" maxlength="7" spellcheck="false" />
        <input class="token-color" data-token="${token}" type="color" value="${value}" />
      </div>`,
    )
    .join('');
  for (const row of paletteTokens.querySelectorAll('.token-row')) {
    const token = row.dataset.token;
    const hex = row.querySelector('.token-hex');
    const chip = row.querySelector('.token-color');
    const commit = (value) => {
      const normal = String(value).trim().startsWith('#') ? String(value).trim() : `#${String(value).trim()}`;
      if (!/^#[0-9a-f]{6}$/i.test(normal)) {
        paletteNote.hidden = false;
        paletteNote.textContent = '颜色要写成 #rrggbb';
        return;
      }
      paletteNote.hidden = true;
      applyToken(name, token, normal.toLowerCase());
      hex.value = normal.toLowerCase();
      chip.value = normal.toLowerCase();
    };
    hex.addEventListener('change', () => commit(hex.value));
    chip.addEventListener('input', () => {
      hex.value = chip.value;
      kernel.setPalette({ [name]: { [token]: chip.value } });
      kernel.renderAt(t);
    });
    chip.addEventListener('change', () => commit(chip.value));
  }
}

/** Recolour one token: repaint now, write the film after. */
async function applyToken(name, token, hex) {
  kernel.setPalette({ [name]: { [token]: hex } });
  kernel.remount?.();
  kernel.renderAt(t);
  buildStyles();
  for (const button of styleList.querySelectorAll('.palette')) {
    button.setAttribute('aria-pressed', String(button.dataset.style === currentStyle));
  }
  try {
    const res = await fetch('./api/palette', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ name, tokens: { [token]: hex } }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      paletteNote.hidden = false;
      paletteNote.textContent = `没写进片子：${data.error ?? res.status}（重启宿主后生效）`;
    }
  } catch (error) {
    paletteNote.hidden = false;
    paletteNote.textContent = `没写进片子：${error.message}`;
  }
}

/** A palette reads as one swatch: its colours side by side, no label needed. */
function buildStyles() {
  const palettes = timeline.palettes ?? {};
  const base = palettes.main ?? {};
  const names = Object.keys(palettes);
  styleList.innerHTML = names
    .map((name) => {
      const merged = { ...base, ...palettes[name] };
      const dots = ['bg', 'panel', 'accent', 'fg', 'muted']
        .map((token) => `<i style="background:${merged[token] ?? '#000'}"></i>`)
        .join('');
      return `<button class="palette" data-style="${name}" aria-pressed="${currentStyle === name}" aria-label="${name}" title="${name}">${dots}</button>`;
    })
    .join('');
  for (const button of styleList.querySelectorAll('.palette')) {
    button.addEventListener('click', () => applyStyle(button.dataset.style));
  }
  renderPaletteEditor(currentStyle);
}

const paletteAdd = $('paletteAdd');

paletteAdd?.addEventListener('click', async () => {
  // A new palette starts as a copy of the one you are looking at, so its colours
  // are already legible; you then change the ones you disagree with.
  const base = timeline.palettes?.[currentStyle] ?? timeline.palettes?.main ?? {};
  const merged = { ...(timeline.palettes?.main ?? {}), ...base };
  const names = new Set(Object.keys(timeline.palettes ?? {}));
  let name = 'custom-1';
  for (let i = 2; names.has(name); i += 1) name = `custom-${i}`;
  try {
    const res = await fetch('./api/palette', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ name, tokens: merged, create: true }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    timeline.palettes[name] = data.palette;
    buildStyles();
    applyStyle(name);
  } catch (error) {
    paletteNote.hidden = false;
    paletteNote.textContent = `新建配色失败：${error.message}`;
  }
});

buildStyles();
applyStyle(currentStyle);
loadVersions();

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
    // Apply the new timeline in place instead of reloading the page: a reload
    // would throw away the playhead and every hover mid-edit.
    const latest = await (await fetch(timelineSrc, { cache: 'no-store' })).json();
    kernel.reload(latest);
    adoptTimeline(kernel.timeline ?? latest);
    sceneNote.textContent = `已保存 · 总时长 ${data.duration}s`;
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
    seekTo(timeline.scenes[i - 1].start + 0.001);
  }
});

nextSceneBtn?.addEventListener('click', () => {
  const i = sceneIndexAt(t);
  if (i >= 0 && i < timeline.scenes.length - 1) {
    seekTo(timeline.scenes[i + 1].start + 0.001);
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
    // Same path as any other edit: pull the timeline and adopt it, so chips,
    // reel and rail all agree without a page reload.
    const latest = await (await fetch(timelineSrc, { cache: 'no-store' })).json();
    kernel.reload(latest);
    adoptTimeline(kernel.timeline ?? latest);
  } catch (err) {
    sceneNote.textContent = `改名失败：${err.message}`;
    sceneNameInput.value = currentScene(t).name;
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

function fmtKnob(value, step) {
  const decimals = Math.min(3, String(step).split('.')[1]?.length ?? 2);
  return value.toFixed(decimals);
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

const comments = createComments({
  canvas,
  box,
  selection,
  popover,
  popT,
  popText,
  popSubmit,
  popClose,
  timeline,
  kernel,
  fmt,
  getTime: () => t,
  onHighlight: (rect) => highlightRect(rect, 1600),
  onSeek: (next) => {
    seekTo(next);
  },
  onClearSelection: () => {
    selected = null;
  },
  onThreadsChanged: () => loadAllComments(),
  onError: (message) => {
    console.error('[comments]', message);
  },
  session: sessionId,
});

// Two modes the human switches on, the way the reference does: the rail is a
// door (Tweaks), and annotating is a mode (click an object, no drag needed).
const annotateBtn = $('annotateMode');

function setAnnotating(on) {
  document.body.classList.toggle('annotating', on);
  annotateBtn?.setAttribute('aria-pressed', String(on));
  if (!on) {
    // Turning the mode off ends the gesture: no half-finished box, no note card.
    comments.cancelDraft();
    selected = null;
    selection.hidden = true;
  }
  comments.refreshAnchors();
}

annotateBtn?.addEventListener('click', () => setAnnotating(!document.body.classList.contains('annotating')));

const tweaksBtn = $('tweaksToggle');


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

// Direct manipulation: the cursor tells you what a click will do — a word opens
// its field (I-beam), anything else opens a note.
canvas.addEventListener('pointermove', (e) => {
  if (playing) return;
  if (document.body.classList.contains('annotating')) {
    canvas.style.cursor = 'crosshair';
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * timeline.width;
  const y = ((e.clientY - rect.top) / rect.height) * timeline.height;
  const hit = kernel.pick(x, y, t);
  canvas.style.cursor = hit ? (hit.slot ? 'text' : 'pointer') : 'default';
});

canvas.addEventListener('click', (e) => {
  if (comments.consumeSuppress()) return; // that click ended a drag, not a pick
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * timeline.width;
  const y = ((e.clientY - rect.top) / rect.height) * timeline.height;
  const hit = kernel.pick(x, y, t);

  // A click on the film is a request to annotate: the object under the pointer
  // supplies the box, empty space gets a small one. There is no mode to enter.
  const target = hit ? { x: hit.x, y: hit.y, w: hit.w, h: hit.h } : { x: x - 60, y: y - 30, w: 120, h: 60 };
  if (hit) {
    selected = hit;
    refreshSelection();
  } else {
    selected = null;
    selection.hidden = true;
  }
  if (document.body.classList.contains('annotating')) {
    // Annotating is a mode: a click or a drag marks a region, and text editing
    // stays out of the way until the mode is off.
    if (comments.available()) comments.annotateAt(target);
    return;
  }
  if (hit?.slot) {
    // A word is edited, not annotated: open the rail and put the caret in its
    // field with the value selected, so typing replaces it.
    if (!document.body.classList.contains('tweaks')) setTweaks(true);
    // The field lives in the 调整 page: if another page is open the rail looks
    // like it did nothing (the input cannot take focus while it is hidden).
    setRailTab('tweaks');
    const input = textList.querySelector(`input[data-text-scene="${currentScene(t).id}"][data-text-slot="${hit.slot}"]`);
    if (input) {
      // The rail may have been display:none until this click; force layout so the
      // field exists before focus() is asked to put the caret in it.
      void input.offsetHeight;
      input.focus();
      input.select();
    }
    return; // editing the word is the whole gesture; no note box on top
  }
});

// --- fullscreen ---
const fullscreenBtn = $('fullscreen');
const canvasBox = $('canvasBox');
fullscreenBtn?.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await canvasBox.requestFullscreen();
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
    seekTo(t + 1 / (timeline.fps ?? 30));
  } else if (e.code === 'ArrowLeft') {
    seekTo(t - 1 / (timeline.fps ?? 30));
  }
});

durEl.textContent = fmt(total);
updatePlayButton();
renderFrame();

comments.refreshThreads();
loadAllComments();

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
  scenes: () => timeline.scenes.map((s) => ({ id: s.id, start: s.start, length: s.length })),
  style: () => ({ current: currentStyle, palettes: timeline.scenes.map((s) => s.palette) }),
  remount: () => kernel.remount?.(),
  color: (token) => kernel.colorAt?.(token),
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
  setPoster: async (time) => {
    const res = await fetch('./api/poster', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ time }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? res.statusText);
    timeline.poster = data.poster;
    return data.poster;
  },
  setParam: async (scene, key, value, persist = true) => {
    kernel.setParam(scene, key, value);
    kernel.renderAt(t);
    buildKnobs(currentScene(t), { force: true });
    if (persist) await persistParam(scene, key, value);
    return value;
  },
  history: async () => (await (await fetch('./api/history')).json()).snapshots,
  undo: async () => {
    // Undo lives in the version menu now; restore the previous snapshot directly.
    const { snapshots } = await (await fetch('./api/history')).json();
    const id = snapshots[0]?.id;
    if (!id) return;
    const res = await fetch('./api/history/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body({ id }),
    });
    if (!res.ok) return;
    const data = await res.json();
    kernel.reload(data.timeline);
    kernel.renderAt(t);
  },
  pixel: (x, y) => {
    const g = kernel.surface;
    const scale = g.canvas.width / timeline.width;
    const d = g.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  },
};

// A film that was just created from a template opens on its cover frame, not on
// the black frame an entrance starts from.
if (new URLSearchParams(location.search).get('from') === 'template') {
  const poster = Math.min(Number(timeline.poster) || 0, Math.max(0, total - 0.05));
  if (poster > 0) seekTo(poster);
}
