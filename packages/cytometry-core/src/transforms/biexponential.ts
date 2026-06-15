import { LogicleTransform } from "./logicle.ts";

/**
 * FlowJo-style biexponential parameterization. The logicle IS the Moore
 * biexponential; FlowJo's "Biex" exposes different knobs (max value, additional
 * negative decades, positive decades, and a width basis from the negative
 * population). This maps those to logicle (T, W, M, A), with W derived like
 * estimateLogicle: W = (M − log10(T/|widthBasis|))/2, clamped to a valid range.
 */
export interface FlowJoBiexParams {
  /** Top of scale (max channel value). */
  maxValue?: number;
  /** Negative reference (FlowJo "width basis", a negative number). */
  widthBasis?: number;
  /** Positive decades (M). */
  positiveDecades?: number;
  /** Additional negative decades (A). */
  extraNegativeDecades?: number;
}

export function flowJoBiex(params: FlowJoBiexParams = {}): LogicleTransform {
  const T = params.maxValue ?? 262144;
  const M = params.positiveDecades ?? 4.5;
  const A = params.extraNegativeDecades ?? 0;
  const widthBasis = params.widthBasis ?? -10;
  let W = (M - Math.log10(T / Math.abs(widthBasis || -10))) / 2;
  if (!Number.isFinite(W) || W < 0) W = 0;
  if (W > M / 2) W = M / 2;
  return new LogicleTransform(T, W, M, A);
}
