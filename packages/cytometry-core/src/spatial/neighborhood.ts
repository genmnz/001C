import { knn } from "../graph/knn.ts";

/**
 * Spatial neighborhood enrichment for imaging/IMC data — squidpy-style
 * (reimplemented; squidpy is BSD). Over a kNN graph in physical space, count
 * co-occurrence of cell-type pairs in neighborhoods and compare to the
 * frequency-based expectation. enrichment > 1 ⇒ the pair co-locates more than
 * chance; < 1 ⇒ segregated.
 */
export interface NeighborhoodEnrichment {
  nTypes: number;
  /** Observed neighbor-pair counts, row-major nTypes×nTypes. */
  observed: Float64Array;
  /** observed / expected (frequency model), row-major nTypes×nTypes. */
  enrichment: Float64Array;
}

export function neighborhoodEnrichment(
  coords: ArrayLike<number>[],
  labels: ArrayLike<number>,
  nTypes: number,
  k = 6,
): NeighborhoodEnrichment {
  const g = knn(coords, k);
  const n = g.n;
  const observed = new Float64Array(nTypes * nTypes);
  const freq = new Float64Array(nTypes);
  for (let i = 0; i < n; i++) freq[labels[i]]++;

  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = labels[i];
    for (let t = 0; t < k; t++) {
      const j = g.indices[i * k + t];
      const b = labels[j];
      observed[a * nTypes + b]++;
      total++;
    }
  }
  for (let i = 0; i < nTypes; i++) freq[i] /= n;

  const enrichment = new Float64Array(nTypes * nTypes);
  for (let a = 0; a < nTypes; a++) {
    for (let b = 0; b < nTypes; b++) {
      const expected = total * freq[a] * freq[b];
      enrichment[a * nTypes + b] =
        expected > 0 ? observed[a * nTypes + b] / expected : 0;
    }
  }
  return { nTypes, observed, enrichment };
}
