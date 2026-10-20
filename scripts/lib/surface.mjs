// Drive the real Cordis entry with a fake context so a gate can call the tools
// without a model, a browser, or a DSH install. Extracted because two gates need
// it: the surface gate (does every tool run?) and the reference gate (does the
// new tool return what the CLI returns?).

export async function loadTools(ROOT) {
  const { apply } = await import(`${ROOT}/lib/index.mjs`);

  const tools = new Map();
  const routes = [];
  const disposers = [];

  const ctx = {
    effect(fn) {
      disposers.push(fn());
    },
    tools: {
      register(tool) {
        tools.set(tool.name, tool);
        return () => {};
      },
    },
    inject(deps, cb) {
      if (!deps.includes('webServer')) return;
      cb({
        webServer: {
          register(route) {
            routes.push(route);
            return () => {};
          },
        },
        effect(fn) {
          fn();
        },
      });
    },
  };

  apply(ctx);
  return { tools, routes, dispose: () => disposers.forEach((d) => typeof d === 'function' && d()) };
}
