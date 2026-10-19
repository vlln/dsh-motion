// Palette resolution: element override -> scene override -> scene palette -> main -> throw.
// Never fall back to black: a missing token is a bug, not a style.

export function makeResolver(timeline) {
  const palettes = timeline.palettes ?? {};
  const overrides = timeline.overrides ?? {};

  return function color(scene, token, elementId) {
    const chain = [];
    if (elementId) chain.push(overrides[`${scene.id}/${elementId}`]);
    chain.push(overrides[scene.id]);
    chain.push(palettes[scene.palette]);
    chain.push(palettes.main);

    for (const p of chain) {
      if (p && typeof p[token] === 'string') return p[token];
    }
    throw new Error(
      `palette token "${token}" is missing (scene=${scene.id}${elementId ? ` element=${elementId}` : ''})`,
    );
  };
}

/** Merge a patch into the timeline palettes. Used by UI and tests. */
export function patchPalettes(timeline, patch) {
  for (const [name, tokens] of Object.entries(patch)) {
    timeline.palettes[name] = { ...(timeline.palettes[name] ?? {}), ...tokens };
  }
}

/** #rrggbb -> [r,g,b] */
export function toRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`bad color: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
