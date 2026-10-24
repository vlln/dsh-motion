// Annotation UI: drag a box on the canvas, write a note, send it to Claude.
// Owns the popover and the thread list; the canvas click-to-pick stays in preview.

const escapeHtml = (str) =>
  String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createComments({
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
  getTime,
  onSeek,
  onHighlight,
  onClearSelection,
  onError,
  session = '',
}) {
  // A comment is a message. This page hands the sentence to the client half,
  // which speaks it into the session the panel belongs to. Without a session
  // there is no reader, so there is no comment surface at all.
  const embedded = window.parent !== window && Boolean(session);
  if (!embedded) {
    const section = threadsEl.closest('section');
    if (section) section.hidden = true;
  }

  const pendingAcks = new Map();

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.type !== 'dshm:comment-ack') return;
    const settle = pendingAcks.get(data.id);
    if (settle) settle(data);
  });

  const anchorLabel = (anchor) => {
    const element = anchor?.elementId;
    const rect = anchor?.rect;
    if (element) return `${fmt(anchor.t)} · ${element}`;
    if (rect) {
      return `${fmt(anchor.t)} · 区域 ${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.w)}×${Math.round(rect.h)}`;
    }
    return fmt(anchor?.t ?? 0);
  };

  const messageFor = ({ anchor, text }) => `[批注] ${anchorLabel(anchor)}\n${text}`;

  /** Hand one sentence to the conversation; resolves the acknowledgement. */
  const deliver = ({ id, anchor, text }) =>
    new Promise((resolve) => {
      if (!embedded) {
        resolve({ ok: false, reason: '没有会话' });
        return;
      }
      const timer = setTimeout(() => {
        pendingAcks.delete(id);
        resolve({ ok: false, reason: '会话没有回应' });
      }, 10000);
      pendingAcks.set(id, (data) => {
        clearTimeout(timer);
        pendingAcks.delete(id);
        resolve(data.ok ? { ok: true } : { ok: false, reason: data.error ?? '失败' });
      });
      window.parent.postMessage(
        { type: 'dshm:comment', id, session, text: messageFor({ anchor, text }) },
        location.origin,
      );
    });

  let drag = null;
  let pending = null;
  let suppressClick = false;

  const point = (e) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * timeline.width,
      y: ((e.clientY - rect.top) / rect.height) * timeline.height,
    };
  };

  const rectFrom = (d) => {
    const x = Math.max(0, Math.min(d.x0, d.x1));
    const y = Math.max(0, Math.min(d.y0, d.y1));
    return {
      x,
      y,
      w: Math.min(timeline.width, Math.max(d.x0, d.x1)) - x,
      h: Math.min(timeline.height, Math.max(d.y0, d.y1)) - y,
    };
  };

  const showDraft = (rect) => {
    selection.hidden = false;
    selection.classList.add('draft');
    selection.style.left = `${(rect.x / timeline.width) * 100}%`;
    selection.style.top = `${(rect.y / timeline.height) * 100}%`;
    selection.style.width = `${(rect.w / timeline.width) * 100}%`;
    selection.style.height = `${(rect.h / timeline.height) * 100}%`;
  };

  const openPopover = (rect) => {
    pending = { rect, t: getTime() };
    showDraft(rect);
    const boxRect = box.getBoundingClientRect();
    popover.hidden = false;
    popover.style.left = `${Math.min(boxRect.width - 288, Math.max(8, ((rect.x + rect.w) / timeline.width) * boxRect.width + 10))}px`;
    popover.style.top = `${Math.min(boxRect.height - 190, Math.max(8, (rect.y / timeline.height) * boxRect.height))}px`;
    popT.textContent = `${fmt(pending.t)} · ${Math.round(rect.w)}×${Math.round(rect.h)}`;
    popText.value = '';
    popText.focus();
  };

  canvas.addEventListener('mousedown', (e) => {
    if (!embedded) return; // no session: plain clicks still pick elements
    if (!document.body.classList.contains('annotating')) return;
    if (e.button !== 0) return;
    const p = point(e);
    drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, moved: false };
    popover.hidden = true;
    onClearSelection();
    selection.hidden = true;
    selection.classList.remove('draft');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const p = point(e);
    drag.x1 = p.x;
    drag.y1 = p.y;
    if (Math.abs(drag.x1 - drag.x0) > 4 || Math.abs(drag.y1 - drag.y0) > 4) drag.moved = true;
    if (drag.moved) showDraft(rectFrom(drag));
  });

  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (!d.moved) return; // plain click: let preview pick an element

    const rect = rectFrom(d);
    if (rect.w < 8 || rect.h < 8) {
      selection.hidden = true;
      return;
    }
    selection.classList.remove('draft');
    openPopover(rect);
    suppressClick = true;
  });

  function cancelDraft() {
    popover.hidden = true;
    pending = null;
    selection.hidden = true;
    selection.classList.remove('draft');
  }

  popClose.addEventListener('click', cancelDraft);

  /**
   * Say it first, store it only after it was said. A pin with no conversation
   * behind it would be exactly the silent queue this design removes.
   */
  async function addComment({ t, rect, text }) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new Error('批注不能为空');
    if (!embedded) throw new Error('没有会话，批注无处可发');

    const center = rect ? { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } : null;
    const hit = center ? kernel.pick(center.x, center.y, t) : null;
    const anchor = { t, rect, elementId: hit?.id ?? null };
    const id = `th_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

    const sent = await deliver({ id, anchor, text: trimmed });
    if (!sent.ok) throw new Error(`没有送到对话：${sent.reason}`);

    const res = await fetch('./api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, anchor, text: trimmed, sentAt: new Date().toISOString() }),
    });
    if (!res.ok) throw new Error(`批注已在对话里，但钉子没存下：${(await res.json()).error ?? res.status}`);
    const { thread } = await res.json();
    await refreshThreads();
    return { thread, sent };
  }

  popSubmit.addEventListener('click', async () => {
    if (!pending) return;
    const text = popText.value.trim();
    if (!text) {
      popText.focus();
      return;
    }
    try {
      const { sent } = await addComment({ t: pending.t, rect: pending.rect, text });
      if (!sent.ok && sent.reason !== 'standalone') {
        onError(`批注已保存，但没有送到对话：${escapeHtml(sent.reason)}`);
      }
    } catch (error) {
      onError(String(error?.message ?? error));
      return;
    }
    popover.hidden = true;
    pending = null;
    selection.hidden = true;
  });

  popText.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') popSubmit.click();
  });

  const threadsCache = [];
  const sceneAt = (t) => {
    const total = timeline.duration ?? 0;
    const clamped = Math.max(0, Math.min(t, total - 1e-6));
    return (
      timeline.scenes.find((sc) => clamped >= sc.start && clamped < sc.start + sc.length) ??
      timeline.scenes[timeline.scenes.length - 1]
    );
  };

  /**
   * Outlines are shown only while annotating, and only in the scene the note
   * belongs to: a box floating over an unrelated shot is noise.
   */
  function paintAnchors() {
    for (const old of box.querySelectorAll('.anchor')) old.remove();
    if (!document.body.classList.contains('annotating')) return;
    const here = sceneAt(getTime())?.id;
    const visible = threadsCache.filter(
      (th) => th.anchor?.rect && th.anchor.rect.w > 0 && th.anchor.rect.h > 0 && sceneAt(th.anchor.t)?.id === here,
    );
    for (const [i, th] of visible.entries()) {
      const rect = th.anchor.rect;
      const el = document.createElement('div');
      el.className = 'anchor';
      el.dataset.id = th.id;
      el.style.left = `${(rect.x / timeline.width) * 100}%`;
      el.style.top = `${(rect.y / timeline.height) * 100}%`;
      el.style.width = `${(rect.w / timeline.width) * 100}%`;
      el.style.height = `${(rect.h / timeline.height) * 100}%`;
      const text = escapeHtml(th.messages?.[0]?.text ?? '');
      el.innerHTML = `
        <span class="anchor-pin">${i + 1}</span>
        <span class="anchor-tag"><b>${fmt(th.anchor.t)}</b>${text}</span>`;
      el.addEventListener('click', () => {
        onSeek(Number(th.anchor.t));
        onHighlight?.(rect);
      });
      box.append(el);
    }
  }

  async function refreshThreads() {
    try {
      const data = await (await fetch('./api/comments')).json();
      const threads = data.threads ?? [];
      threadsCache.length = 0;
      threadsCache.push(...threads);
      paintAnchors();
      threadCount.textContent = String(threads.length);
      if (!threads.length) {
        threadsEl.innerHTML = '';
        return;
      }
      const section = threadsEl.closest('section');
      if (section && embedded) section.hidden = threads.length === 0;
      threadsEl.innerHTML = threads
        .map((th) => {
          // No status: a comment is a message the agent already received. The
          // pin is the anchor, not a ticket that needs closing.
          return `
        <div class="thread" data-id="${th.id}" data-t="${th.anchor.t}" data-rect="${escapeHtml(JSON.stringify(th.anchor.rect ?? null))}">
          <div class="meta"><span>${fmt(th.anchor.t)}</span></div>
          <div class="text">${escapeHtml(th.messages?.[0]?.text ?? '')}</div>
        </div>`;
        })
        .join('');
      for (const el of threadsEl.querySelectorAll('.thread')) {
        el.addEventListener('click', () => {
          onSeek(Number(el.dataset.t));
          try {
            onHighlight?.(JSON.parse(el.dataset.rect));
          } catch {
            /* no anchor rect: just seek */
          }
        });
      }

    } catch {
      /* preview works without the API */
    }
  }

  return {
    refreshThreads,
    /** Drop a draft box and its note card (leaving annotate mode does this). */
    cancelDraft,
    /** Re-evaluate which outlines belong on this frame. */
    refreshAnchors: () => paintAnchors(),
    /** Open the note box for a clicked object (annotate mode). */
    annotateAt: (rect) => openPopover(rect),
    /** True when a note has a conversation to reach. */
    available: () => embedded,
    addComment,
    consumeSuppress() {
      const value = suppressClick;
      suppressClick = false;
      return value;
    },
  };
}
