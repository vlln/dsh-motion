// dsh-motion client half: a floating launcher that opens the motion panel.
// The panel is an iframe of /plugins/dsh-motion/app — the same preview the
// standalone dev server uses, so behaviour cannot drift between the two.

window.__ModuleLoader__.load({
  id: '@vlln/dsh-motion',
  factory: () => {
    const exports = {};
    const APP = '/plugins/dsh-motion/app';

    const STYLE = `
      [data-dshm-root] .dshm-btn {
        position: fixed; right: 18px; bottom: 18px; z-index: 60;
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 12px; border-radius: 999px;
        border: 1px solid var(--dsw-alias-border-base, #2a3a55);
        background: var(--dsw-alias-bg-elevated, #0f1b30);
        color: var(--dsw-alias-text-primary, #f2f2f0);
        font: 500 12px/1 Inter, system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 8px 24px rgb(0 0 0 / 35%);
      }
      [data-dshm-root] .dshm-btn:hover { border-color: #e0b040; color: #e0b040; }
      [data-dshm-root] .dshm-panel {
        position: fixed; inset: 0; z-index: 61;
        display: grid; place-items: center;
        background: rgb(4 8 16 / 62%); backdrop-filter: blur(3px);
      }
      [data-dshm-root] .dshm-panel[hidden] { display: none; }
      [data-dshm-root] .dshm-card {
        width: min(1280px, 92vw); height: min(820px, 88vh);
        display: flex; flex-direction: column; overflow: hidden;
        border: 1px solid var(--dsw-alias-border-base, #2a3a55); border-radius: 14px;
        background: #0b1426; box-shadow: 0 30px 90px rgb(0 0 0 / 55%);
      }
      [data-dshm-root] .dshm-head {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 12px; border-bottom: 1px solid #243450;
        color: #8b98ad; font: 11px/1 ui-monospace, Menlo, monospace;
      }
      [data-dshm-root] .dshm-head button {
        background: none; border: 0; color: #8b98ad; font-size: 18px; cursor: pointer;
      }
      [data-dshm-root] iframe { flex: 1; width: 100%; border: 0; background: #0b1426; }
    `;

    function apply(ctx) {
      if (document.querySelector('[data-dshm-root]')) return;

      const style = document.createElement('style');
      style.dataset.dshmStyle = '';
      style.textContent = STYLE;
      document.head.appendChild(style);

      const root = document.createElement('div');
      root.dataset.dshmRoot = '';
      root.innerHTML = `
        <button class="dshm-btn" data-dshm-toggle title="Open motion preview">◐ Motion</button>
        <div class="dshm-panel" data-dshm-panel hidden>
          <div class="dshm-card">
            <div class="dshm-head"><span>dsh-motion · preview</span><button data-dshm-close aria-label="close">×</button></div>
            <iframe title="dsh-motion preview" src="${APP}" loading="lazy"></iframe>
          </div>
        </div>`;
      document.body.appendChild(root);

      const panel = root.querySelector('[data-dshm-panel]');
      const toggle = () => {
        panel.hidden = !panel.hidden;
      };

      root.querySelector('[data-dshm-toggle]').addEventListener('click', toggle);
      root.querySelector('[data-dshm-close]').addEventListener('click', () => {
        panel.hidden = true;
      });
      panel.addEventListener('click', (e) => {
        if (e.target === panel) panel.hidden = true;
      });
      const onKey = (e) => {
        if (e.key === 'Escape') panel.hidden = true;
      };
      window.addEventListener('keydown', onKey);

      ctx?.effect?.(() => () => {
        window.removeEventListener('keydown', onKey);
        root.remove();
        style.remove();
      }, 'dsh-motion: launcher');
    }

    exports.name = 'dsh-motion-ui';
    exports.apply = apply;
    return exports;
  },
});
