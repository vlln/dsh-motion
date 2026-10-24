#!/usr/bin/env node
// Paint gate: the camera is maths, so it can be checked without a canvas.
// Everything a shot leans on — where the horizon sits, how fast things shrink,
// what happens behind the eye — is asserted here. A camera that drifts quietly
// turns every room back into a front elevation, which is the failure this whole
// verb exists to prevent.

import { paint, space } from '../src/paint.mjs';
import { createGate } from './lib/gate.mjs';

const { check, finish } = createGate();
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;

const cam = space({ w: 1920, h: 1080, eye: [0, 1.6, 4], look: [0, 1.6, -6], fov: 50 });

// --- looking down the axis ---
const centre = cam.at(0, 1.6, -6);
check('a point straight ahead lands in the middle', near(centre[0], 960) && near(centre[1], 540), centre.map((v) => v.toFixed(1)).join(','));
check('the horizon of a level camera is the frame middle', near(cam.at(0, 1.6, -1000)[1], 540), cam.at(0, 1.6, -1000)[1].toFixed(2));

// --- symmetry: left and right of the axis are mirrors ---
const left = cam.at(-1, 1.6, -6);
const right = cam.at(1, 1.6, -6);
check('left and right of centre are symmetric', near(960 - left[0], right[0] - 960), `${(960 - left[0]).toFixed(1)} vs ${(right[0] - 960).toFixed(1)}`);

// --- perspective: twice as far is half as tall ---
const k10 = cam.at(0, 1.6, -6)[2];
const k20 = cam.at(0, 1.6, -16)[2];
check('twice the distance is half the scale', Math.abs(k10 / k20 - 2) < 0.01, `${k10.toFixed(2)} / ${k20.toFixed(2)}`);
check('depth(z) agrees with at()', near(cam.depth(-6), k10, 0.0001), `${cam.depth(-6).toFixed(3)}`);

// --- up and down: the floor is below, the ceiling above ---
check('the floor projects below the horizon', cam.at(0, 0, -6)[1] > 540);
check('the ceiling projects above the horizon', cam.at(0, 3.2, -6)[1] < 540);

// --- a camera that looks down moves the horizon up; that is the point ---
const low = space({ w: 1920, h: 1080, eye: [0, 1.6, 4], look: [0, 0.9, -6] });
check('looking down lifts the horizon line', low.at(0, 1.6, -1000)[1] < 520, low.at(0, 1.6, -1000)[1].toFixed(1));

// --- behind the eye is not mirrored into frame ---
check('a point behind the eye has no scale', cam.at(0, 1.6, 8)[2] === 0, String(cam.at(0, 1.6, 8)[2]));

// --- fov: a wider lens makes the same point smaller ---
const wide = space({ w: 1920, h: 1080, eye: [0, 1.6, 4], look: [0, 1.6, -6], fov: 80 });
check('a wider fov shrinks the scale', wide.at(0, 1.6, -6)[2] < cam.at(0, 1.6, -6)[2]);

// --- the surface the skill documents ---
for (const verb of ['space', 'smoothPath', 'capsule', 'wash', 'strokeOutline', 'grain']) {
  check(`ctx.paint.${verb} is exported`, typeof paint[verb] === 'function');
}

finish();
