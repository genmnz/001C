import { RectangleGate } from "../gating/rectangle.ts";
import type { Gate2D } from "../gating/types.ts";
import { EventMatrix } from "../matrix.ts";
import { Population } from "../population.ts";

/**
 * Data-cleaning / QC gates — the routine pre-processing every cytometry pipeline
 * does before analysis. Implemented as ordinary Gate2D / Population producers so
 * they compose with the gating engine. (Ports of the standard FSC/SSC-based
 * cleaning steps; openCyto/PeacoQC-style.)
 */

/**
 * Singlet gate: single cells have area ≈ height (a near-diagonal band in
 * e.g. FSC-A vs FSC-H); doublets/aggregates have a larger area/height ratio.
 * Inside iff ratioMin ≤ area/height ≤ ratioMax.
 */
export class SingletGate implements Gate2D {
  readonly kind = "singlet";
  constructor(
    /** area channel (x), e.g. FSC-A */
    readonly xChannel: string,
    /** height channel (y), e.g. FSC-H */
    readonly yChannel: string,
    readonly ratioMin = 0.8,
    readonly ratioMax = 1.2,
  ) {}
  contains(area: number, height: number): boolean {
    if (height <= 0) return false;
    const r = area / height;
    return r >= this.ratioMin && r <= this.ratioMax;
  }
}

/**
 * Debris gate: keep events ABOVE minimum scatter (debris sits at low FSC/SSC).
 * A rectangle open to +∞ on both axes.
 */
export function debrisGate(
  fscChannel: string,
  sscChannel: string,
  fscMin: number,
  sscMin: number,
): RectangleGate {
  return new RectangleGate(
    fscChannel,
    sscChannel,
    fscMin,
    Number.POSITIVE_INFINITY,
    sscMin,
    Number.POSITIVE_INFINITY,
  );
}

/**
 * Saturation mask: events whose value is below the saturation ceiling (`$PnR`
 * max) on a channel. Returns the kept population.
 */
export function saturationMask(
  column: ArrayLike<number>,
  max: number,
): Population {
  const pop = new Population(column.length, undefined, "non-saturated");
  for (let i = 0; i < column.length; i++) {
    if (column[i] < max) pop.set(i);
  }
  return pop;
}

/**
 * Margin/boundary mask: drop events sitting at instrument extremes (off-scale).
 * Keeps events strictly inside (min, max) on every named channel. Reimplemented
 * from flowCore's boundary filter (Artistic-2.0).
 */
export function marginMask(
  matrix: EventMatrix,
  bounds: Record<string, [number, number]>,
): Population {
  const entries = Object.entries(bounds).map(([name, range]) => ({
    col: matrix.columnByName(name),
    min: range[0],
    max: range[1],
  }));
  const pop = new Population(matrix.eventCount, undefined, "in-range");
  outer: for (let e = 0; e < matrix.eventCount; e++) {
    for (const { col, min, max } of entries) {
      const v = col[e];
      if (v <= min || v >= max) continue outer;
    }
    pop.set(e);
  }
  return pop;
}

/** Edge/time mask: keep events within an acquisition-time window [tMin, tMax). */
export function timeWindowMask(
  timeColumn: ArrayLike<number>,
  tMin: number,
  tMax: number,
): Population {
  const pop = new Population(timeColumn.length, undefined, "time-window");
  for (let i = 0; i < timeColumn.length; i++) {
    const t = timeColumn[i];
    if (t >= tMin && t < tMax) pop.set(i);
  }
  return pop;
}

export { flowCutQC } from "./qc.ts";
export { isolationForest } from "./isolation.ts";
export type { IsolationForestResult } from "./isolation.ts";
export { detectDrift } from "./drift.ts";
export type { DriftReport } from "./drift.ts";
