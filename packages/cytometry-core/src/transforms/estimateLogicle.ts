import { percentile } from "../stats/descriptive.ts";
import { LogicleTransform } from "./logicle.ts";

/**
 * Data-driven logicle width W from the spread of the negative population:
 *   W = (M − log10(T / |r|)) / 2,  r = 5th percentile of the negative values.
 * Reimplemented from flowCore `estimateLogicle` (Artistic-2.0). Clamped to
 * [0, M/2] so the resulting LogicleTransform is always valid.
 */
export function estimateLogicleW(
  values: ArrayLike<number>,
  T = 262144,
  M = 4.5,
): number {
  const neg: number[] = [];
  for (let i = 0; i < values.length; i++) if (values[i] < 0) neg.push(values[i]);
  if (neg.length === 0) return 0.5;
  const sorted = Float64Array.from(neg).sort();
  const r = percentile(sorted, 5); // 5th percentile (toward most-negative)
  if (r >= 0) return 0.5;
  let w = (M - Math.log10(T / Math.abs(r))) / 2;
  if (!Number.isFinite(w) || w < 0) w = 0;
  if (w > M / 2) w = M / 2;
  return w;
}

export function estimateLogicle(
  values: ArrayLike<number>,
  T = 262144,
  M = 4.5,
  A = 0,
): LogicleTransform {
  return new LogicleTransform(T, estimateLogicleW(values, T, M), M, A);
}
