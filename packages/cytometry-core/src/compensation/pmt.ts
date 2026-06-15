import { EventMatrix } from "../matrix.ts";
import { percentile } from "../stats/descriptive.ts";

/**
 * PMT / detector normalization. pmtNormalize rescales each named channel in
 * place so its median (or mean) matches a target — harmonizing detector gains
 * across instruments/days. detectorCorrection applies explicit per-channel gain
 * factors. Per-event rescale is the only cost (Rust→WASM candidate at scale).
 */
export function pmtNormalize(
  matrix: EventMatrix,
  targets: Record<string, number>,
  opts: { statistic?: "median" | "mean" } = {},
): void {
  const useMedian = (opts.statistic ?? "median") === "median";
  for (const [name, target] of Object.entries(targets)) {
    const col = matrix.columnByName(name);
    let stat: number;
    if (useMedian) {
      stat = percentile(Float64Array.from(col).sort(), 50);
    } else {
      let s = 0;
      for (let e = 0; e < col.length; e++) s += col[e];
      stat = s / col.length;
    }
    if (stat === 0) continue;
    const factor = target / stat;
    for (let e = 0; e < col.length; e++) col[e] *= factor;
  }
}

export function detectorCorrection(
  matrix: EventMatrix,
  gains: Record<string, number>,
): void {
  for (const [name, g] of Object.entries(gains)) {
    const col = matrix.columnByName(name);
    for (let e = 0; e < col.length; e++) col[e] *= g;
  }
}
