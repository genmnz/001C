/**
 * Louvain community detection (Blondel et al. 2008) on a weighted undirected
 * graph — modularity optimization by local moving + aggregation, repeated to
 * convergence. Permissive reimplementation (the C louvain/leidenalg are GPL);
 * this is the community-detection step of PhenoGraph. Leiden's refinement is a
 * future improvement; Louvain is correct and sufficient for well-separated
 * structure.
 *
 * Graph is an undirected edge list `[u, v, w]` with u <= v (u==v = self-loop).
 */
export interface WeightedGraph {
  n: number;
  edges: [number, number, number][];
}

interface Adj {
  adj: Map<number, number>[];
  deg: Float64Array;
  twoM: number;
}

function buildAdj(edges: [number, number, number][], n: number): Adj {
  const adj: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  const deg = new Float64Array(n);
  for (const [u, v, w] of edges) {
    if (u === v) {
      adj[u].set(u, (adj[u].get(u) ?? 0) + w);
      deg[u] += 2 * w;
    } else {
      adj[u].set(v, (adj[u].get(v) ?? 0) + w);
      adj[v].set(u, (adj[v].get(u) ?? 0) + w);
      deg[u] += w;
      deg[v] += w;
    }
  }
  let twoM = 0;
  for (let i = 0; i < n; i++) twoM += deg[i];
  return { adj, deg, twoM };
}

export function louvain(
  graph: WeightedGraph,
  opts: { resolution?: number; maxPasses?: number } = {},
): Int32Array {
  const resolution = opts.resolution ?? 1;
  const maxPasses = opts.maxPasses ?? 50;
  const origN = graph.n;

  const superOf = new Int32Array(origN);
  for (let i = 0; i < origN; i++) superOf[i] = i;

  let levelN = origN;
  let levelEdges = graph.edges;

  for (let pass = 0; pass < maxPasses; pass++) {
    const { adj, deg, twoM } = buildAdj(levelEdges, levelN);
    if (twoM === 0) break;

    const comm = new Int32Array(levelN);
    const sigmaTot = new Float64Array(levelN);
    for (let i = 0; i < levelN; i++) {
      comm[i] = i;
      sigmaTot[i] = deg[i];
    }

    let improved = false;
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = 0; i < levelN; i++) {
        const ci = comm[i];
        const wTo = new Map<number, number>();
        for (const [j, w] of adj[i]) {
          if (j === i) continue;
          const cj = comm[j];
          wTo.set(cj, (wTo.get(cj) ?? 0) + w);
        }
        sigmaTot[ci] -= deg[i];
        const gain = (c: number) =>
          (wTo.get(c) ?? 0) - (resolution * sigmaTot[c] * deg[i]) / twoM;
        let bestC = ci;
        let bestGain = gain(ci);
        for (const c of wTo.keys()) {
          const g = gain(c);
          if (g > bestGain) {
            bestGain = g;
            bestC = c;
          }
        }
        sigmaTot[bestC] += deg[i];
        comm[i] = bestC;
        if (bestC !== ci) {
          moved = true;
          improved = true;
        }
      }
    }
    if (!improved) break;

    // Renumber communities densely.
    const remap = new Map<number, number>();
    let C = 0;
    const newComm = new Int32Array(levelN);
    for (let i = 0; i < levelN; i++) {
      const c = comm[i];
      let nc = remap.get(c);
      if (nc === undefined) {
        nc = C++;
        remap.set(c, nc);
      }
      newComm[i] = nc;
    }
    for (let o = 0; o < origN; o++) superOf[o] = newComm[superOf[o]];
    if (C === levelN) break; // nothing merged

    // Aggregate edges by community.
    const aggMap = new Map<string, number>();
    for (const [u, v, w] of levelEdges) {
      let a = newComm[u];
      let b = newComm[v];
      if (a > b) [a, b] = [b, a];
      const key = `${a},${b}`;
      aggMap.set(key, (aggMap.get(key) ?? 0) + w);
    }
    levelEdges = [...aggMap].map(([key, w]) => {
      const [a, b] = key.split(",").map(Number);
      return [a, b, w] as [number, number, number];
    });
    levelN = C;
  }

  // Dense-relabel the final communities.
  const remap = new Map<number, number>();
  let K = 0;
  const labels = new Int32Array(origN);
  for (let i = 0; i < origN; i++) {
    const c = superOf[i];
    let nc = remap.get(c);
    if (nc === undefined) {
      nc = K++;
      remap.set(c, nc);
    }
    labels[i] = nc;
  }
  return labels;
}

/** Modularity of a partition (for validation/tuning). */
export function modularity(
  graph: WeightedGraph,
  labels: Int32Array,
  resolution = 1,
): number {
  const { adj, deg, twoM } = buildAdj(graph.edges, graph.n);
  if (twoM === 0) return 0;
  let q = 0;
  for (let i = 0; i < graph.n; i++) {
    for (const [j, w] of adj[i]) {
      if (labels[i] === labels[j]) q += w - (resolution * deg[i] * deg[j]) / twoM;
    }
  }
  return q / twoM;
}
