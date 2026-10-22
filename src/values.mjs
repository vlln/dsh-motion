// Data slots: numbers that are part of the content, not of the layout. A param
// is something you tune to make the picture right; a value is something the
// viewer reads (a speed, a percentage, a count) and that a chart can also use.

export function resolveValue(timeline, scene, specs, key) {
  const stored = timeline.values?.[scene.id]?.[key];
  if (typeof stored === 'number' && Number.isFinite(stored)) return stored;

  const spec = specs?.[key];
  if (spec && typeof spec.default === 'number') return spec.default;

  throw new Error(`value "${key}" is not declared by scene "${scene.id}"`);
}

export function checkValue(specs, key, value) {
  const declared = Object.keys(specs ?? {});
  const spec = specs?.[key];
  if (!spec) throw new Error(`unknown value "${key}"; declared: ${declared.join(', ') || '(none)'}`);
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`value "${key}" must be a finite number (got ${JSON.stringify(value)})`);
  }
  if (value < spec.min || value > spec.max) {
    throw new Error(`value "${key}" must be ${spec.min}..${spec.max} (got ${value})`);
  }
  return value;
}

/** Format for display. `int` rounds, `decimal` keeps places, `percent` scales by 100. */
export function formatValue(value, spec = {}) {
  const format = spec.format ?? 'int';
  let body;
  if (format === 'int') body = String(Math.round(value));
  else if (format === 'decimal') body = value.toFixed(spec.places ?? 1);
  else if (format === 'percent') body = `${Math.round(value * 100)}%`;
  else if (format === 'compact') body = Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
  else throw new Error(`unknown value format "${format}" (int | decimal | percent | compact)`);
  return `${body}${spec.suffix ?? ''}`;
}

/** Shape the panel reads. */
export function describeValues(timeline, scene, specs) {
  return Object.entries(specs ?? {}).map(([key, spec]) => ({
    key,
    label: spec.label ?? key,
    min: spec.min,
    max: spec.max,
    step: spec.step ?? 1,
    format: spec.format ?? 'int',
    suffix: spec.suffix ?? '',
    default: spec.default,
    value: resolveValue(timeline, scene, specs, key),
    display: formatValue(resolveValue(timeline, scene, specs, key), spec),
  }));
}
