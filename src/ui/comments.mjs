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
  popSend,
  popSubmit,
  popClose,
  threadsEl,
  threadCount,
  timeline,
  kernel,
  fmt,
  getTime,
  onSeek,
  onClearSelection,
  onError,
}) {
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

  popSubmit.addEventListener('click', async () => {
    if (!pending) return;
    const text = popText.value.trim();
    if (!text) {
      popText.focus();
      return;
    }
    const center = { x: pending.rect.x + pending.rect.w / 2, y: pending.rect.y + pending.rect.h / 2 };
    const hit = kernel.pick(center.x, center.y, pending.t);
    const res = await fetch('./api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        anchor: { t: pending.t, rect: pending.rect, elementId: hit?.id ?? null },
        text,
        activated: popSend.checked,
      }),
    });
    if (!res.ok) {
      onError(`批注保存失败：${escapeHtml((await res.json()).error ?? res.status)}`);
      return;
    }
    popover.hidden = true;
    pending = null;
    selection.hidden = true;
    await refreshThreads();
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
        .map(
          (th) => `
        <div class="thread" data-id="${th.id}" data-t="${th.anchor.t}">
          <div class="meta"><span>${fmt(th.anchor.t)}</span><span class="badge ${th.status}">${th.status}</span></div>
          <div class="text">${escapeHtml(th.messages[0]?.text ?? '')}</div>
        </div>`,
        )
        .join('');
      for (const el of threadsEl.querySelectorAll('.thread')) {
        el.addEventListener('click', () => onSeek(Number(el.dataset.t)));
      }
    } catch {
      /* preview works without the API */
    }
  }

  return {
    refreshThreads,
    consumeSuppress() {
      const value = suppressClick;
      suppressClick = false;
      return value;
    },
  };
}
