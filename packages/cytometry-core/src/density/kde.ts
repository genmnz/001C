import type { Population } from "../population.ts";

/**
 * 1D Gaussian kernel density estimate on a grid. Silverman's rule for default
 * bandwidth. Feeds violin/ridge plots and is the smooth basis for tail/peak
 * auto-gating. The grid evaluation (n×bins) is a Rust→WASM candidate at scale.
 */
export interface Kde1d {
  x: Float64Array;
  density: Float64Array;
  bandwidth: number;
}

const INV_SQRT_2PI = 1 / Math.sqrt(2 * Math.PI);

function collect(values: ArrayLike<number>, parent?: Population): Float64Array {
  if (!parent) return Float64Array.from(values as ArrayLike<number>);
  const out = new Float64Array(parent.count());
  let k = 0;
  parent.forEach((i) => {
    out[k++] = values[i];
  });
  return out;
}

export function silvermanBandwidth(sortedAsc: Float64Array): number {
  const n = sortedAsc.length;
  if (n < 2) return 1;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += sortedAsc[i];
  mean /= n;
  let varSum = 0;
  for (let i = 0; i < n; i++) varSum += (sortedAsc[i] - mean) ** 2;
  const std = Math.sqrt(varSum / n);
  const q1 = sortedAsc[Math.floor(0.25 * (n - 1))];
  const q3 = sortedAsc[Math.floor(0.75 * (n - 1))];
  const iqr = q3 - q1;
  const sigma = iqr > 0 ? Math.min(std, iqr / 1.349) : std || 1;
  return 0.9 * sigma * Math.pow(n, -1 / 5);
}

export function kde1d(
  values: ArrayLike<number>,
  opts: {
    min?: number;
    max?: number;
    bins?: number;
    bandwidth?: number;
    parent?: Population;
  } = {},
): Kde1d {
  const data = collect(values, opts.parent);
  const n = data.length;
  const sorted = Float64Array.from(data).sort();
  const min = opts.min ?? sorted[0];
  const max = opts.max ?? sorted[n - 1];
  const bins = opts.bins ?? 256;
  const h = opts.bandwidth ?? silvermanBandwidth(sorted);

  const x = new Float64Array(bins);
  const density = new Float64Array(bins);
  const step = (max - min) / (bins - 1 || 1);
  const inv = 1 / (n * h);
  for (let g = 0; g < bins; g++) {
    const xg = min + g * step;
    x[g] = xg;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const u = (xg - data[i]) / h;
      s += INV_SQRT_2PI * Math.exp(-0.5 * u * u);
    }
    density[g] = s * inv;
  }
  return { x, density, bandwidth: h };
}
