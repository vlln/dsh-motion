// Loading the scenes a timeline names.
//
// There are no built-in scenes. A film brings its own code in scenes/<id>.mjs
// and this imports it at run time — which is what lets the agent write a shot
// and see it without rebuilding anything.

/**
 * @param {string[]} sceneIds
 * @param {string} base  where the film keeps its scenes
 */
export async function loadModules(sceneIds, base = "./scenes") {
  const wanted = [...new Set(sceneIds)];
  const modules = [];
  for (const id of wanted) {
    let mod;
    try {
      mod = await import(`${base}/${encodeURIComponent(id)}.mjs`);
    } catch (cause) {
      throw new Error(`scene "${id}" has no module at scenes/${id}.mjs`, { cause });
    }
    if (mod.id !== id) throw new Error(`scene module scenes/${id}.mjs declares id "${mod.id}"`);
    modules.push(mod);
  }
  return modules;
}
