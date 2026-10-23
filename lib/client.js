// dsh-motion client half: a sidebar entry ("Motion") that opens the panel in the
// main area. The panel is an iframe of /plugins/dsh-motion/app — the same preview
// the standalone dev server uses, so behaviour cannot drift between the two.
//
// Registered through the host's slots API, which is React-based, so this file
// requires react from the platform seed instead of shipping its own copy.

window.__ModuleLoader__.load({
  id: '@vlln/dsh-motion',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;

    const APP = '/plugins/dsh-motion/app';
    const PANEL_ID = 'motion';

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

    /** The ◐ mark used by the plugin icon, at UI size and riding currentColor. */
    const MotionIcon = () =>
      h(
        'svg',
        { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true', focusable: 'false' },
        h('circle', { cx: 8, cy: 8, r: 6.1, fill: 'none', stroke: 'currentColor', strokeWidth: 1.4 }),
        h('path', { d: 'M8 1.9a6.1 6.1 0 0 1 0 12.2z', fill: 'currentColor' }),
      );

    /** Panel body: the playhead, scene strip, inspector, text/values/assets and comments. */
    const MotionPanel = () => {
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

      return h(
        'div',
        {
          'data-dshm-panel': '',
          style: { height: '100%', minHeight: 0, display: 'flex', background: 'var(--dsw-alias-bg-base, #fff)' },
        },
        h('iframe', {
          ref: frameRef,
          title: 'dsh-motion preview',
          src: APP,
          style: { flex: 1, width: '100%', border: 0, display: 'block', background: 'transparent' },
        }),
      );
    };

    function apply(ctx) {
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 40,
            label: () => 'Motion',
          },
          MotionIcon,
        ),
      );

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            label: () => 'Motion',
          },
          MotionPanel,
        ),
      );
    }

    return { name: 'dsh-motion-ui', inject: ['slots'], apply };
  },
});
