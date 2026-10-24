// The score, synthesized from a cue sheet. No samples, no licences, no network:
// every layer is noise or sine shaped by a filter and an envelope, seeded so the
// same sheet always renders the same file.
//
// A sheet is one array of layers. A layer without `at` runs the whole film; a
// layer with `at` is an event dropped in at that second.
//
//   { "length": 60, "layers": [
//       { "kind": "rain", "gain": 0.6 },
//       { "kind": "roomtone", "gain": 0.5 },
//       { "kind": "pad", "gain": 0.18, "bpm": 56 },
//       { "kind": "page", "at": 34 },
//       { "kind": "wheel", "at": 56 } ] }

const TAU = Math.PI * 2;

/** Seeded noise. One generator per layer, so adding a cue never changes a bed. */
function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RBJ biquad. Coefs are recomputed only when a sweep moves them. */
function biquad(type, freq, q, sr) {
  const w0 = (TAU * freq) / sr;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  let b0, b1, b2;
  if (type === 'low') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
  } else if (type === 'high') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha;
  const c = { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
  return (x) => {
    const y = c.b0 * x + c.b1 * c.x1 + c.b2 * c.x2 - c.a1 * c.y1 - c.a2 * c.y2;
    c.x2 = c.x1;
    c.x1 = x;
    c.y2 = c.y1;
    c.y1 = y;
    return y;
  };
}

const env = (t, attack, decay) => (t < 0 ? 0 : t < attack ? t / attack : Math.exp(-(t - attack) / decay));

// --- notes and chords ---------------------------------------------------------
// A score says what to play in the vocabulary a musician would use: a key, a
// chord loop, a three-note motif, and sections counted in eighth notes. That is
// what makes sections able to *get shorter* instead of the tempo speeding up.

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "D3" -> 146.83 Hz. Middle C is C4 = 261.63. */
export function noteHz(name) {
  const hit = /^([A-G])([#b]?)(-?\d)$/.exec(String(name));
  if (!hit) throw new Error(`not a note: "${name}" (write D3, F#4, Bb2)`);
  const semis = NAMES[hit[1]] + (hit[2] === '#' ? 1 : hit[2] === 'b' ? -1 : 0) + (Number(hit[3]) + 1) * 12;
  return 440 * 2 ** ((semis - 69) / 12);
}

/** "D3" or "Bb" -> 0-11, the letter's pitch class without the octave. */
export function pitchClass(name) {
  const hit = /^([A-G])([#b]?)/.exec(String(name));
  if (!hit) throw new Error(`not a note: "${name}" (write D3, F#4, Bb2)`);
  return (NAMES[hit[1]] + (hit[2] === '#' ? 1 : hit[2] === 'b' ? -1 : 0) + 12) % 12;
}

/** Chord quality -> semitones above the root. Enough for a four-chord loop. */
const QUALITIES = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus4: [0, 5, 7],
  add9: [0, 4, 7, 14],
};

/** "Dm" -> { root: 2, semis: [0, 3, 7] }. */
export function parseChord(symbol) {
  const hit = /^([A-G])([#b]?)(.*)$/.exec(String(symbol));
  if (!hit) throw new Error(`not a chord: "${symbol}" (write Dm, Bb, F, C)`);
  const root = NAMES[hit[1]] + (hit[2] === '#' ? 1 : hit[2] === 'b' ? -1 : 0);
  const quality = QUALITIES[hit[3]];
  if (!quality) {
    throw new Error(`unknown chord quality "${hit[3]}" in "${symbol}" (available: ${Object.keys(QUALITIES).filter(Boolean).join(', ')})`);
  }
  return { root, semis: quality };
}

// --- voices -------------------------------------------------------------------
// Textbook parts only: a few partials, an attack, a decay. No samples, so the
// same score renders the same file on any machine.
const VOICES = {
  flute: { partials: [[1, 1], [2, 0.1], [3, 0.04]], attack: 0.05, decay: 0, sustain: 0.85, release: 0.14, breath: 0.05, pan: 0.15 },
  harp: { partials: [[1, 1], [2, 0.45], [3, 0.26], [4, 0.15], [5, 0.08]], attack: 0.004, decay: 0.55, release: 0.25, pan: -0.2 },
  harpsichord: { partials: [[1, 1], [3, 0.55], [5, 0.3], [7, 0.16]], attack: 0.003, decay: 0.32, release: 0.12, pan: -0.1 },
  organ: { partials: [[1, 1], [2, 0.5], [3, 0.3], [4, 0.2]], attack: 0.04, decay: 0, sustain: 0.9, release: 0.2, pan: 0 },
  marimba: { partials: [[1, 1], [4, 0.35], [10, 0.1]], attack: 0.002, decay: 0.22, release: 0.1, pan: 0.25 },
  square: { partials: [[1, 1], [3, 0.33], [5, 0.2], [7, 0.14], [9, 0.11]], attack: 0.002, decay: 0.5, release: 0.08, pan: 0 },
  saw: { partials: [[1, 1], [2, 0.5], [3, 0.33], [4, 0.25], [5, 0.2], [6, 0.16], [7, 0.14]], attack: 0.12, decay: 0, sustain: 0.8, release: 0.3, pan: 0 },
  bass: { partials: [[1, 1], [2, 0.35], [3, 0.12]], attack: 0.006, decay: 0.5, release: 0.1, pan: 0 },
};

export const VOICE_NAMES = Object.keys(VOICES);

/** One note. `t` is seconds since the note started; returns amplitude. */
function voice(name, freq, t, hold) {
  const v = VOICES[name] ?? VOICES.harp;
  const a = v.attack ?? 0.01;
  const end = Math.max(a + 0.02, hold);
  const shape =
    t < a ? t / a : v.decay ? Math.exp(-(t - a) / v.decay) : 1;
  const tail = t > end ? Math.max(0, 1 - (t - end) / (v.release ?? 0.1)) : 1;
  const gain = shape * tail * (v.sustain ?? 1);
  if (gain <= 0) return 0;
  let s = 0;
  for (const [h, amp] of v.partials) s += Math.sin(TAU * freq * h * t) * amp;
  return s * gain;
}


/**
 * One layer, in place. `n` samples, `sr` hertz. Everything here is a pure
 * function of the seed and the spec — no clock, no Math.random.
 */
function layer(kind, spec, n, sr, seed) {
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const rand = rng(seed);
  // Beds are noise and sit loud for their level; events have to sit on top of
  // them. These are mix defaults, not taste: without them the cues disappear.
  const gain = spec.gain ?? DEFAULT_GAIN[kind] ?? 0.5;

  if (kind === 'rain') {
    const hpL = biquad('high', 900, 0.7, sr);
    const hpR = biquad('high', 1100, 0.7, sr);
    const lpL = biquad('low', 7000, 0.6, sr);
    const lpR = biquad('low', 6500, 0.6, sr);
    let wander = 0;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if (i % 2400 === 0) wander = Math.sin(rand() * TAU) * 0.18;
      const body = 1 + wander + 0.06 * Math.sin(t * 0.23);
      L[i] = lpL(hpL(rand() * 2 - 1)) * body;
      R[i] = lpR(hpR(rand() * 2 - 1)) * body;
    }
  } else if (kind === 'roomtone') {
    const lpL = biquad('low', 220, 0.8, sr);
    const lpR = biquad('low', 200, 0.8, sr);
    const hpL = biquad('high', 35, 0.7, sr);
    const hpR = biquad('high', 35, 0.7, sr);
    for (let i = 0; i < n; i++) {
      L[i] = hpL(lpL(rand() * 2 - 1)) + 0.05 * Math.sin((TAU * 52 * i) / sr);
      R[i] = hpR(lpR(rand() * 2 - 1)) + 0.05 * Math.sin((TAU * 52.7 * i) / sr);
    }
  } else if (kind === 'wind') {
    const bp = biquad('band', 420, 1.4, sr);
    const bp2 = biquad('band', 380, 1.2, sr);
    const rate = spec.rate ?? 0.08;
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const gust = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(TAU * rate * t));
      L[i] = bp(rand() * 2 - 1) * gust;
      R[i] = bp2(rand() * 2 - 1) * gust;
    }
  } else if (kind === 'clock') {
    const every = spec.every ?? 1;
    const step = Math.max(1, Math.round(every * sr));
    for (let start = 0; start < n; start += step) {
      const f = 1900 + rand() * 500;
      const len = Math.round(0.05 * sr);
      for (let j = 0; j < len && start + j < n; j++) {
        const t = j / sr;
        const e = Math.exp(-t / 0.008);
        const v = Math.sin(TAU * f * t) * e * 0.5 + (rand() * 2 - 1) * e * 0.5;
        L[start + j] += v;
        R[start + j] += v * 0.85;
      }
    }
  } else if (kind === 'page') {
    const bp = biquad('band', 2400, 0.9, sr);
    const len = Math.round(0.5 * sr);
    for (let j = 0; j < len && j < n; j++) {
      const t = j / sr;
      // paper is a swell, not a hit: slow attack, quicker fall, a rustle on top
      const e = env(t, 0.12, 0.16) * (0.7 + 0.3 * Math.sin(TAU * 31 * t));
      const v = bp(rand() * 2 - 1) * e * 1.6;
      L[j] += v;
      R[j] += v * 0.82;
    }
  } else if (kind === 'bell') {
    const f0 = spec.freq ?? 880;
    const partials = [1, 2.76, 5.4, 8.93];
    const decay = spec.decay ?? 1.1;
    const len = Math.round(Math.min(n, decay * 4 * sr));
    for (let j = 0; j < len; j++) {
      const t = j / sr;
      let v = 0;
      partials.forEach((p, k) => {
        v += Math.sin(TAU * f0 * p * t) * Math.exp(-t / (decay / (1 + k * 0.7))) / (1 + k);
      });
      L[j] += v * 0.6;
      R[j] += v * 0.55;
    }
  } else if (kind === 'wheel') {
    const freqs = [58, 91, 137];
    const rumble = biquad('low', 180, 0.9, sr);
    const len = Math.round(2.2 * sr);
    for (let j = 0; j < len && j < n; j++) {
      const t = j / sr;
      const e = env(t, 0.25, 0.7);
      const creak = Math.sin(TAU * (freqs[0] + 14 * Math.sin(TAU * 3.1 * t)) * t) * 0.35;
      const v = (rumble(rand() * 2 - 1) * 0.9 + creak) * e;
      L[j] += v;
      R[j] += v * 0.9;
    }
  } else if (kind === 'pad') {
    const root = spec.root ?? 73.42; // D2
    const chord = spec.chord ?? [1, 1.5, 2, 2.4, 3];
    const bpm = spec.bpm ?? 60;
    const swell = (60 / bpm) * 2;
    const voices = chord.map((m, k) => ({ f: root * m, ph: rand() * TAU, det: 1 + (k % 2 ? 0.0018 : -0.0018) }));
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      // the pad breathes with the tempo and never dies out mid-film
      const breath = 0.72 + 0.28 * Math.sin((TAU * t) / swell);
      let l = 0;
      let r = 0;
      for (const v of voices) {
        l += Math.sin(TAU * v.f * t + v.ph);
        r += Math.sin(TAU * v.f * v.det * t + v.ph * 1.3);
      }
      const fade = Math.min(1, t / 2.5) * Math.min(1, (n / sr - t) / 2);
      L[i] = l * breath * fade * 0.16;
      R[i] = r * breath * fade * 0.16;
    }
  } else if (kind === 'score') {
    // A cue, not a bed. Sections are counted in eighth notes, so "faster" means
    // shorter sections rather than a faster tempo — which is what makes the cut
    // and the music land on the same grid.
    const bpm = Number(spec.bpm ?? 120);
    const eighth = 60 / bpm / 2;
    const keyName = spec.key ?? 'D3';
    const keySemis = pitchClass(keyName);
    const baseHz = noteHz(keyName);
    const chords = (spec.chords ?? ['Dm']).map(parseChord);
    const motif = Array.isArray(spec.motif) ? spec.motif : [0, 3, 7];
    const sections = Array.isArray(spec.sections) && spec.sections.length ? spec.sections : [{ eighths: 8, voice: 'harp' }];

    const add = (atSec, hold, hz, name, level, pan = 0) => {
      const start = Math.round(atSec * sr);
      if (start >= n) return;
      const v = VOICES[name] ?? VOICES.harp;
      const release = v.release ?? 0.1;
      const total = Math.round((hold + release) * sr);
      const lg = level * (1 - Math.max(0, pan) * 0.6);
      const rg = level * (1 + Math.min(0, pan) * 0.6);
      for (let j = 0; j < total; j++) {
        const i = start + j;
        if (i >= n) break;
        const a = voice(name, hz, j / sr, hold);
        if (a === 0) continue;
        L[i] += a * lg;
        R[i] += a * rg;
      }
    };

    const drum = (atSec, which) => {
      const start = Math.round(atSec * sr);
      if (start >= n) return;
      if (which === 'kick') {
        const len = Math.round(0.22 * sr);
        for (let j = 0; j < len && start + j < n; j++) {
          const t = j / sr;
          const f = 120 * Math.exp(-t / 0.045) + 46;
          const a = Math.sin(TAU * f * t) * Math.exp(-t / 0.09) * 0.9;
          L[start + j] += a;
          R[start + j] += a;
        }
      } else {
        const hp = biquad('high', 6500, 0.8, sr);
        const len = Math.round(0.06 * sr);
        for (let j = 0; j < len && start + j < n; j++) {
          const a = hp(rand() * 2 - 1) * Math.exp(-j / sr / 0.02) * 0.35;
          L[start + j] += a * 0.9;
          R[start + j] += a;
        }
      }
    };

    let cursor = 0;
    sections.forEach((section, index) => {
      const eighths = Math.max(0.25, Number(section.eighths ?? 4));
      const chord = chords[index % chords.length];
      // Keep the transposition inside a sixth: a chord four semitones below the
      // key should go up, not drop an octave and swallow the melody.
      let delta = chord.root - keySemis;
      while (delta > 6) delta -= 12;
      while (delta < -6) delta += 12;
      const rootHz = baseHz * 2 ** (delta / 12);
      const voiceName = section.voice ?? 'harp';
      const t0 = cursor * eighth;
      const span = eighths * eighth;

      add(t0, Math.min(span, eighth * 2), rootHz / 2, 'bass', 0.5);

      // The harmony under the motif: the triad, quiet, held for the section.
      for (const semis of chord.semis.slice(0, 3)) {
        add(t0, Math.min(span, eighth * 2), rootHz * 2 ** (semis / 12), 'organ', 0.13, 0.1);
      }

      // One statement of the motif per three eighths; a one-eighth section is
      // just the first note, which is exactly how a speed-up is written.
      for (let k = 0; k * 3 < eighths; k++) {
        motif.forEach((semis, j) => {
          if (k * 3 + j >= eighths) return;
          const hz = rootHz * 2 ** (semis / 12);
          add(t0 + (k * 3 + j) * eighth, eighth * 0.92, hz, voiceName, 0.4, index % 2 ? -0.25 : 0.25);
        });
      }

      if (section.drums ?? spec.drums) {
        drum(t0, 'kick');
        drum(t0 + span / 2, 'kick');
        for (let k = 0; k < eighths; k++) if (k % 2) drum(t0 + k * eighth, 'hat');
      }
      cursor += eighths;
    });
  } else if (kind === 'click') {
    const hp = biquad('high', 2500, 0.7, sr);
    const len = Math.round(0.03 * sr);
    for (let j = 0; j < len && j < n; j++) {
      const v = hp(rand() * 2 - 1) * Math.exp(-j / sr / 0.004);
      L[j] += v;
      R[j] += v;
    }
  } else {
    throw new Error(`unknown layer kind "${kind}" (available: ${Object.keys(KINDS).join(', ')})`);
  }

  for (let i = 0; i < n; i++) {
    L[i] *= gain;
    R[i] *= gain;
  }
  return [L, R];
}

/** Where each kind sits before the sheet's own gain. */
const DEFAULT_GAIN = {
  rain: 0.13,
  roomtone: 0.1,
  wind: 0.12,
  pad: 0.22,
  score: 0.5,
  clock: 0.38,
  page: 0.85,
  bell: 0.7,
  wheel: 0.7,
  click: 0.5,
};

/** Every kind a sheet may name, with the parameters it takes. */
export const KINDS = {
  rain: 'continuous. filtered noise, slow wander',
  roomtone: 'continuous. low rumble + faint mains hum',
  wind: 'continuous. band-passed noise with gusts',
  pad: 'continuous. slow chord that breathes with the tempo',
  score: 'continuous. a cue: bpm, chords, a motif, sections in eighth notes',
  clock: 'continuous. one tick per `every` second (default 1)',
  page: 'event. paper swell, about 0.5s',
  bell: 'event. inharmonic partials, `freq`, `decay`',
  wheel: 'event. wood rumble with a creak, about 2.2s',
  click: 'event. 30ms transient, for cuts',
};

/** Shape only — no samples. `check` calls this so a bad sheet fails before render. */
export function checkSheet(sheet) {
  const length = Number(sheet?.length);
  if (!Number.isFinite(length) || length <= 0) throw new Error('sheet.length must be a positive number of seconds');
  const layers = sheet.layers ?? [];
  if (!Array.isArray(layers)) throw new Error('sheet.layers must be an array');
  if (!layers.length) throw new Error('sheet.layers is empty — a film with no sound has no sheet at all');
  layers.forEach((spec, index) => {
    if (!spec || typeof spec !== 'object') throw new Error(`layers[${index}] must be an object`);
    if (!KINDS[spec.kind]) {
      throw new Error(`layers[${index}]: unknown kind "${spec.kind}" (available: ${Object.keys(KINDS).join(', ')})`);
    }
    const at = spec.at === undefined ? 0 : Number(spec.at);
    if (!Number.isFinite(at) || at < 0) throw new Error(`layers[${index}].at must be >= 0`);
    if (at > length) throw new Error(`layers[${index}].at is past the end of the film (${length}s)`);
    if (spec.kind === 'score') {
      // A score is the one kind with structure to get wrong. Check it here so a
      // typo fails in `check`, not 60 seconds into a render.
      noteHz(spec.key ?? 'D3');
      if (spec.chords !== undefined) {
        if (!Array.isArray(spec.chords) || !spec.chords.length) throw new Error(`layers[${index}].chords must be a non-empty array`);
        spec.chords.forEach((c) => parseChord(c));
      }
      if (spec.sections !== undefined) {
        if (!Array.isArray(spec.sections) || !spec.sections.length) throw new Error(`layers[${index}].sections must be a non-empty array`);
        spec.sections.forEach((section, k) => {
          const eighths = Number(section?.eighths ?? 4);
          if (!Number.isFinite(eighths) || eighths <= 0) throw new Error(`layers[${index}].sections[${k}].eighths must be > 0`);
          if (section?.voice !== undefined && !VOICES[section.voice]) {
            throw new Error(`layers[${index}].sections[${k}]: unknown voice "${section.voice}" (available: ${Object.keys(VOICES).join(', ')})`);
          }
        });
      }
    }
  });
  return { length, layers };
}

/**
 * Fill in what the film already knows, then check. A score is as long as the
 * cut: the sheet only has to state a length when it disagrees on purpose.
 */
export function sheetFor(sheet, duration) {
  const filled = { ...sheet };
  if (filled.length === undefined) filled.length = duration;
  else if (duration != null && Math.abs(Number(filled.length) - Number(duration)) > 0.01) {
    throw new Error(`sheet is ${filled.length}s but the film is ${duration}s — drop "length" and it follows the cut`);
  }
  checkSheet(filled);
  return filled;
}

/**
 * Render a sheet to stereo float. Deterministic: the same sheet gives the same
 * samples, so the file can be re-made after any edit and still match the cut.
 */
export function renderSheet(sheet, { sampleRate = 48000 } = {}) {
  const { length, layers } = checkSheet(sheet);
  const n = Math.round(length * sampleRate);
  const L = new Float32Array(n);
  const R = new Float32Array(n);

  layers.forEach((spec, index) => {
    const at = spec.at === undefined ? 0 : Number(spec.at);
    const offset = Math.round(at * sampleRate);
    const [l, r] = layer(spec.kind, spec, n - offset, sampleRate, 1000 + index * 77);
    for (let i = 0; i < l.length && offset + i < n; i++) {
      L[offset + i] += l[i];
      R[offset + i] += r[i];
    }
  });

  // Soft clip, then peak-normalise. The mix is many quiet layers; mux normalises
  // loudness later, so all this has to do is leave headroom and never wrap.
  let peak = 0;
  for (let i = 0; i < n; i++) {
    L[i] = Math.tanh(L[i]);
    R[i] = Math.tanh(R[i]);
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  }
  const trim = peak > 0 ? 0.5 / peak : 1;
  for (let i = 0; i < n; i++) {
    L[i] *= trim;
    R[i] *= trim;
  }
  return { left: L, right: R, sampleRate, length };
}

/** 16-bit stereo WAV. The only container ffmpeg and the browser both accept blindly. */
export function toWav({ left, right, sampleRate }) {
  const n = left.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767))), 44 + i * 4);
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767))), 46 + i * 4);
  }
  return buf;
}

/** The beat grid of a sheet, when it has a tempo — so scenes can hit the score. */
export function beatGrid(sheet) {
  const source = (sheet?.layers ?? []).find(
    (l) => l && (l.kind === 'pad' || l.kind === 'score') && Number.isFinite(Number(l.bpm)),
  );
  if (!source) return null;
  const bpm = Number(source.bpm);
  const length = Number(sheet.length);
  const beats = [];
  for (let t = 0; t <= length + 1e-6; t += 60 / bpm) beats.push(Number(t.toFixed(3)));
  return { bpm, beats };
}
