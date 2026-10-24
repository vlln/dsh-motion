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
  const pad = (sheet?.layers ?? []).find((l) => l && l.kind === 'pad' && Number.isFinite(Number(l.bpm)));
  if (!pad) return null;
  const bpm = Number(pad.bpm);
  const length = Number(sheet.length);
  const beats = [];
  for (let t = 0; t <= length + 1e-6; t += 60 / bpm) beats.push(Number(t.toFixed(3)));
  return { bpm, beats };
}
