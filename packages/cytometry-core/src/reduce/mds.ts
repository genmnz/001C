import type { Population } from "../population.ts";
import { jacobiEigen } from "./pca.ts";

/**
 * Classical (Torgerson) multidimensional scaling: embed points into `dims`
 * dimensions preserving pairwise Euclidean distances. Double-center the squared
 * distance matrix to a Gram matrix B, eigendecompose, and take the top
 * eigenvectors scaled by √eigenvalue. Exact and deterministic; O(N²·d) +
 * O(N³) eigen, so for modest N (subsample for large).
 */
export function mds(
  columns: ArrayLike<number>[],
  opts: { dims?: number; parent?: Population } = {},
): number[][] {
  const dims = opts.dims ?? 2;
  const dd = columns.length;
  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;

  // Squared distance matrix.
  const D2 = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let c = 0; c < dd; c++) {
        const v = columns[c][idx[i]] - columns[c][idx[j]];
        s += v * v;
      }
      D2[i * n + j] = s;
      D2[j * n + i] = s;
    }
  }

  // Double-centering: B = -1/2 J D2 J.
  const rowMean = new Float64Array(n);
  let grand = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) s += D2[i * n + j];
    rowMean[i] = s / n;
    grand += s;
  }
  grand /= n * n;
  const B = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      B[i * n + j] = -0.5 * (D2[i * n + j] - rowMean[i] - rowMean[j] + grand);
    }
  }

  const { values, vectors } = jacobiEigen(B, n);
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);

  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    const coord: number[] = [];
    for (let k = 0; k < dims; k++) {
      const ev = order[k];
      const scale = Math.sqrt(Math.max(0, values[ev]));
      coord.push(vectors[ev][i] * scale);
    }
    out.push(coord);
  }
  return out;
}
