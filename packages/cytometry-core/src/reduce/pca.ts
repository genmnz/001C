import { Population } from "../population.ts";

/**
 * Principal Component Analysis — exact, deterministic, headless. Computes the
 * covariance of the selected channels (over an optional population) and its
 * eigendecomposition via cyclic Jacobi rotations (robust for the small symmetric
 * d×d covariance; d = number of channels, typically ≤ ~50). The O(N·d²)
 * covariance accumulation is the hot loop and is a future Rust→WASM candidate.
 *
 * Ports the standard PCA used across cytometry tools; foundation for embeddings
 * and a fast linear pre-reduction before t-SNE/UMAP.
 */
export interface PcaResult {
  /** Per-channel means used to center the data. */
  mean: number[];
  /** Eigenvectors (principal axes), rows sorted by descending eigenvalue. */
  components: number[][];
  /** Eigenvalues (variance along each component), descending. */
  explainedVariance: number[];
  /** Fraction of total variance per component. */
  explainedVarianceRatio: number[];
  /** Project one event's channel values onto the top-k components. */
  project(values: ArrayLike<number>, k?: number): number[];
}

/** Cyclic Jacobi eigendecomposition of a symmetric n×n matrix (row-major). */
export function jacobiEigen(
  a: Float64Array,
  n: number,
  maxSweeps = 100,
): { values: number[]; vectors: number[][] } {
  const m = Float64Array.from(a);
  // V starts as identity; columns become eigenvectors.
  const v = new Float64Array(n * n);
  for (let i = 0; i < n; i++) v[i * n + i] = 1;

  for (let sweep = 0; sweep < maxSweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) off += m[p * n + q] * m[p * n + q];
    if (off < 1e-30) break;

    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = m[p * n + q];
        if (apq === 0) continue;
        const app = m[p * n + p];
        const aqq = m[q * n + q];
        const phi = 0.5 * Math.atan2(2 * apq, aqq - app);
        const c = Math.cos(phi);
        const s = Math.sin(phi);
        for (let i = 0; i < n; i++) {
          const mip = m[i * n + p];
          const miq = m[i * n + q];
          m[i * n + p] = c * mip - s * miq;
          m[i * n + q] = s * mip + c * miq;
        }
        for (let i = 0; i < n; i++) {
          const mpi = m[p * n + i];
          const mqi = m[q * n + i];
          m[p * n + i] = c * mpi - s * mqi;
          m[q * n + i] = s * mpi + c * mqi;
        }
        for (let i = 0; i < n; i++) {
          const vip = v[i * n + p];
          const viq = v[i * n + q];
          v[i * n + p] = c * vip - s * viq;
          v[i * n + q] = s * vip + c * viq;
        }
      }
    }
  }
  const values: number[] = [];
  const vectors: number[][] = [];
  for (let j = 0; j < n; j++) {
    values.push(m[j * n + j]);
    const vec: number[] = [];
    for (let i = 0; i < n; i++) vec.push(v[i * n + j]);
    vectors.push(vec);
  }
  return { values, vectors };
}

export function pca(
  columns: ArrayLike<number>[],
  population?: Population,
): PcaResult {
  const d = columns.length;
  const n = population ? population.count() : columns[0].length;
  if (n < 2) throw new Error("pca: need >= 2 events");

  // Means.
  const mean = new Array(d).fill(0);
  const accumulate = (i: number) => {
    for (let j = 0; j < d; j++) mean[j] += columns[j][i];
  };
  if (population) population.forEach(accumulate);
  else for (let i = 0; i < columns[0].length; i++) accumulate(i);
  for (let j = 0; j < d; j++) mean[j] /= n;

  // Covariance (d×d, symmetric).
  const cov = new Float64Array(d * d);
  const accCov = (i: number) => {
    for (let a = 0; a < d; a++) {
      const da = columns[a][i] - mean[a];
      for (let b = a; b < d; b++) {
        cov[a * d + b] += da * (columns[b][i] - mean[b]);
      }
    }
  };
  if (population) population.forEach(accCov);
  else for (let i = 0; i < columns[0].length; i++) accCov(i);
  for (let a = 0; a < d; a++)
    for (let b = a; b < d; b++) {
      const val = cov[a * d + b] / (n - 1);
      cov[a * d + b] = val;
      cov[b * d + a] = val;
    }

  const { values, vectors } = jacobiEigen(cov, d);
  const order = values.map((_, i) => i).sort((p, q) => values[q] - values[p]);
  const sortedVals = order.map((i) => values[i]);
  const components = order.map((i) => vectors[i]);
  const totalVar = sortedVals.reduce((s, v) => s + Math.max(0, v), 0) || 1;

  return {
    mean,
    components,
    explainedVariance: sortedVals,
    explainedVarianceRatio: sortedVals.map((v) => Math.max(0, v) / totalVar),
    project(vals: ArrayLike<number>, k = d): number[] {
      const out: number[] = [];
      for (let c = 0; c < Math.min(k, d); c++) {
        let s = 0;
        for (let j = 0; j < d; j++) s += (vals[j] - mean[j]) * components[c][j];
        out.push(s);
      }
      return out;
    },
  };
}
