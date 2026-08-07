import { modularity, type WeightedGraph } from "./louvain.ts";

/**
 * Leiden community detection (Traag, Waltman & van Eck 2019,
 * doi:10.1038/s41598-019-41695-z). Improves on Louvain by adding a *refinement*
 * phase between local moving and aggregation, which guarantees every returned
 * community is internally connected (Louvain can produce disconnected
 * communities) and typically reaches higher modularity.
 *
 * Three phases per level, repeated on the aggregated graph until stable:
 *   1. local moving — greedily move nodes to the neighbouring community with the
 *      best modularity gain (as in Louvain), producing a flat partition P;
 *   2. refinement — within each community of P, re-partition starting from
 *      singletons, merging a node into a refined sub-community only along an
 *      edge and only for a positive gain, so refined communities are connected
 *      subsets of P;
 *   3. aggregation — collapse each refined community to a super-node, but seed
 *      the next level's local moving with P (not singletons) so sub-communities
 *      of the same P-community can re-merge.
 *
 * Clean-room and permissive: the reference `leidenalg` C++ is GPL. The
 * refinement here is a deterministic greedy specialization of the published
 * randomized variant — it preserves the connectivity guarantee. Deterministic
 * for a given input (edge iteration order); a `seed` reserved for future
 * randomized refinement.
 */
export function leiden(
  graph: WeightedGraph,
  opts: { resolution?: number; maxPasses?: number; seed?: number } = {},
): Int32Array {
  const resolution = opts.resolution ?? 1;
  const maxPasses = opts.maxPasses ?? 50;
  const origN = graph.n;

  // orig node -> current level (super-)node.
  const nodeOf = new Int32Array(origN);
  for (let i = 0; i < origN; i++) nodeOf[i] = i;

  let levelN = origN;
  let levelEdges = graph.edges;
  // Seed partition for the next level's local moving (null on the first level).
  let inherited: Int32Array | null = null;
  // The flat partition P over the current level's nodes (becomes the labels).
  let flatComm: Int32Array = new Int32Array(levelN);
  for (let i = 0; i < levelN; i++) flatComm[i] = i;

  for (let pass = 0; pass < maxPasses; pass++) {
    const { adj, deg, twoM } = buildAdj(levelEdges, levelN);
    if (twoM === 0) break;

    // ---- Phase 1: local moving → flat partition P.
    const init = inherited ?? identity(levelN);
    const { comm, moved } = localMove(adj, deg, twoM, init, resolution);
    denseRenumber(comm);
    flatComm = comm;
    if (!moved && pass > 0) break;

    // ---- Phase 2: refinement (connected sub-communities within each P-comm).
    const refined = refine(adj, deg, twoM, comm, resolution);
    const R = denseRenumber(refined);
    if (R === levelN) break; // aggregation would not shrink the graph

    // ---- Phase 3: aggregate by refined community; seed next level with P.
    levelEdges = aggregate(levelEdges, refined, R);
    const nextComm = new Int32Array(R);
    for (let i = 0; i < levelN; i++) nextComm[refined[i]] = comm[i];
    for (let o = 0; o < origN; o++) nodeOf[o] = refined[nodeOf[o]];
    levelN = R;
    inherited = nextComm;
  }

  // Labels: each original node inherits the flat community of its super-node.
  const labels = new Int32Array(origN);
  for (let o = 0; o < origN; o++) labels[o] = flatComm[nodeOf[o]];
  denseRenumber(labels);
  return labels;
}

// ---------------------------------------------------------------------------

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

function identity(n: number): Int32Array {
  const a = new Int32Array(n);
  for (let i = 0; i < n; i++) a[i] = i;
  return a;
}

/** Renumber labels to a dense 0..K-1 range in first-appearance order; returns K. */
function denseRenumber(labels: Int32Array): number {
  const remap = new Map<number, number>();
  let k = 0;
  for (let i = 0; i < labels.length; i++) {
    const c = labels[i];
    let nc = remap.get(c);
    if (nc === undefined) {
      nc = k++;
      remap.set(c, nc);
    }
    labels[i] = nc;
  }
  return k;
}

function localMove(
  adj: Map<number, number>[],
  deg: Float64Array,
  twoM: number,
  init: Int32Array,
  resolution: number,
): { comm: Int32Array; moved: boolean } {
  const n = adj.length;
  const comm = Int32Array.from(init);
  const sigmaTot = new Float64Array(n);
  for (let i = 0; i < n; i++) sigmaTot[comm[i]] += deg[i];

  let moved = false;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      const ci = comm[i];
      const wTo = new Map<number, number>();
      for (const [j, w] of adj[i]) {
        if (j === i) continue;
        const cj = comm[j];
        wTo.set(cj, (wTo.get(cj) ?? 0) + w);
      }
      sigmaTot[ci] -= deg[i];
      const gain = (c: number): number =>
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
        changed = true;
        moved = true;
      }
    }
  }
  return { comm, moved };
}

/**
 * Refinement: within each community of `comm`, build a partition from singletons
 * where a node may only join a refined community that (a) sits inside the same
 * `comm` and (b) it is directly connected to, and only for a positive modularity
 * gain. Guarantees refined communities are connected subsets of `comm`.
 */
function refine(
  adj: Map<number, number>[],
  deg: Float64Array,
  twoM: number,
  comm: Int32Array,
  resolution: number,
): Int32Array {
  const n = adj.length;
  const refined = identity(n);
  const sigmaTot = Float64Array.from(deg); // each node starts as its own community
  const size = new Int32Array(n).fill(1);

  for (let i = 0; i < n; i++) {
    // Only move nodes still alone in their singleton refined community (Leiden
    // moves each node at most once out of its singleton during refinement).
    const ri = refined[i];
    if (size[ri] !== 1) continue;

    const ci = comm[i];
    const wTo = new Map<number, number>();
    for (const [j, w] of adj[i]) {
      if (j === i || comm[j] !== ci) continue; // stay within the P-community
      wTo.set(refined[j], (wTo.get(refined[j]) ?? 0) + w);
    }
    sigmaTot[ri] -= deg[i];
    let bestR = ri;
    let bestGain = 0; // require a strictly positive gain to leave the singleton
    for (const [r, w] of wTo) {
      const g = w - (resolution * sigmaTot[r] * deg[i]) / twoM;
      if (g > bestGain) {
        bestGain = g;
        bestR = r;
      }
    }
    sigmaTot[bestR] += deg[i];
    if (bestR !== ri) {
      size[ri]--;
      size[bestR]++;
    }
    refined[i] = bestR;
  }
  return refined;
}

function aggregate(
  edges: [number, number, number][],
  map: Int32Array,
  _n: number,
): [number, number, number][] {
  const aggMap = new Map<string, number>();
  for (const [u, v, w] of edges) {
    let a = map[u];
    let b = map[v];
    if (a > b) [a, b] = [b, a];
    const key = `${a},${b}`;
    aggMap.set(key, (aggMap.get(key) ?? 0) + w);
  }
  return [...aggMap].map(([key, w]) => {
    const [a, b] = key.split(",").map(Number);
    return [a, b, w] as [number, number, number];
  });
}

export { modularity };
