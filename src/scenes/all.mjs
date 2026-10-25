// Node-only view of every scene (validation, text editing). The browser never
// imports this: see index.mjs for the lazy split.
import * as firstPeoples from './first-peoples.mjs';
import * as coldWar from './cold-war.mjs';
import * as textLab from './text-lab.mjs';
import * as mediaLab from './media-lab.mjs';
import * as dataLab from './data-lab.mjs';

export const modules = [firstPeoples, coldWar, textLab, mediaLab, dataLab];
