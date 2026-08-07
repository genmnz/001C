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
  // Per-row bounded selection buffers (k smallest), kept sorted ascending by
  // (distance, index). Avoids the previous O(N log N) full sort + N-length array
  // allocation per point — this is the hot path under PhenoGraph/UMAP/spatial.
  const selDist = new Float64Array(k);
  const selIdx = new Int32Array(k);

  for (let i = 0; i < n; i++) {
    const ei = idx[i];
    let filled = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const ej = idx[j];
      let s = 0;
      for (let c = 0; c < d; c++) {
        const dv = columns[c][ei] - columns[c][ej];
        s += dv * dv;
      }
      // Reject anything that can't crack the current k smallest. Strict `<` on a
      // full buffer keeps the earlier (smaller-index) point on ties, matching a
      // stable ascending sort by (distance, index).
      if (filled === k && s >= selDist[k - 1]) continue;
      // Insertion sort into the bounded buffer: place after equal-distance
      // entries (which have smaller j, inserted earlier) to preserve tie order.
      let p = filled < k ? filled : k - 1;
      while (p > 0 && selDist[p - 1] > s) {
        selDist[p] = selDist[p - 1];
        selIdx[p] = selIdx[p - 1];
        p--;
      }
      selDist[p] = s;
      selIdx[p] = j;
      if (filled < k) filled++;
    }
    for (let t = 0; t < k; t++) {
      indices[i * k + t] = selIdx[t];
      distances[i * k + t] = Math.sqrt(selDist[t]);
    }
  }
  return { n, k, indices, distances, eventIndex: Int32Array.from(idx) };
}
