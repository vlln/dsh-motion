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

    const APP = '/plugins/dsh-motion/p';
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
        // Mounted under the film's own prefix, so every relative URL in the
        // panel (timeline, scenes, api, out) lands in that session's workspace.
        h(Frame, { src: `${APP}/${encodeURIComponent(sessionId ?? '')}/app?embed=tab`, title: 'dsh-motion tab' }),
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


      // The preview column is its own tab type, so it is also reachable from the
      // right sidebar's guide. Registered in a sub-scope: a host without that
      // column keeps the full editor and the conversation card.
      ctx.inject(['sessions'], (scope) => {
        sessions = scope.sessions;
      });
      ctx.inject(['conversation'], (scope) => {
        conversation = scope.conversation;
      });

      // A film can appear at any time: the agent writes it and runs the command.
      // When the session on screen first has one, reveal the column by itself.
      const openedFor = new Set();
      const watch = () => {
        const snapshot = sidebarCtx?.sidebarRight?.mounted;
        const sessionId =
          snapshot && typeof snapshot.getSnapshot === 'function' ? snapshot.getSnapshot() : undefined;
        if (!sessionId || openedFor.has(sessionId)) return;
        fetch(`${APP}/${encodeURIComponent(sessionId)}/timeline.json`, { cache: 'no-store' })
          .then((res) => {
            if (!res.ok) return;
            openedFor.add(sessionId);
            openPreview();
          })
          .catch(() => {});
      };
      ctx.effect(() => {
        const timer = setInterval(watch, 4000);
        watch();
        return () => clearInterval(timer);
      }, 'dsh-motion: open the column when a film appears');

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
