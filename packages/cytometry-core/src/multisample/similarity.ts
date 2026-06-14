/**
 * Multi-sample analysis on per-sample cluster-frequency vectors (from
 * diff.clusterAbundance). Sample similarity (Pearson or cosine) drives cohort
 * comparison, sample QC, and consensus grouping.
 */
export type SimilarityMetric = "pearson" | "cosine";

function sampleVector(
  proportions: Float64Array,
  nClusters: number,
  nSamples: number,
  s: number,
): number[] {
  const v = new Array<number>(nClusters);
  for (let c = 0; c < nClusters; c++) v[c] = proportions[c * nSamples + s];
  return v;
}

function pearson(a: number[], b: number[]): number {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return den === 0 ? 0 : num / den;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const den = Math.sqrt(na * nb);
  return den === 0 ? 0 : dot / den;
}

/** nSamples×nSamples similarity matrix of the per-sample frequency vectors. */
export function sampleSimilarity(
  proportions: Float64Array,
  nClusters: number,
  nSamples: number,
  metric: SimilarityMetric = "pearson",
): Float64Array {
  const sim = new Float64Array(nSamples * nSamples);
  const fn = metric === "cosine" ? cosine : pearson;
  const vecs = Array.from({ length: nSamples }, (_, s) =>
    sampleVector(proportions, nClusters, nSamples, s),
  );
  for (let i = 0; i < nSamples; i++) {
    for (let j = i; j < nSamples; j++) {
      const v = i === j ? 1 : fn(vecs[i], vecs[j]);
      sim[i * nSamples + j] = v;
      sim[j * nSamples + i] = v;
    }
  }
  return sim;
}
