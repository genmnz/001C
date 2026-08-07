import { kde1d } from "../density/kde.ts";
import type { Population } from "../population.ts";

/**
 * Proliferation / division-dye (CFSE, CellTrace) modeling — the FlowJo
 * Proliferation platform. A division-tracking dye halves in intensity at each
 * cell division, so a dividing population forms a ladder of equally-spaced peaks
 * on the (log/biexp-transformed) dye axis: generation 0 is the brightest,
 * generation i has intensity ≈ gen0 − i·spacing.
 *
 * This module (a) turns a dye histogram into per-generation counts by locating
 * the peak ladder (KDE) and assigning each event to its nearest generation, and
 * (b) computes the standard division-tracking indices (Roederer 2011). Because
 * generation i descends from N_i / 2^i original precursors, all indices are
 * computed on the *precursor* (division-corrected) counts, not the raw counts.
 */

export interface ProliferationIndices {
  /** Total measured cells (Σ Nᵢ). */
  total: number;
  /** Calculated original precursor cells (Σ Nᵢ/2ⁱ). */
  precursors: number;
  /** Precursors that divided at least once (Σ_{i≥1} Nᵢ/2ⁱ). */
  dividedPrecursors: number;
  /** % of precursors that divided. */
  percentDivided: number;
  /** Mean divisions over ALL precursors (Σ i·Nᵢ/2ⁱ ÷ Σ Nᵢ/2ⁱ). */
  divisionIndex: number;
  /** Mean divisions over RESPONDING precursors (÷ divided precursors only). */
  proliferationIndex: number;
  /** Fold expansion of the whole population (total ÷ precursors). */
  expansionIndex: number;
  /** Fold expansion of the responding cells only. */
  replicationIndex: number;
}

/**
 * Division-tracking indices from per-generation counts (`counts[i]` = cells in
 * generation i, i = 0 undivided). Pure and exact — the arithmetic core of the
 * platform.
 */
export function proliferationIndices(counts: ArrayLike<number>): ProliferationIndices {
  let total = 0;
  let precursors = 0; // Σ Nᵢ/2ⁱ
  let dividedPrecursors = 0; // Σ_{i≥1} Nᵢ/2ⁱ
  let dividedCells = 0; // Σ_{i≥1} Nᵢ
  let weightedDivisions = 0; // Σ i·Nᵢ/2ⁱ
  for (let i = 0; i < counts.length; i++) {
    const ni = counts[i];
    const prec = ni / 2 ** i;
    total += ni;
    precursors += prec;
    weightedDivisions += i * prec;
    if (i >= 1) {
      dividedPrecursors += prec;
      dividedCells += ni;
    }
  }
  return {
    total,
    precursors,
    dividedPrecursors,
    percentDivided: precursors > 0 ? (100 * dividedPrecursors) / precursors : 0,
    divisionIndex: precursors > 0 ? weightedDivisions / precursors : 0,
    proliferationIndex: dividedPrecursors > 0 ? weightedDivisions / dividedPrecursors : 0,
    expansionIndex: precursors > 0 ? total / precursors : 0,
    replicationIndex: dividedPrecursors > 0 ? dividedCells / dividedPrecursors : 0,
  };
}

export interface GenerationPeaks {
  /** Peak dye positions, brightest first (peaks[0] ≈ generation 0). */
  peaks: number[];
  /** Median spacing between adjacent generations on the dye axis. */
  spacing: number;
}

/**
 * Locate the generation peak ladder in a dye histogram via 1D KDE local maxima.
 * Peaks below `minProminence`·(max density) are discarded as noise.
 */
export function detectGenerationPeaks(
  values: ArrayLike<number>,
  opts: {
    bins?: number;
    bandwidth?: number;
    minProminence?: number;
    parent?: Population;
  } = {},
): GenerationPeaks {
  const { x, density } = kde1d(values, {
    bins: opts.bins ?? 256,
    bandwidth: opts.bandwidth,
    parent: opts.parent,
  });
  let maxD = 0;
  for (let i = 0; i < density.length; i++) if (density[i] > maxD) maxD = density[i];
  const floor = maxD * (opts.minProminence ?? 0.05);

  const peaks: number[] = [];
  for (let i = 1; i < density.length - 1; i++) {
    if (density[i] > floor && density[i] > density[i - 1] && density[i] >= density[i + 1]) {
      peaks.push(x[i]);
    }
  }
  peaks.sort((a, b) => b - a); // brightest (gen 0) first

  let spacing = 0;
  if (peaks.length >= 2) {
    const diffs: number[] = [];
    for (let i = 1; i < peaks.length; i++) diffs.push(peaks[i - 1] - peaks[i]);
    diffs.sort((a, b) => a - b);
    spacing = diffs[Math.floor(diffs.length / 2)]; // median adjacent spacing
  }
  return { peaks, spacing };
}

export interface ProliferationModel extends ProliferationIndices {
  /** Cells assigned to each generation (index = generation). */
  counts: number[];
  /** Generation label per input event (population order). */
  generations: Int32Array;
  /** Detected/used generation-0 (brightest) peak position. */
  gen0Peak: number;
  /** Inter-generation spacing used for assignment. */
  spacing: number;
  /** Peaks located during modeling (empty if `gen0Peak`+`spacing` were given). */
  peaks: number[];
}

/**
 * Full proliferation model: locate the peak ladder (unless `gen0Peak` +
 * `spacing` are supplied), assign every event to its nearest generation, and
 * compute the division-tracking indices. Assumes `values` are already on the
 * transformed dye axis where generations are equally spaced.
 */
export function modelProliferation(
  values: ArrayLike<number>,
  opts: {
    gen0Peak?: number;
    spacing?: number;
    maxGen?: number;
    bins?: number;
    bandwidth?: number;
    minProminence?: number;
    parent?: Population;
  } = {},
): ProliferationModel {
  let gen0Peak = opts.gen0Peak;
  let spacing = opts.spacing;
  let peaks: number[] = [];

  if (gen0Peak === undefined || spacing === undefined) {
    const detected = detectGenerationPeaks(values, opts);
    peaks = detected.peaks;
    if (peaks.length === 0) throw new Error("proliferation: no generation peaks found");
    gen0Peak = gen0Peak ?? peaks[0];
    spacing = spacing ?? detected.spacing;
  }
  if (!(spacing > 0)) {
    throw new Error("proliferation: spacing must be > 0 (single peak / no ladder)");
  }

  const maxGen = opts.maxGen ?? (peaks.length > 1 ? peaks.length - 1 : 10);

  // Assign each event to its nearest generation.
  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < values.length; i++) idx.push(i);

  const generations = new Int32Array(idx.length);
  const counts = new Array(maxGen + 1).fill(0);
  for (let p = 0; p < idx.length; p++) {
    let g = Math.round((gen0Peak - values[idx[p]]) / spacing);
    if (g < 0) g = 0;
    if (g > maxGen) g = maxGen;
    generations[p] = g;
    counts[g]++;
  }

  return {
    ...proliferationIndices(counts),
    counts,
    generations,
    gen0Peak,
    spacing,
    peaks,
  };
}
