// SAMPLE — not engine API. Delete this file and the engine is unaffected.
//
// A one-point camera for pictures that need depth. Do not reach for this when
// the style has no perspective: an Egyptian register, a pixel side-scroller and
// a Persian miniature all deliberately do not, and putting them in a camera is
// how a style turns into a generic illustration.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => {
  const l = Math.hypot(...v) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};

/**
 * @param {object} o
 * @param {number} o.w,o.h   frame size
 * @param {number} o.fov     vertical field of view, degrees
 * @param {number[]} o.eye   camera position
 * @param {number[]} o.look  point it looks at
 * @param {number} o.horizon screen height of the horizon, 0..1 (0.5 = centred)
 */
export function camera({ w = 1920, h = 1080, fov = 50, eye = [0, 1.6, 0], look = [0, 1.6, -1], horizon = 0.5 } = {}) {
  const fwd = unit(sub(look, eye));
  const right = unit(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const focal = (h / 2) / Math.tan((fov * Math.PI) / 360);

  /** World point -> screen point + depth. Depth is metres from the eye. */
  const project = (p) => {
    const d = sub(p, eye);
    const z = Math.max(0.001, dot(d, fwd));
    return [w / 2 + (dot(d, right) / z) * focal, h * horizon - (dot(d, up) / z) * focal, z];
  };

  /** How much something at depth z shrinks. */
  const scaleAt = (z) => focal / Math.max(0.001, z);

  /** Screen y for a horizontal plane at world height `y`, at depth z. */
  const groundY = (y, z) => h * horizon + ((eye[1] - y) / Math.max(0.001, z)) * focal;

  /** A quad on the ground plane, for roads, floors and water: four world points, projected. */
  const quad = (x0, x1, z0, z1, y = 0) => [project([x0, y, z0]), project([x1, y, z0]), project([x1, y, z1]), project([x0, y, z1])];

  return { w, h, eye, fwd, right, up, focal, project, scaleAt, groundY, quad };
}
