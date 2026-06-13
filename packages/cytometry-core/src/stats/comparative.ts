import { Population } from "../population.ts";

/**
 * Comparative & differential statistics — the numbers that turn per-population
 * counts into biology: fold change, marker positivity, co-expression, diversity,
 * and a non-parametric differential-abundance test. Pure functions over columns
 * and populations; ports of standard cytometry/biostat formulas (flowCore /
 * CytoExploreR / diffcyt).
 */

export function foldChange(a: number, b: number): number {
  if (b === 0) return a === 0 ? 1 : Infinity;
  return a / b;
}
export function log2FoldChange(a: number, b: number): number {
  return Math.log2(foldChange(a, b));
}

/** Fraction of a population with column value strictly above a threshold. */
export function markerPositivity(
  pop: Population,
  column: ArrayLike<number>,
  threshold: number,
): number {
  let pos = 0;
  let n = 0;
  pop.forEach((i) => {
    n++;
    if (column[i] > threshold) pos++;
  });
  return n === 0 ? 0 : pos / n;
}

export interface CoExpression {
  bothPositive: number;
  aOnly: number;
  bOnly: number;
  neither: number;
  /** Fraction positive for both. */
  doublePositiveFraction: number;
}

export function coExpression(
  pop: Population,
  columnA: ArrayLike<number>,
  thresholdA: number,
  columnB: ArrayLike<number>,
  thresholdB: number,
): CoExpression {
  let both = 0;
  let aOnly = 0;
  let bOnly = 0;
  let neither = 0;
  pop.forEach((i) => {
    const a = columnA[i] > thresholdA;
    const b = columnB[i] > thresholdB;
    if (a && b) both++;
    else if (a) aOnly++;
    else if (b) bOnly++;
    else neither++;
  });
  const total = both + aOnly + bOnly + neither;
  return {
    bothPositive: both,
    aOnly,
    bOnly,
    neither,
    doublePositiveFraction: total === 0 ? 0 : both / total,
  };
}

/** Shannon diversity H = -Σ p·ln(p) over population-abundance counts. */
export function shannonDiversity(counts: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i];
  if (total === 0) return 0;
  let h = 0;
  for (let i = 0; i < counts.length; i++) {
    const p = counts[i] / total;
    if (p > 0) h -= p * Math.log(p);
  }
  return h;
}

/** Simpson diversity 1 - Σ p². */
export function simpsonDiversity(counts: ArrayLike<number>): number {
  let total = 0;
  for (let i = 0; i < counts.length; i++) total += counts[i];
  if (total === 0) return 0;
  let s = 0;
  for (let i = 0; i < counts.length; i++) {
    const p = counts[i] / total;
    s += p * p;
  }
  return 1 - s;
}

// --- Mann–Whitney U (rank-sum), with a normal-approximation two-sided p ---

function erf(x: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export interface MannWhitney {
  U: number;
  z: number;
  p: number;
}

export function mannWhitneyU(a: number[], b: number[]): MannWhitney {
  const n1 = a.length;
  const n2 = b.length;
  const all = [
    ...a.map((v) => ({ v, g: 0 })),
    ...b.map((v) => ({ v, g: 1 })),
  ].sort((x, y) => x.v - y.v);

  // Average ranks for ties.
  const ranks = new Array(all.length);
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const avg = (i + j) / 2 + 1; // 1-based average rank
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  let r1 = 0;
  for (let k = 0; k < all.length; k++) if (all[k].g === 0) r1 += ranks[k];

  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const u2 = n1 * n2 - u1;
  const U = Math.min(u1, u2);

  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = sigma === 0 ? 0 : (U - mu) / sigma;
  const p = sigma === 0 ? 1 : 2 * normalCdf(-Math.abs(z));
  return { U, z, p };
}

export interface DifferentialAbundance {
  meanA: number;
  meanB: number;
  log2FC: number;
  U: number;
  p: number;
}

/** Compare a population's per-sample frequencies between two groups. */
export function differentialAbundance(
  groupA: number[],
  groupB: number[],
): DifferentialAbundance {
  const mean = (x: number[]) => (x.length ? x.reduce((s, v) => s + v, 0) / x.length : 0);
  const meanA = mean(groupA);
  const meanB = mean(groupB);
  const { U, p } = mannWhitneyU(groupA, groupB);
  return { meanA, meanB, log2FC: log2FoldChange(meanA, meanB), U, p };
}
