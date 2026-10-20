// Scene params: numeric knobs a scene declares so a human can tune them in the
// panel instead of round-tripping every 2px through the agent.
//
// Values live in timeline.params[sceneId][key]; a missing key means "use the
// spec default". Values are normalised (fractions of width/height or seconds)
// so a knob keeps its meaning when the canvas size changes.

export function resolveParam(timeline, scene, params, key) {
  const stored = timeline.params?.[scene.id]?.[key];
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored;

  const spec = params?.[key];
  if (spec && typeof spec.default === 'number') return spec.default;

  throw new Error(`param "${key}" is not declared by scene "${scene.id}"`);
}

/** Reject anything the scene cannot draw. Out-of-range is an error, not a clamp:
 *  a silently clamped value makes the panel lie about what the file contains. */
export function checkParam(params, key, value) {
  const declared = Object.keys(params ?? {});
  const spec = params?.[key];
  if (!spec) {
    throw new Error(`unknown param "${key}"; declared: ${declared.join(', ') || '(none)'}`);
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`param "${key}" must be a finite number (got ${JSON.stringify(value)})`);
  }
  if (value < spec.min || value > spec.max) {
    throw new Error(`param "${key}" must be ${spec.min}..${spec.max} (got ${value})`);
  }
  return value;
}

/** Shape the panel and the agent both read: one row per declared knob. */
export function describeParams(timeline, scene, params) {
  return Object.entries(params ?? {}).map(([key, spec]) => ({
    key,
    label: spec.label ?? key,
    min: spec.min,
    max: spec.max,
    step: spec.step ?? 0.01,
    default: spec.default,
    value: resolveParam(timeline, scene, params, key),
    unit: spec.unit ?? null,
  }));
}
