import { knn } from "../graph/knn.ts";
import type { Population } from "../population.ts";
import { jacobiEigen } from "./pca.ts";

/**
 * Isomap (Tenenbaum, de Silva & Langford 2000) — nonlinear dimensionality
 * reduction that preserves *geodesic* (along-the-manifold) distances instead of
 * straight-line Euclidean ones. It unrolls curved manifolds (a swiss roll, an
 * arc) that PCA/classical-MDS would fold onto themselves.
 *
 * Pipeline (reusing engine primitives):
 *   1. kNN graph, undirected, edges weighted by Euclidean distance;
 *   2. geodesic distances = shortest paths on that graph (Dijkstra per source);
 *   3. classical MDS on the geodesic distance matrix (double-centre → Jacobi
 *      eigen → top-`dims` eigenvectors × √eigenvalue).
 *
 * Exact/deterministic. O(N²) neighbours + O(N³) shortest paths + eigen, so
 * subsample (or pass a parent population) for large N. If the neighbour graph is
 * disconnected, unreachable pairs are capped at the largest finite geodesic so
 * the embedding stays well-defined (increase `k` to connect the manifold).
 */
export function isomap(
  columns: ArrayLike<number>[],
  opts: { dims?: number; k?: number; parent?: Population } = {},
): number[][] {
  const dims = opts.dims ?? 2;
  const k = opts.k ?? 10;
  const g = knn(columns, k, { parent: opts.parent });
  const n = g.n;
  if (k >= n) throw new Error("isomap: k must be < number of points");

  // Undirected weighted adjacency from the kNN graph (keep the shorter weight
  // when an edge appears in both directions).
  const adj: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  const link = (a: number, b: number, w: number) => {
    const cur = adj[a].get(b);
    if (cur === undefined || w < cur) adj[a].set(b, w);
  };
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < k; t++) {
      const j = g.indices[i * k + t];
      if (j === i) continue;
      const w = g.distances[i * k + t];
      link(i, j, w);
      link(j, i, w);
    }
  }

  // Geodesic distance matrix via Dijkstra from every source (dense O(N²) each).
  const geo = new Float64Array(n * n).fill(Infinity);
  const visited = new Uint8Array(n);
  for (let s = 0; s < n; s++) {
    visited.fill(0);
    const dRow = geo.subarray(s * n, s * n + n);
    dRow[s] = 0;
    for (let iter = 0; iter < n; iter++) {
      // Pick the closest unvisited node.
      let u = -1;
      let best = Infinity;
      for (let v = 0; v < n; v++) {
        if (!visited[v] && dRow[v] < best) {
          best = dRow[v];
          u = v;
        }
      }
      if (u === -1) break; // rest is unreachable
      visited[u] = 1;
      for (const [v, w] of adj[u]) {
        const nd = dRow[u] + w;
        if (nd < dRow[v]) dRow[v] = nd;
      }
    }
  }

  // Cap unreachable pairs at the largest finite geodesic (keeps MDS well-posed).
  let maxFinite = 0;
  for (let i = 0; i < n * n; i++) if (geo[i] !== Infinity && geo[i] > maxFinite) maxFinite = geo[i];
  const cap = maxFinite > 0 ? maxFinite : 1;
  for (let i = 0; i < n * n; i++) if (geo[i] === Infinity) geo[i] = cap;

  // Classical MDS on the (squared) geodesic distances.
  const D2 = new Float64Array(n * n);
  for (let i = 0; i < n * n; i++) D2[i] = geo[i] * geo[i];

  const rowMean = new Float64Array(n);
  let grand = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += D2[i * n + j];
    rowMean[i] = sum / n;
    grand += sum;
  }
  grand /= n * n;

  const B = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      B[i * n + j] = -0.5 * (D2[i * n + j] - rowMean[i] - rowMean[j] + grand);

  const { values, vectors } = jacobiEigen(B, n);
  const order = values.map((_, i) => i).sort((a, b) => values[b] - values[a]);

  const out: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const coord = new Array(dims);
    for (let c = 0; c < dims; c++) {
      const ev = order[c];
      coord[c] = vectors[ev][i] * Math.sqrt(Math.max(0, values[ev]));
    }
    out[i] = coord;
  }
  return out;
}
