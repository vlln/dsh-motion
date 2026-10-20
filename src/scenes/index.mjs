// Browser entry: 2D scenes are always bundled; the WebGL scene is a lazy chunk so
// projects without 3D never download three.

import * as firstPeoples from './first-peoples.mjs';
import * as coldWar from './cold-war.mjs';

const STATIC = [firstPeoples, coldWar];

const LAZY = {
  orbit: () => import('./orbit.mjs'),
};

export async function loadModules(sceneIds) {
  const wanted = new Set(sceneIds);
  const modules = STATIC.filter((m) => wanted.has(m.id));
  for (const id of wanted) {
    if (!LAZY[id]) continue;
    modules.push(await LAZY[id]());
  }
  return modules;
}
