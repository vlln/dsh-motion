// Reference analysis: turn a video into the structure a scene writer needs.
// Pure functions over decoded frames — the ffmpeg plumbing lives in scripts/.
// No clock and no randomness: the same file must produce the same JSON.

const round = (v, n) => Number(v.toFixed(n));

/** Mean absolute difference of two gray frames, normalised to 0..1. */
export function meanAbsDiff(a, b, width, height) {
  const n = width * height;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += Math.abs(a[i] - b[i]);
  return sum / n / 255;
}

/**
 * Cuts are local maxima of the frame-difference series, thinned by `minGap` so a
 * dissolve does not count three times.
 *
 * Two kinds, because films cut in two ways:
 *  - hard: the frame changes more than `threshold` (a real cut to new footage)
 *  - soft: the frame changes little in absolute terms but far more than the
 *    second before it (`floor` .. `threshold`, `ratio` x the trailing median) —
 *    the signature of a scene swap on a shared background, which is how this
 *    house style cuts. Without this a continuous-palette film reports "one long
 *    shot". The comparison is trailing on purpose: a cut into a moving shot must
 *    be measured against the shot it leaves, not the motion it lands in.
 */
export function findCuts(series, { threshold = 0.12, minGap = 0.25, reach = 2, floor = 0.012, ratio = 3 } = {}) {
  const isPeak = (i) => {
    for (let j = Math.max(0, i - reach); j <= Math.min(series.length - 1, i + reach); j++) {
      if (j !== i && series[j].v > series[i].v) return false;
    }
    return true;
  };

  // Hard cuts first: they are unambiguous, and they reset what "quiet" means.
  const hard = [];
  for (let i = 0; i < series.length; i++) {
    if (series[i].v >= threshold && isPeak(i)) hard.push(i);
  }
  const hardKept = thin(hard, series, minGap);

  const soft = [];
  for (let i = 0; i < series.length; i++) {
    const v = series[i].v;
    if (v < floor || v >= threshold || !isPeak(i)) continue;

    // Measure against the shot it leaves: the last second, but never across a
    // hard cut (otherwise the first frames of a moving new shot look like spikes).
    const lastHard = hardKept.filter((k) => k < i).at(-1) ?? -1;
    const from = Math.max(0, i - 10, lastHard + 1);
    const window = series.slice(from, i).map((p) => p.v).sort((a, b) => a - b);
    const median = window.length ? window[Math.floor(window.length / 2)] : 0;
    const spike = v / Math.max(median, 1e-3);
    if (spike >= ratio) soft.push({ index: i, spike });
  }
  const softKept = thin(soft.map((c) => c.index), series, minGap);

  const out = [
    ...hardKept.map((i) => ({ t: series[i].t, score: series[i].v, kind: 'hard', spike: null })),
    ...softKept.map((i) => {
      const cand = soft.find((c) => c.index === i);
      return { t: series[i].t, score: series[i].v, kind: 'soft', spike: cand?.spike ?? null };
    }),
  ].sort((a, b) => a.t - b.t);

  return out.map((c) => ({
    t: round(c.t, 2),
    score: round(c.score, 3),
    kind: c.kind,
    ...(c.spike === null ? {} : { spike: round(c.spike, 1) }),
  }));
}

/** Keep the strongest candidate inside each `minGap` window. */
function thin(indices, series, minGap) {
  const kept = [];
  for (const i of [...indices].sort((a, b) => series[b].v - series[a].v)) {
    if (kept.some((k) => Math.abs(series[k].t - series[i].t) < minGap)) continue;
    kept.push(i);
  }
  return kept.sort((a, b) => a - b);
}

export function motionSummary(series, { window = 0.5 } = {}) {
  const values = series.map((p) => p.v);
  const sorted = [...values].sort((a, b) => a - b);
  const buckets = new Map();
  for (const p of series) {
    const key = Math.floor(p.t / window);
    const list = buckets.get(key) ?? [];
    list.push(p.v);
    buckets.set(key, list);
  }
  const curve = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, list]) => ({ t: round((key + 0.5) * window, 2), v: round(list.reduce((a, b) => a + b, 0) / list.length, 3) }));

  return {
    mean: round(sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0, 3),
    p90: round(sorted.length ? sorted[Math.round(0.9 * (sorted.length - 1))] : 0, 3),
    max: round(sorted.length ? sorted[sorted.length - 1] : 0, 3),
    curve,
  };
}

const hex = (r, g, b) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * 12-bit-per-channel histogram (4 bits each). Cheap, order-independent, and
 * stable at 96px — enough to answer "what is this shot made of", not a colour
 * science tool.
 */
export class Palette {
  constructor() {
    this.buckets = new Map();
    this.total = 0;
  }

  add(buf, width, height) {
    const n = width * height;
    for (let i = 0; i < n; i++) {
      const r = buf[i * 3];
      const g = buf[i * 3 + 1];
      const b = buf[i * 3 + 2];
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      let entry = this.buckets.get(key);
      if (!entry) {
        entry = { n: 0, r: 0, g: 0, b: 0 };
        this.buckets.set(key, entry);
      }
      entry.n++;
      entry.r += r;
      entry.g += g;
      entry.b += b;
    }
    this.total += n;
  }

  top(count = 5) {
    return [...this.buckets.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, count)
      .map((e) => ({ hex: hex(e.r / e.n, e.g / e.n, e.b / e.n), share: round(e.n / this.total, 3) }));
  }
}
