import { makeHistoryScene } from './history.mjs';

const scene = makeHistoryScene({
  id: 'cold-war',
  slots: {
    era: { default: '1945 to 1991', role: 'caption', maxChars: 40 },
    title: { default: 'The Cold War', role: 'title', maxChars: 48 },
    subtitle: { default: 'Two superpowers face off', role: 'subtitle', maxChars: 80 },
    pin1Era: { default: '1945', role: 'data' },
    pin1Note: { default: 'Two superpowers', role: 'label', maxChars: 60 },
    pin2Era: { default: '1969', role: 'data' },
    pin2Note: { default: 'People walk on the Moon', role: 'label', maxChars: 60 },
    pin3Era: { default: '1975', role: 'data' },
    pin3Note: { default: 'Out of Vietnam', role: 'label', maxChars: 60 },
  },
  textUsage: {
    era: 1,
    title: 1,
    subtitle: 1,
    pin1Era: 1,
    pin1Note: 1,
    pin2Era: 1,
    pin2Note: 1,
    pin3Era: 1,
    pin3Note: 1,
  },
  ticks: [
    { at: 0.0, label: '1945' },
    { at: 0.25, label: '1955' },
    { at: 0.5, label: '1965' },
    { at: 0.75, label: '1975' },
    { at: 1.0, label: '1985' },
  ],
  pins: [
    { at: 0.18, tIn: 0.6, eraText: '1945', noteText: 'Two superpowers', elementId: 'superpowers' },
    { at: 0.62, tIn: 1.5 },
    { at: 0.80, tIn: 2.4 },
  ],
});

export const { id, kind, slots, textUsage, params, mount, render, hitTest } = scene;
