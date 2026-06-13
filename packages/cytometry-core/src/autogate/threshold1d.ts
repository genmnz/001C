/**
 * 1D automated thresholding — the basis of unsupervised gating (openCyto's
 * `mindensity`, flowDensity). Two methods: Otsu (maximize between-class variance)
 * and density-valley (deepest local minimum between the two largest density
 * peaks). Both return a threshold in DATA space (callers turn it into a RangeGate
 * or two populations). Pure and testable on bimodal data.
 */
function range(values: ArrayLike<number>): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

function hist(
  values: ArrayLike<number>,
  bins: number,
  min: number,
  max: number,
): Float64Array {
  const counts = new Float64Array(bins);
  const s = bins / (max - min || 1);
  for (let i = 0; i < values.length; i++) {
    let b = ((values[i] - min) * s) | 0;
    if (b < 0) b = 0;
    else if (b >= bins) b = bins - 1;
    counts[b]++;
  }
  return counts;
}

import { kde1d } from "../density/kde.ts";

/** Quantile gate: the data value at event-quantile q (0..1). openCyto quantileGate. */
export function quantileThreshold(values: ArrayLike<number>, q: number): number {
  const sorted = Float64Array.from(values as ArrayLike<number>).sort();
  const n = sorted.length;
  if (n === 0) return NaN;
  const rank = Math.min(n - 1, Math.max(0, Math.round(q * (n - 1))));
  return sorted[rank];
}

/**
 * Tail gate: from the main density peak, walk toward the high tail until the KDE
 * falls below `fraction` of the peak density; that x is the cutpoint. openCyto
 * tailgate / cytokine-gate idea (KDE-based), clean-roomed from the description.
 */
export function tailThreshold(
  values: ArrayLike<number>,
  fraction = 0.05,
  bins = 256,
): number {
  const k = kde1d(values, { bins });
  let peak = 0;
  for (let i = 1; i < k.density.length; i++) if (k.density[i] > k.density[peak]) peak = i;
  const cut = k.density[peak] * fraction;
  for (let i = peak; i < k.density.length; i++) {
    if (k.density[i] < cut) return k.x[i];
  }
  return k.x[k.x.length - 1];
}

/** Otsu's method: the threshold (data value) maximizing between-class variance. */
export function otsuThreshold(
  values: ArrayLike<number>,
  bins = 256,
  min?: number,
  max?: number,
): number {
  const [lo, hi] = min != null && max != null ? [min, max] : range(values);
  const counts = hist(values, bins, lo, hi);
  const total = values.length;
  let sumAll = 0;
  for (let b = 0; b < bins; b++) sumAll += b * counts[b];

  let wB = 0;
  let sumB = 0;
  let bestVar = -1;
  let bestBin = 0;
  for (let b = 0; b < bins; b++) {
    wB += counts[b];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += b * counts[b];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      bestBin = b;
    }
  }
  const binWidth = (hi - lo) / bins;
  return lo + (bestBin + 0.5) * binWidth;
}

/** Deepest valley (local minimum) between the two largest peaks of a smoothed
 *  histogram. Returns the data value; falls back to Otsu if not clearly bimodal. */
export function densityValley(
  values: ArrayLike<number>,
  bins = 256,
  smoothWindow = 3,
  min?: number,
  max?: number,
): number {
  const [lo, hi] = min != null && max != null ? [min, max] : range(values);
  const raw = hist(values, bins, lo, hi);

  // Moving-average smoothing.
  const sm = new Float64Array(bins);
  for (let b = 0; b < bins; b++) {
    let s = 0;
    let c = 0;
    for (let k = -smoothWindow; k <= smoothWindow; k++) {
      const j = b + k;
      if (j >= 0 && j < bins) {
        s += raw[j];
        c++;
      }
    }
    sm[b] = s / c;
  }

  // Local maxima (peaks).
  const peaks: number[] = [];
  for (let b = 1; b < bins - 1; b++) {
    if (sm[b] >= sm[b - 1] && sm[b] > sm[b + 1]) peaks.push(b);
  }
  if (peaks.length < 2) return otsuThreshold(values, bins, lo, hi);

  // Two tallest peaks.
  peaks.sort((a, b) => sm[b] - sm[a]);
  const p1 = Math.min(peaks[0], peaks[1]);
  const p2 = Math.max(peaks[0], peaks[1]);

  // Lowest bin strictly between them.
  let valleyBin = p1;
  let valleyVal = Infinity;
  for (let b = p1 + 1; b < p2; b++) {
    if (sm[b] < valleyVal) {
      valleyVal = sm[b];
      valleyBin = b;
    }
  }
  const binWidth = (hi - lo) / bins;
  return lo + (valleyBin + 0.5) * binWidth;
}
