import { knn } from "../graph/knn.ts";
import type { Population } from "../population.ts";
import { jacobiEigen } from "../reduce/pca.ts";
import { kmeans } from "./kmeans.ts";

/**
 * Normalized spectral clustering (Ng, Jordan & Weiss 2002). Clusters points by
 * the geometry of a similarity graph rather than raw Euclidean compactness, so
 * it separates non-convex / manifold-shaped populations (e.g. concentric or
 * crescent structures) that trip up k-means and GMM.
 *
 * Pipeline (all reusing existing engine primitives):
 *   1. kNN graph → self-tuning Gaussian affinity W[i,j] = exp(-d²/(σ_iσ_j)),
 *      with σ_i the distance to i's k-th neighbour (Zelnik-Manor & Perona 2004),
 *      symmetrized;
 *   2. symmetric normalized affinity M = D^{-1/2} W D^{-1/2};
 *   3. top-`clusters` eigenvectors of M (Jacobi), row-normalized to the unit
 *      sphere → spectral embedding;
 *   4. k-means on the embedding.
 *
 * Exact/deterministic given the seed. O(N²) affinity + O(N³) eigen, so subsample
 * (or run on a parent population) for large N — the same envelope as MDS/t-SNE.
 */
export interface SpectralResult {
  /** Cluster label per processed point (0..clusters-1), in population order. */
  labels: Int32Array;
  /** The row-normalized spectral embedding (n × clusters). */
  embedding: number[][];
}

export function spectralCluster(
  columns: ArrayLike<number>[],
  clusters: number,
  opts: { k?: number; parent?: Population; seed?: number } = {},
): SpectralResult {
  const k = opts.k ?? Math.max(clusters + 1, 10);
  const g = knn(columns, k, { parent: opts.parent });
  const n = g.n;
  if (clusters < 1 || clusters > n) throw new Error("spectral: bad cluster count");

  // Local scale σ_i = distance to the k-th neighbour (guard against zero).
  const sigma = new Float64Array(n);
  for (let i = 0; i < n; i++) sigma[i] = g.distances[i * k + (k - 1)] || 1e-9;

  // Symmetric affinity over kNN edges (self-tuning Gaussian).
  const W = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < k; t++) {
      const j = g.indices[i * k + t];
      if (j === i) continue;
      const dist = g.distances[i * k + t];
      const w = Math.exp(-(dist * dist) / (sigma[i] * sigma[j]));
      // Symmetrize: keep the stronger of the two directed weights.
      if (w > W[i * n + j]) {
        W[i * n + j] = w;
        W[j * n + i] = w;
      }
    }
  }

  // Degree and D^{-1/2} W D^{-1/2}.
  const dInvSqrt = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let deg = 0;
    for (let j = 0; j < n; j++) deg += W[i * n + j];
    dInvSqrt[i] = deg > 0 ? 1 / Math.sqrt(deg) : 0;
  }
  const M = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      M[i * n + j] = dInvSqrt[i] * W[i * n + j] * dInvSqrt[j];

  // Top-`clusters` eigenvectors of M (largest eigenvalues = smallest of L_sym).
  const { values, vectors } = jacobiEigen(M, n);
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);

  // Row-normalized spectral embedding.
  const embedding: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const row = new Array(clusters);
    let norm = 0;
    for (let c = 0; c < clusters; c++) {
      const val = vectors[order[c]][i];
      row[c] = val;
      norm += val * val;
    }
    norm = Math.sqrt(norm) || 1;
    for (let c = 0; c < clusters; c++) row[c] /= norm;
    embedding[i] = row;
  }

  // k-means on the embedding (columnar).
  const embCols: number[][] = Array.from({ length: clusters }, () => new Array(n));
  for (let i = 0; i < n; i++)
    for (let c = 0; c < clusters; c++) embCols[c][i] = embedding[i][c];
  const { labels } = kmeans(embCols, clusters, { seed: opts.seed });

  return { labels, embedding };
}
