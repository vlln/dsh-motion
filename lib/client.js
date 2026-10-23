// dsh-motion client half: one film, three seats.
//
//   · the conversation card — a render's result, inline where the user asked
//   · the right-sidebar tab — the live preview that stays open while you talk
//   · the main panel        — the full-width editor, for scrubbing and fixing
//
// All three are the same iframe of /plugins/dsh-motion/app; only `embed` differs,
// so behaviour cannot drift between watching and editing.
//
// Registered through the host's slots API, which is React-based, so this file
// requires react from the platform seed instead of shipping its own copy.

window.__ModuleLoader__.load({
  id: '@vlln/dsh-motion',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;

    const APP = '/plugins/dsh-motion/app';
    const TAB_ID = '@vlln/dsh-motion';
    const TAB_KIND = 'motion';
    const WEB = '/plugins/dsh-motion';

    // An iframe is its own document, so host CSS variables do not reach it.
    // Copy the theme tokens across on load (and when the host theme flips);
    // standalone preview simply keeps its own fallbacks.
    const TOKENS = [
      '--dsw-alias-bg-base',
      '--dsw-alias-bg-layer-1',
      '--dsw-alias-bg-layer-2',
      '--dsw-alias-bg-layer-3',
      '--dsw-alias-bg-module-platform',
      '--dsw-alias-label-primary',
      '--dsw-alias-label-secondary',
      '--dsw-alias-label-tertiary',
      '--dsw-alias-label-caption',
      '--dsw-alias-border-l1',
      '--dsw-alias-border-l2',
      '--dsw-alias-border-l3',
      '--dsw-alias-border-l4',
      '--dsw-alias-interactive-bg-hover',
      '--dsw-alias-interactive-bg-active',
      '--dsw-alias-state-business-primary',
      '--dsw-alias-button-primary-fill',
      '--dsw-alias-label-primary-foreground',
      '--dsw-specific-sidebar-fill',
      '--dsw-specific-input-major',
      '--dsw-font-family',
      '--ds-font-family-code',
      '--dsw-font-s-14',
      '--dsw-font-strong-14',
      '--dsw-font-xs-13',
      '--dsw-font-xxs-12',
      '--dsw-font-xxxs-11',
      '--dsw-shadow-lv2',
      '--dsw-elevation-panel',
      '--dsw-elevation-soft',
      '--dsw-elevation-stroke-color',
      '--dsw-focus-ring-color',
      '--ds-ease-in-out',
      '--ds-transition-duration',
    ];

    const syncTokens = (frame) => {
      const doc = frame.contentDocument;
      if (!doc) return;
      // dsh declares its theme variables on <body>, not on <html>.
      const source = getComputedStyle(document.body);
      const target = doc.documentElement.style;
      for (const name of TOKENS) {
        const value = source.getPropertyValue(name).trim();
        if (value) target.setProperty(name, value);
      }
      const dark = document.body.hasAttribute('data-ds-dark-theme');
      doc.documentElement.toggleAttribute('data-ds-dark-theme', dark);
    };

    // Cordis only exposes a service through a context that injected it, and a
    // component runs outside any scope of its own. These captures are the
    // injected scopes the panel acts through.
    let sidebarCtx = null;
    let sessions = null;
    let conversation = null;

    /** Reveal the film column. Silent when no session is on screen to own it. */
    const openPreview = () => {
      try {
        sidebarCtx?.sidebarRight?.openTab(TAB_KIND);
      } catch {
        // No session, or no right sidebar: the card still shows the film.
      }
    };

    /**
     * Speak into one session, as the human would. A comment is a message, so it
     * takes the same road a typed prompt takes: the session's own scope, queued
     * for the next turn because the film being reviewed is not this turn's work.
     */
    const sayInSession = async (sessionId, text) => {
      if (!sessions || !conversation || !sessionId) throw new Error('no session to speak into');
      const reference = sessions.retain(sessionId, { source: 'dsh-motion' });
      try {
        const binding = await reference.ready;
        // Explicit session, explicit delivery: queued, because the film under
        // review is not the turn the agent is running.
        await conversation.sendSession(binding.session, text, [], 'queue');
      } finally {
        reference.release();
      }
    };

    /** A themed iframe of the panel. `src` decides which embed mode it runs in. */
    const Frame = ({ src, title }) => {
      const frameRef = React.useRef(null);
      React.useEffect(() => {
        const frame = frameRef.current;
        if (!frame) return undefined;
        const sync = () => syncTokens(frame);
        frame.addEventListener('load', sync);
        const observer = new MutationObserver(sync);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
        sync();
        return () => {
          frame.removeEventListener('load', sync);
          observer.disconnect();
        };
      }, []);

      return h('iframe', {
        ref: frameRef,
        title,
        src,
        loading: 'lazy',
        style: { width: '100%', height: '100%', border: 0, display: 'block', background: 'transparent' },
      });
    };

    /**
     * Right-sidebar tab: the film, beside the conversation that made it. The
     * session rides in the URL so the panel knows whose film it is showing and
     * whose conversation its comments must reach.
     */
    const MotionTab = ({ sessionId }) =>
      h(
        'div',
        {
          'data-dshm-tab': '',
          'data-session': sessionId ?? '',
          style: { height: '100%', minHeight: 0, background: 'var(--dsw-alias-bg-base, #fff)' },
        },
        h(Frame, { src: `${APP}?embed=tab&session=${encodeURIComponent(sessionId ?? '')}`, title: 'dsh-motion tab' }),
      );

    const hint = { fontSize: 12, color: 'var(--dsw-alias-label-tertiary, #81858c)' };
    const button = {
      border: '0.5px solid var(--dsw-alias-border-l3, rgb(15 17 21 / 14%))',
      background: 'var(--dsw-alias-bg-layer-1, #fff)',
      color: 'var(--dsw-alias-label-primary, #0f1115)',
      borderRadius: 6,
      padding: '3px 10px',
      font: '500 12px/1.6 var(--dsw-font-family, system-ui)',
      cursor: 'pointer',
    };

    /**
     * A render in the conversation: the film itself once it exists, and the frame
     * counter while it is being made. The tab opening on completion is what makes
     * "the agent made an animation" land without the user knowing a panel exists.
     */
    const MotionCard = (props) => {
      const done = props.phase === 'result';
      const [state, setState] = React.useState({ status: done ? 'done' : 'rendering' });
      const [timeline, setTimeline] = React.useState(null);
      const announced = React.useRef(false);

      // While the tool runs, the host mirrors capture's frame counter to disk.
      React.useEffect(() => {
        if (done) return undefined;
        let alive = true;
        const read = async () => {
          try {
            const res = await fetch(`${WEB}/api/render`, { cache: 'no-store' });
            const next = await res.json();
            if (alive) setState(next);
          } catch {
            // The route ships with the plugin; a miss just means "not yet".
          }
        };
        read();
        const id = setInterval(read, 400);
        return () => {
          alive = false;
          clearInterval(id);
        };
      }, [done]);

      React.useEffect(() => {
        let alive = true;
        fetch(`${WEB}/timeline.json`, { cache: 'no-store' })
          .then((res) => res.json())
          .then((value) => alive && setTimeline(value))
          .catch(() => {});
        return () => {
          alive = false;
        };
      }, []);

      // The film is ready: bring it into the sidebar, once per card.
      React.useEffect(() => {
        if (done && !announced.current) {
          announced.current = true;
          openPreview();
        }
      }, [done]);

      const frame = state.frame ?? 0;
      const frames = state.frames ?? 0;
      const pct = frames ? Math.min(100, Math.round((frame / frames) * 100)) : 6;
      const failed = state.status === 'failed';
      const scenes = timeline?.scenes?.length ?? 0;
      const duration = timeline?.duration ?? 0;
      const fps = timeline?.fps ?? 0;

      const status = done
        ? failed
          ? '渲染失败'
          : ['已渲染', duration ? `${duration}s` : '', fps ? `${fps}fps` : '', scenes ? `${scenes} 幕` : '']
              .filter(Boolean)
              .join(' · ')
        : failed
          ? '渲染失败'
          : frames
            ? `${frame} / ${frames} 帧 · ${pct}%`
            : '启动渲染…';

      return h(
        'div',
        {
          'data-dshm-card': '',
          style: {
            border: '0.5px solid var(--dsw-alias-border-l2, rgb(15 17 21 / 10%))',
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--dsw-alias-bg-layer-1, #fff)',
            margin: '8px 0',
            maxWidth: 720,
          },
        },
        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderBottom: '0.5px solid var(--dsw-alias-border-l1, rgb(15 17 21 / 8%))',
            },
          },
          h('span', { style: { fontSize: 13, fontWeight: 500 } }, '动画'),
          h('span', { style: hint }, status),
          h('span', { style: { flex: 1 } }),
          h('button', { type: 'button', style: button, onClick: openPreview }, '查看'),
        ),
        done && !failed
          ? h(
              'div',
              { style: { aspectRatio: '16 / 9', background: '#000' } },
              h(Frame, { src: `${APP}?embed=card`, title: 'dsh-motion card' }),
            )
          : h(
              'div',
              { style: { padding: 12 } },
              h(
                'div',
                {
                  style: {
                    height: 4,
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: 'var(--dsw-alias-bg-layer-3, #eef0f3)',
                  },
                },
                h('div', {
                  style: {
                    width: `${pct}%`,
                    height: '100%',
                    background: failed
                      ? 'var(--dsw-alias-state-error-primary, #d92d20)'
                      : 'var(--dsw-alias-state-business-primary, #4176e6)',
                    transition: 'width 0.3s ease',
                  },
                }),
              ),
              failed
                ? h(
                    'p',
                    { style: { ...hint, margin: '8px 0 0', whiteSpace: 'pre-wrap' } },
                    String(state.error ?? '').slice(0, 400) || '渲染进程退出，详见会话里的工具输出。',
                  )
                : h('p', { style: { ...hint, margin: '8px 0 0' } }, status),
            ),
      );
    };

    function apply(ctx) {
      // The panel is a column beside the conversation, never a place that
      // replaces it. There is no "open the app" entry for the same reason.

      // The panel cannot reach a session by itself; it speaks through this half.
      // One message in, one queued turn out, and an acknowledgement back so the
      // panel can show "sent" instead of hoping.
      ctx.effect(() => {
        const onMessage = (event) => {
          if (event.origin !== location.origin) return;
          const data = event.data;
          if (!data || data.type !== 'dshm:comment') return;
          const answer = (payload) => {
            try {
              event.source?.postMessage(payload, event.origin);
            } catch {
              // The panel may already be gone; the message still went out.
            }
          };
          sayInSession(data.session, String(data.text ?? ''))
            .then(() => answer({ type: 'dshm:comment-ack', id: data.id, ok: true }))
            .catch((error) =>
              answer({
                type: 'dshm:comment-ack',
                id: data.id,
                ok: false,
                error: String(error?.message ?? error),
              }),
            );
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
      }, 'dsh-motion: comment relay');

      // A render is an answer, not a log line: show the film where it was asked for.
      for (const tool of ['motion_render', 'motion_export']) {
        ctx.effect(
          () =>
            ctx.slots.inject('tool.call.toolview', () =>
              ctx.slots.register({ name: 'tool.call.toolview', key: tool }, MotionCard),
            ),
          `dsh-motion: ${tool} card`,
        );
      }

      // The preview column is its own tab type, so it is also reachable from the
      // right sidebar's guide. Registered in a sub-scope: a host without that
      // column keeps the full editor and the conversation card.
      ctx.inject(['sessions'], (scope) => {
        sessions = scope.sessions;
      });
      ctx.inject(['conversation'], (scope) => {
        conversation = scope.conversation;
      });

      ctx.inject(['sidebarRight', 'sidebarRightTabs'], (side) => {
        sidebarCtx = side;
        side.effect(
          () =>
            side.sidebarRightTabs.register({
              id: TAB_ID,
              kind: TAB_KIND,
              priority: 'extension',
              keepMounted: true,
              title: () => '动画',
              guide: [
                {
                  id: 'motion-preview',
                  order: 12,
                  title: () => '动画',
                  description: () => '正在编辑的片子',
                },
              ],
            }),
          'dsh-motion: preview tab type',
        );

        side.effect(
          () =>
            side.slots.inject('sidebar.right.pane.tab', () =>
              side.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, MotionTab),
            ),
          'dsh-motion: preview tab body',
        );
      });
    }

    return { name: 'dsh-motion-ui', inject: ['slots'], apply };
  },
});
