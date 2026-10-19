import { makeHistoryScene } from './history.mjs';

const scene = makeHistoryScene({
  id: 'first-peoples',
  slots: {
    era: { default: 'About 15,000 years ago', role: 'caption', maxChars: 40 },
    title: { default: 'The first peoples', role: 'title', maxChars: 48 },
    subtitle: { default: 'First people arrive from Siberia', role: 'subtitle', maxChars: 80 },
    pin1Era: { default: 'c. 13,000 BCE', role: 'data' },
    pin1Note: { default: 'First people arrive from Siberia', role: 'label', maxChars: 60 },
    pin2Era: { default: 'c. 11,000 BCE', role: 'data' },
    pin2Note: { default: 'Clovis culture spreads across the Americas', role: 'label', maxChars: 60 },
  },
  textUsage: {
    era: 1,
    title: 1,
    subtitle: 1,
    pin1Era: 1,
    pin1Note: 1,
    pin2Era: 1,
    pin2Note: 1,
  },
  ticks: [
    { at: 0.0, label: '16,000 BCE' },
    { at: 0.2, label: '14,000 BCE' },
    { at: 0.4, label: '12,000 BCE' },
    { at: 0.6, label: '10,000 BCE' },
    { at: 0.8, label: '8,000 BCE' },
    { at: 1.0, label: '6,000 BCE' },
  ],
  pins: [
    { at: 0.30, tIn: 1.8, eraText: 'c. 13,000 BCE', noteText: 'First people arrive from Siberia' },
    { at: 0.52, tIn: 3.4, eraText: 'c. 11,000 BCE', noteText: 'Clovis culture spreads across the Americas' },
  ],
});

export const { id, kind, slots, textUsage, mount, render, hitTest } = scene;
