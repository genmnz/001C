import {
  benjaminiHochberg,
  log2FoldChange,
  mannWhitneyU,
} from "../stats/comparative.ts";

/**
 * Differential abundance — diffcyt-style (Weber et al. 2019,
 * doi:10.1038/s42003-019-0415-5). Build the cluster×sample count matrix, convert
 * to per-sample proportions, then test each cluster between two groups and apply
 * BH-FDR across clusters. This is the rank-based variant; an edgeR-style
 * negative-binomial GLM is a documented future swap (the heavy diffcyt default).
 */

/** Cluster×sample count + proportion matrices from per-event labels + sample ids. */
export function clusterAbundance(
  labels: ArrayLike<number>,
  sampleOf: ArrayLike<number>,
  nClusters: number,
  nSamples: number,
): { counts: Float64Array; proportions: Float64Array } {
  const counts = new Float64Array(nClusters * nSamples);
  const sampleTotals = new Float64Array(nSamples);
  for (let e = 0; e < labels.length; e++) {
    const c = labels[e];
    const s = sampleOf[e];
    counts[c * nSamples + s]++;
    sampleTotals[s]++;
  }
  const proportions = new Float64Array(nClusters * nSamples);
  for (let c = 0; c < nClusters; c++) {
    for (let s = 0; s < nSamples; s++) {
      const tot = sampleTotals[s];
      proportions[c * nSamples + s] = tot > 0 ? counts[c * nSamples + s] / tot : 0;
    }
  }
  return { counts, proportions };
}

export interface DaRow {
  cluster: number;
  meanA: number;
  meanB: number;
  log2FC: number;
  p: number;
  q: number;
}

/** Test each cluster's proportion between two sample groups; BH-adjust across clusters. */
export function differentialAbundance(
  proportions: Float64Array,
  nClusters: number,
  nSamples: number,
  groupA: number[],
  groupB: number[],
): DaRow[] {
  const rows: Omit<DaRow, "q">[] = [];
  const pvals: number[] = [];
  for (let c = 0; c < nClusters; c++) {
    const a = groupA.map((s) => proportions[c * nSamples + s]);
    const b = groupB.map((s) => proportions[c * nSamples + s]);
    const meanA = a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const meanB = b.reduce((x, y) => x + y, 0) / (b.length || 1);
    const { p } = mannWhitneyU(a, b);
    rows.push({ cluster: c, meanA, meanB, log2FC: log2FoldChange(meanA, meanB), p });
    pvals.push(p);
  }
  const q = benjaminiHochberg(pvals);
  return rows.map((r, i) => ({ ...r, q: q[i] }));
}
