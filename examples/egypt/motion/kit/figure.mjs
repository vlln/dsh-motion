// SAMPLE — not engine API. Delete this file and the engine is unaffected.
//
// A jointed figure, not a clip-art person. What keeps a body from reading as a
// sticker is the weight: the hip sits over the supporting foot, the shoulder
// lifts when the arm reaches, the free arm hangs. Everything below is driven by
// a few numbers, so a personality is a parameter, not a redraw.
//
// This is a *skeleton*. Each style draws it its own way — an Egyptian profile,
// an 8-bit 14-colour quantise, a picture-book silhouette — and the ones that
// look wrong are the ones that skipped the skeleton.

import { capsule, lerp, smoothPath } from './brush.mjs';

/**
 * @param {object} o
 * @param {number} o.x,o.y     where the supporting foot stands
 * @param {number} o.height    head-to-heel, in pixels
 * @param {number} o.lean      torso tilt, radians (positive = forward)
 * @param {number} o.twist     shoulder line rotation, radians
 * @param {number} o.breathe   0..1, chest lift
 * @param {'left'|'right'} o.facing which way the body is turned
 */
export function joints({ x = 0, y = 0, height = 400, lean = 0, twist = 0, breathe = 0.5, facing = 'right' } = {}) {
  const s = height / 400;              // every number below is for a 400px figure
  const dir = facing === 'right' ? 1 : -1;
  const hip = [x, y - 190 * s];
  const chest = [hip[0] + Math.sin(lean) * 120 * s, hip[1] - Math.cos(lean) * 120 * s];
  const neck = [chest[0] + Math.sin(lean) * 22 * s, chest[1] - Math.cos(lean) * 22 * s];
  const headR = 34 * s;
  const head = [neck[0] + Math.sin(lean + twist * 0.2) * headR * 0.9, neck[1] - headR * 0.95 - breathe * 3 * s];
  const shoulder = [
    [chest[0] + dir * 16 * s, chest[1] + 6 * s],
    [chest[0] - dir * 16 * s, chest[1] + 6 * s],
  ];
  const knee = [hip[0] + dir * 6 * s, hip[1] + 92 * s];
  const ankle = [x, y];
  return {
    s,
    dir,
    headR,
    head,
    neck,
    chest,
    hip,
    shoulder,
    elbow: null, // filled by reach()
    knee,
    ankle,
    /** Length of an upper arm / forearm at this height. */
    arm: 72 * s,
  };
}

/** Two-bone IK. `bend` picks which way the elbow breaks (1 or -1). */
export function reach(root, target, upper, lower, bend = 1) {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const d = Math.min(upper + lower - 0.01, Math.hypot(dx, dy) || 0.01);
  const a = Math.acos(Math.max(-1, Math.min(1, (upper * upper + d * d - lower * lower) / (2 * upper * d))));
  const base = Math.atan2(dy, dx);
  const ang = base + a * bend;
  return [root[0] + Math.cos(ang) * upper, root[1] + Math.sin(ang) * upper];
}

/** A limb as a tapered stroke: thick at the joint, thin at the wrist. */
export function limb(g, a, b, w0, w1, color) {
  g.fillStyle = color;
  capsule(g, a, b, w0 / 2, w1 / 2);
  g.fill();
}

/** The torso as one smooth closed shape — a capsule the shoulder line can twist. */
export function torso(g, j, { width = 54, color = '#c98d5c' } = {}) {
  const w = width * j.s;
  const [l, r] = j.shoulder;
  const pts = [
    [r[0] + j.dir * w * 0.1, r[1]],
    [l[0], l[1]],
    [l[0] - w * 0.18, (l[1] + j.hip[1]) / 2],
    [j.hip[0] - w * 0.34, j.hip[1]],
    [j.hip[0] + w * 0.34, j.hip[1]],
    [r[0] + w * 0.22, (r[1] + j.hip[1]) / 2],
  ];
  g.fillStyle = color;
  smoothPath(g, pts, true, 0.9);
  g.fill();
}

/** Head: a circle plus a jaw, so it can be turned without looking like a coin. */
export function head(g, j, { color = '#e6b282', jaw = 0.78 } = {}) {
  const [hx, hy] = j.head;
  const r = j.headR;
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(hx, hy, r * 0.92, r, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(hx + j.dir * r * 0.16, hy + r * 0.5, r * 0.56 * jaw, r * 0.42, 0, 0, Math.PI);
  g.fill();
}

/** Walk cycle: the phase a foot is at, 0..1. Two steps per loop, mirrored. */
export function step(t, stride = 0.9) {
  const p = (t * 7) % 1;                 // 7 steps a second reads as a walk
  const swing = Math.sin(p * Math.PI * 2);
  return {
    phase: p,
    lift: Math.max(0, swing) * 26 * stride,
    forward: Math.cos(p * Math.PI * 2) * 30 * stride,
    bob: Math.abs(Math.sin(p * Math.PI * 2)) * 8 * stride,
  };
}

/** Blend two poses; a pose is just the joint names you care about. */
export function mix(a, b, k) {
  const out = {};
  for (const key of Object.keys(a)) {
    const va = a[key];
    const vb = b[key];
    out[key] = Array.isArray(va) && Array.isArray(vb) ? [lerp(va[0], vb[0], k), lerp(va[1], vb[1], k)] : vb ?? va;
  }
  return out;
}
