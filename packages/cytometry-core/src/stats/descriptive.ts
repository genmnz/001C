import { Population } from "../population.ts";

/**
 * Per-population descriptive statistics over one channel. These are the numbers a
 * cytometrist reads off a gate: count, frequency, MFI (median), and spread. The
 * live gate-drag path needs these in <100ms at millions of events; this is the
 * headless TS reference, with median/percentile being the candidates to push
 * into the Rust/WASM SIMD kernel if profiling demands it (see docs/DERISKING.md).
 */
export interface ChannelStats {
  count: number;
  mean: number;
  median: number;
  geometricMean: number;
  stdev: number;
  /** Robust coefficient of variation (%): 100 * stdev / mean. */
  cv: number;
  /** Median absolute deviation. */
  mad: number;
  min: number;
  max: number;
}

/** Extract a population's values for one channel into a dense scratch array. */
export function extract(pop: Population, column: ArrayLike<number>): Float64Array {
  const out = new Float64Array(pop.count());
  let k = 0;
  pop.forEach((i) => {
    out[k++] = column[i];
  });
  return out;
}

export function percentile(sorted: Float64Array, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];
  // Linear interpolation between closest ranks.
  const rank = (p / 100) * (n - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

export function median(values: Float64Array): number {
  const sorted = Float64Array.from(values).sort();
  return percentile(sorted, 50);
}

export function channelStats(
  pop: Population,
  column: ArrayLike<number>,
): ChannelStats {
  const values = extract(pop, column);
  const n = values.length;
  if (n === 0) {
    return {
      count: 0,
      mean: NaN,
      median: NaN,
      geometricMean: NaN,
      stdev: NaN,
      cv: NaN,
      mad: NaN,
      min: NaN,
      max: NaN,
    };
  }

  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let logSum = 0;
  let positives = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
    if (v > 0) {
      logSum += Math.log(v);
      positives++;
    }
  }
  const mean = sum / n;

  let varSum = 0;
  for (let i = 0; i < n; i++) {
    const d = values[i] - mean;
    varSum += d * d;
  }
  const stdev = Math.sqrt(varSum / n);

  const sorted = Float64Array.from(values).sort();
  const med = percentile(sorted, 50);

  // MAD: median of |x - median|.
  const dev = new Float64Array(n);
  for (let i = 0; i < n; i++) dev[i] = Math.abs(values[i] - med);
  dev.sort();
  const mad = percentile(dev, 50);

  const geometricMean = positives > 0 ? Math.exp(logSum / positives) : NaN;

  return {
    count: n,
    mean,
    median: med,
    geometricMean,
    stdev,
    cv: mean !== 0 ? (100 * stdev) / Math.abs(mean) : NaN,
    mad,
    min,
    max,
  };
}

/** Frequency of a population relative to a parent and to the whole sample. */
export interface Frequency {
  count: number;
  ofParent: number;
  ofTotal: number;
}

export function frequency(
  pop: Population,
  parent: Population | null,
  total: number,
): Frequency {
  const count = pop.count();
  const parentCount = parent ? parent.count() : total;
  return {
    count,
    ofParent: parentCount > 0 ? count / parentCount : 0,
    ofTotal: total > 0 ? count / total : 0,
  };
}
