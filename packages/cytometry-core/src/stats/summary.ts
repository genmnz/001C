import { kde1d, type Kde1d } from "../density/kde.ts";
import type { Population } from "../population.ts";
import { extract, percentile } from "./descriptive.ts";

/**
 * Distribution-summary primitives the UI draws as violin / box / ridge plots:
 * a KDE silhouette plus the five-number summary (min, Q1, median, Q3, max).
 * Pure data — the renderer turns it into pixels.
 */
export interface ViolinData {
  kde: Kde1d;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export function violin(
  values: ArrayLike<number>,
  opts: { bins?: number; parent?: Population } = {},
): ViolinData {
  const data = opts.parent ? extract(opts.parent, values) : Float64Array.from(values as ArrayLike<number>);
  const sorted = Float64Array.from(data).sort();
  return {
    kde: kde1d(data, { bins: opts.bins ?? 128 }),
    min: sorted[0],
    q1: percentile(sorted, 25),
    median: percentile(sorted, 50),
    q3: percentile(sorted, 75),
    max: sorted[sorted.length - 1],
  };
}

/**
 * Absolute concentration via counting beads: cells/µL =
 * (population events / bead events) × beads-per-µL. The standard bead-based
 * absolute count for flow cytometry.
 */
export function absoluteConcentration(
  populationEvents: number,
  beadEvents: number,
  beadsPerMicroliter: number,
): number {
  if (beadEvents <= 0) return 0;
  return (populationEvents / beadEvents) * beadsPerMicroliter;
}
