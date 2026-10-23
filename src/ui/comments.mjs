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
  // A comment is a message. When this page runs inside the host it hands the
  // sentence to the client half, which speaks it into the session the panel
  // belongs to; standalone, it can only keep the pin and say so.
  const embedded = window.parent !== window && Boolean(session);
  // Standalone has nobody to speak to; say so on the button instead of pretending.
  if (!embedded) popSubmit.textContent = '保存批注';

  const pendingAcks = new Map();

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.type !== 'dshm:comment-ack') return;
    const settle = pendingAcks.get(data.id);
    if (settle) settle(data);
  });

  const anchorLabel = (thread) => {
    const element = thread.anchor?.elementId;
    const rect = thread.anchor?.rect;
    if (element) return `${fmt(thread.anchor.t)} · ${element}`;
    if (rect) {
      return `${fmt(thread.anchor.t)} · 区域 ${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.w)}×${Math.round(rect.h)}`;
    }
    return fmt(thread.anchor?.t ?? 0);
  };

  const messageFor = (thread) => `[批注] ${anchorLabel(thread)}\n${thread.messages?.[0]?.text ?? ''}`;

  /** Hand one stored thread to the conversation; resolves the acknowledgement. */
  const deliver = (thread) =>
    new Promise((resolve) => {
      if (!embedded) {
        resolve({ ok: false, reason: 'standalone' });
        return;
      }
      const timer = setTimeout(() => {
        pendingAcks.delete(thread.id);
        resolve({ ok: false, reason: 'timeout' });
      }, 10000);
      pendingAcks.set(thread.id, (data) => {
        clearTimeout(timer);
        pendingAcks.delete(thread.id);
        resolve(data.ok ? { ok: true } : { ok: false, reason: data.error ?? 'failed' });
      });
      window.parent.postMessage(
        { type: 'dshm:comment', id: thread.id, session, text: messageFor(thread) },
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

  popClose.addEventListener('click', () => {
    popover.hidden = true;
    pending = null;
    selection.hidden = true;
  });

  /** Create the pin, then (when embedded) say it in the conversation. */
  async function addComment({ t, rect, text }) {
    const trimmed = String(text ?? '').trim();
    if (!trimmed) throw new Error('批注不能为空');
    const center = rect ? { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } : null;
    const hit = center ? kernel.pick(center.x, center.y, t) : null;
    const res = await fetch('./api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anchor: { t, rect, elementId: hit?.id ?? null }, text: trimmed }),
    });
    if (!res.ok) throw new Error(`批注保存失败：${(await res.json()).error ?? res.status}`);
    const { thread } = await res.json();
    const sent = await deliver(thread);
    if (sent.ok) {
      await fetch('./api/comments/sent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: thread.id }),
      });
    }
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

  async function refreshThreads() {
    try {
      const data = await (await fetch('./api/comments')).json();
      const threads = data.threads ?? [];
      threadCount.textContent = String(threads.length);
      if (!threads.length) {
        threadsEl.innerHTML = '<p class="hint">在画面上拖出一个框，写下要改什么。</p>';
        return;
      }
      threadsEl.innerHTML = threads
        .map((th) => {
          const resolved = th.status === 'resolved';
          const label = resolved ? '已处理' : th.sentAt ? '待处理' : '未发送';
          const cls = resolved ? 'resolved' : th.sentAt ? 'open' : 'draft';
          const retry =
            !resolved && !th.sentAt && embedded
              ? `<button class="resend" data-send="${th.id}" title="送到对话">发送</button>`
              : '';
          return `
        <div class="thread" data-id="${th.id}" data-t="${th.anchor.t}" data-rect="${escapeHtml(JSON.stringify(th.anchor.rect ?? null))}">
          <div class="meta"><span>${fmt(th.anchor.t)}</span><span class="badges"><span class="badge ${cls}">${label}</span>${retry}</span></div>
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
      for (const button of threadsEl.querySelectorAll('.resend')) {
        button.addEventListener('click', async (event) => {
          event.stopPropagation();
          const id = button.dataset.send;
          const thread = threads.find((th) => th.id === id);
          if (!thread) return;
          button.disabled = true;
          const sent = await deliver(thread);
          if (sent.ok) {
            await fetch('./api/comments/sent', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id }),
            });
          } else {
            onError(`没有送到对话：${escapeHtml(sent.reason ?? '失败')}`);
          }
          await refreshThreads();
        });
      }
    } catch {
      /* preview works without the API */
    }
  }

  return {
    refreshThreads,
    addComment,
    consumeSuppress() {
      const value = suppressClick;
      suppressClick = false;
      return value;
    },
  };
}
