/**
 * Marker enrichment per cluster — the basis of phenotype discovery / cell typing
 * (Spectre/FlowSOM-style). For each cluster × marker, the z-score of the cluster
 * mean against the global mean/std says which markers define the cluster.
 */
export interface MarkerEnrichment {
  nClusters: number;
  nMarkers: number;
  /** Row-major nClusters×nMarkers z-scores. */
  z: Float64Array;
}

export function markerEnrichment(
  columns: ArrayLike<number>[],
  labels: ArrayLike<number>,
  nClusters: number,
): MarkerEnrichment {
  const nMarkers = columns.length;
  const n = columns[0].length;

  const gMean = new Float64Array(nMarkers);
  for (let m = 0; m < nMarkers; m++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += columns[m][i];
    gMean[m] = s / n;
  }
  const gStd = new Float64Array(nMarkers);
  for (let m = 0; m < nMarkers; m++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += (columns[m][i] - gMean[m]) ** 2;
    gStd[m] = Math.sqrt(s / n) || 1;
  }

  const sum = new Float64Array(nClusters * nMarkers);
  const count = new Float64Array(nClusters);
  for (let i = 0; i < n; i++) {
    const c = labels[i];
    count[c]++;
    for (let m = 0; m < nMarkers; m++) sum[c * nMarkers + m] += columns[m][i];
  }

  const z = new Float64Array(nClusters * nMarkers);
  for (let c = 0; c < nClusters; c++) {
    const nc = count[c] || 1;
    for (let m = 0; m < nMarkers; m++) {
      const mean = sum[c * nMarkers + m] / nc;
      z[c * nMarkers + m] = (mean - gMean[m]) / gStd[m];
    }
  }
  return { nClusters, nMarkers, z };
}

/** Top-N positively-enriched markers (highest z) defining each cluster. */
export function topMarkers(e: MarkerEnrichment, topN = 3): number[][] {
  const out: number[][] = [];
  for (let c = 0; c < e.nClusters; c++) {
    const order = Array.from({ length: e.nMarkers }, (_, m) => m).sort(
      (a, b) => e.z[c * e.nMarkers + b] - e.z[c * e.nMarkers + a],
    );
    out.push(order.slice(0, topN));
  }
  return out;
}
