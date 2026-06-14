import type { Population } from "../population.ts";

/**
 * k-nearest-neighbor graph over columnar points (brute-force O(N²·d)). The
 * shared foundation for PhenoGraph (kNN→Jaccard→community) and UMAP (fuzzy
 * simplicial set). At scale this becomes an HNSW/kd-tree + Rust→WASM hot loop;
 * the interface stays the same.
 */
export interface KnnResult {
  n: number;
  k: number;
  /** Row-major n×k neighbor indices (into the processed point list, nearest first). */
  indices: Int32Array;
  /** Row-major n×k Euclidean distances. */
  distances: Float64Array;
  /** Map from processed-point index back to the original event index. */
  eventIndex: Int32Array;
}

export function knn(
  columns: ArrayLike<number>[],
  k: number,
  opts: { parent?: Population } = {},
): KnnResult {
  const d = columns.length;
  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;
  if (k >= n) throw new Error("knn: k must be < number of points");

  const indices = new Int32Array(n * k);
  const distances = new Float64Array(n * k);
  const buf = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const ei = idx[i];
    for (let j = 0; j < n; j++) {
      if (j === i) {
        buf[j] = Infinity;
        continue;
      }
      const ej = idx[j];
      let s = 0;
      for (let c = 0; c < d; c++) {
        const dv = columns[c][ei] - columns[c][ej];
        s += dv * dv;
      }
      buf[j] = s;
    }
    // Partial selection of the k smallest.
    const order = Array.from({ length: n }, (_, j) => j).sort(
      (a, b) => buf[a] - buf[b],
    );
    for (let t = 0; t < k; t++) {
      indices[i * k + t] = order[t];
      distances[i * k + t] = Math.sqrt(buf[order[t]]);
    }
  }
  return { n, k, indices, distances, eventIndex: Int32Array.from(idx) };
}
