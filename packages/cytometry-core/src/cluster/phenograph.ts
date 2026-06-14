import { knn } from "../graph/knn.ts";
import { louvain, modularity, type WeightedGraph } from "../graph/louvain.ts";
import type { Population } from "../population.ts";

/**
 * PhenoGraph (Levine et al. 2015, doi:10.1016/j.cell.2015.05.047): build a kNN
 * graph, weight each edge by the Jaccard overlap of the two endpoints'
 * neighborhoods, then run community detection (Louvain). Clean-room — the
 * algorithm is published; the bundled Louvain C++ is GPL, so we use our own
 * permissive Louvain (graph/louvain.ts).
 */
export interface PhenographResult {
  labels: Int32Array;
  clusterCount: number;
  modularity: number;
}

export function phenograph(
  columns: ArrayLike<number>[],
  opts: { k?: number; parent?: Population; resolution?: number } = {},
): PhenographResult {
  const k = opts.k ?? 30;
  const g = knn(columns, k, { parent: opts.parent });
  const n = g.n;

  // Neighborhood sets (each point + its k neighbors).
  const nbset: Set<number>[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const s = new Set<number>();
    s.add(i);
    for (let t = 0; t < k; t++) s.add(g.indices[i * k + t]);
    nbset[i] = s;
  }
  const jaccard = (a: Set<number>, b: Set<number>): number => {
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    let inter = 0;
    for (const x of small) if (big.has(x)) inter++;
    return inter / (a.size + b.size - inter);
  };

  // Undirected, deduplicated edges weighted by Jaccard.
  const edgeMap = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < k; t++) {
      const j = g.indices[i * k + t];
      if (j === i) continue;
      const a = Math.min(i, j);
      const b = Math.max(i, j);
      const key = `${a},${b}`;
      if (edgeMap.has(key)) continue;
      const w = jaccard(nbset[i], nbset[j]);
      if (w > 0) edgeMap.set(key, w);
    }
  }
  const edges: [number, number, number][] = [...edgeMap].map(([key, w]) => {
    const [a, b] = key.split(",").map(Number);
    return [a, b, w] as [number, number, number];
  });

  const graph: WeightedGraph = { n, edges };
  const labels = louvain(graph, { resolution: opts.resolution });
  const clusterCount = new Set(Array.from(labels)).size;
  return { labels, clusterCount, modularity: modularity(graph, labels) };
}
