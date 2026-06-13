import type { Transform } from "./types.ts";

/**
 * Quantile transform — maps values to their empirical CDF rank in [0,1], fit from
 * a reference distribution. Useful for rank-normalizing channels or aligning
 * distributions. `scale` is the empirical CDF (fraction of reference ≤ x);
 * `unscale` is the inverse CDF (the q-quantile of the reference). It is a step
 * function, so the round-trip is approximate to the reference resolution.
 */
export class QuantileTransform implements Transform {
  readonly kind = "quantile";
  private readonly sorted: Float64Array;

  constructor(reference: ArrayLike<number>) {
    this.sorted = Float64Array.from(reference).sort();
  }

  /** data value -> quantile in [0,1] (empirical CDF). */
  scale(x: number): number {
    const n = this.sorted.length;
    if (n === 0) return 0;
    // upper-bound binary search: count of values <= x.
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.sorted[mid] <= x) lo = mid + 1;
      else hi = mid;
    }
    return lo / n;
  }

  /** quantile q in [0,1] -> data value (inverse CDF). */
  unscale(q: number): number {
    const n = this.sorted.length;
    if (n === 0) return 0;
    const idx = Math.min(n - 1, Math.max(0, Math.floor(q * n)));
    return this.sorted[idx];
  }
}
