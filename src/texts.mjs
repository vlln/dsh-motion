// Text slots: data, not code. A scene declares slots + defaults; the timeline
// stores overrides. Editing a slot never recompiles a scene.

export function resolveText(timeline, scene, slots, slot) {
  const stored = timeline.texts?.[scene.id]?.[slot];
  if (typeof stored === 'string') return stored;

  const spec = slots?.[slot];
  if (spec && typeof spec.default === 'string') return spec.default;

  console.warn(`[motion] slot "${slot}" missing in scene "${scene.id}"`);
  return '';
}

/** Write a slot. Throws when the slot was never declared by the scene. */
export function setText(timeline, scene, slots, slot, value) {
  if (!slots || !(slot in slots)) {
    throw new Error(
      `unknown slot "${slot}" for scene "${scene.id}"; available: ${Object.keys(slots ?? {}).join(', ') || '(none)'}`,
    );
  }
  timeline.texts ??= {};
  timeline.texts[scene.id] ??= {};
  timeline.texts[scene.id][slot] = String(value);
}

/**
 * Usage counting: the timeline/UI wants "changes N places".
 * We count reads per render pass and compare with the scene's declaration.
 */
export function makeCounter() {
  let counts = Object.create(null);
  return {
    reset() {
      counts = Object.create(null);
    },
    hit(slot) {
      counts[slot] = (counts[slot] ?? 0) + 1;
    },
    snapshot() {
      return { ...counts };
    },
    verify(scene) {
      const declared = scene.textUsage ?? {};
      const warnings = [];
      for (const [slot, n] of Object.entries(counts)) {
        if (!(slot in declared)) warnings.push(`slot "${slot}" read but not declared in textUsage`);
        else if (n > declared[slot]) warnings.push(`slot "${slot}" read ${n}×, declared ${declared[slot]}×`);
      }
      return warnings;
    },
  };
}
