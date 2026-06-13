import { EventMatrix } from "../matrix.ts";
import type { Population } from "../population.ts";
import { extract, percentile } from "../stats/descriptive.ts";
import type { SpilloverMatrix } from "./apply.ts";

/**
 * Estimate a spillover matrix from single-stain controls. For each control i
 * (stained for channel i), take the median of every channel over the positive
 * population; row i is medians normalized by the stained channel's median, so the
 * diagonal is 1. Reimplemented from flowCore `spillover()` (Artistic-2.0).
 */
export interface SingleStainControl {
  stainChannel: string;
  matrix: EventMatrix;
  /** Positive population to measure (defaults to all events). */
  positive?: Population;
}

function medianOf(
  matrix: EventMatrix,
  channel: string,
  pop?: Population,
): number {
  const col = matrix.columnByName(channel);
  if (pop) {
    const vals = extract(pop, col);
    vals.sort();
    return percentile(vals, 50);
  }
  const vals = Float64Array.from(col).sort();
  return percentile(vals, 50);
}

/** Build a spillover matrix from medians[i][j] (control i, channel j). */
export function spilloverFromMedians(
  medians: number[][],
  channels: string[],
): SpilloverMatrix {
  const n = channels.length;
  const values = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    const diag = medians[i][i] || 1;
    for (let j = 0; j < n; j++) values[i * n + j] = medians[i][j] / diag;
  }
  return { channels, values };
}

export function spilloverFromControls(
  controls: SingleStainControl[],
  channels: string[],
): SpilloverMatrix {
  const byStain = new Map(controls.map((c) => [c.stainChannel, c]));
  const medians: number[][] = channels.map((stain) => {
    const ctrl = byStain.get(stain);
    if (!ctrl) throw new Error(`spillover: missing control for ${stain}`);
    return channels.map((j) => medianOf(ctrl.matrix, j, ctrl.positive));
  });
  return spilloverFromMedians(medians, channels);
}
