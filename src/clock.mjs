// The scene clock: what time a scene hears, given where it sits in the film.
//
// Two models, chosen per scene:
//   trim (no `duration` export) — the scene hears its own seconds; a shorter
//   slot cuts the tail off.
//   compress (`export const duration = 14`) — the scene still hears 0..14 on its
//   own stopwatch, but a 2s slot walks that span at 7x. Same frames, new tempo.
//
// `speed` multiplies in both models.

/**
 * @param scene - timeline scene entry ({ start, length, speed }).
 * @param naturalDuration - the scene module's declared natural length, if any.
 * @param t - absolute time in the film.
 * @returns the scene-local time handed to render().
 */
export function sceneTime(scene, naturalDuration, t) {
  const raw = Math.max(0, t - scene.start) * (Number(scene.speed) || 1);
  const natural = Number(naturalDuration);
  if (!(natural > 0) || !(scene.length > 0)) return raw;
  return raw * (natural / scene.length);
}
