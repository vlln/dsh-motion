// Browser entry: 2D scenes are always bundled; the WebGL scene is a lazy chunk so
// projects without 3D never download three.

import * as firstPeoples from './first-peoples.mjs';
import * as coldWar from './cold-war.mjs';
import * as textLab from './text-lab.mjs';
import * as mediaLab from './media-lab.mjs';
import * as dataLab from './data-lab.mjs';

const STATIC = [firstPeoples, coldWar, textLab, mediaLab, dataLab];

const LAZY = {
  orbit: () => import('./orbit.mjs'),
  cards3d: () => import('./cards3d.mjs'),
};

/**
 * Load the scenes a timeline names. Built-ins come from this bundle; anything
 * else is the film's own code, imported at run time from the same directory the
 * panel was mounted at. That is what lets the agent write a scene inside the
 * workspace and see it without rebuilding anything.
 */
export async function loadModules(sceneIds, base = './scenes') {
  const wanted = [...new Set(sceneIds)];
  const modules = [];
  for (const id of wanted) {
    const builtin = STATIC.find((m) => m.id === id);
    if (builtin) {
      modules.push(builtin);
      continue;
    }
    if (LAZY[id]) {
      modules.push(await LAZY[id]());
      continue;
    }
    let mod;
    try {
      mod = await import(`${base}/${encodeURIComponent(id)}.mjs`);
    } catch (cause) {
      throw new Error(`scene "${id}" is neither built in nor found at scenes/${id}.mjs`, { cause });
    }
    if (mod.id !== id) throw new Error(`scene module scenes/${id}.mjs declares id "${mod.id}"`);
    modules.push(mod);
  }
  return modules;
}
