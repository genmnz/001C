import type { Population } from "../population.ts";
import { kmeans } from "./kmeans.ts";

/**
 * FlowSOM — the cytometry clustering standard. Clean-roomed from Van Gassen et
 * al., "FlowSOM," Cytometry A 2015;87(7):636-645 (doi:10.1002/cyto.a.22625):
 *   1. train a Kohonen self-organizing map (grid of nodes) on the events,
 *   2. build a minimum spanning tree over the nodes (Prim) for visualization,
 *   3. metacluster the node weight vectors into k groups,
 *   4. map each event -> BMU node -> metacluster.
 * (No FlowSOM code was used — algorithm only; the GPL package is the oracle.)
 *
 * Metaclustering here uses the repo's k-means on node weights (FlowSOM's default
 * is consensus hierarchical — a documented future swap). SOM training is the hot
 * loop and a Rust→WASM candidate at scale.
 */
export interface FlowSomResult {
  xdim: number;
  ydim: number;
  /** Node weight vectors, length xdim*ydim, each d-dim. */
  nodes: number[][];
  /** event -> SOM node index. */
  nodeOf: Int32Array;
  /** node -> metacluster. */
  metaOf: Int32Array;
  /** event -> metacluster. */
  eventMeta: Int32Array;
  /** Minimum spanning tree edges over nodes (for the FlowSOM star plot). */
  mst: { a: number; b: number; weight: number }[];
}

export interface FlowSomOptions {
  xdim?: number;
  ydim?: number;
  metaclusters?: number;
  epochs?: number;
  seed?: number;
  parent?: Population;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function flowSOM(
  columns: ArrayLike<number>[],
  opts: FlowSomOptions = {},
): FlowSomResult {
  const d = columns.length;
  const xdim = opts.xdim ?? 10;
  const ydim = opts.ydim ?? 10;
  const nNodes = xdim * ydim;
  const metaclusters = opts.metaclusters ?? 10;
  const epochs = opts.epochs ?? 10;
  const rng = mulberry32(opts.seed ?? 1);

  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;
  if (n < nNodes) throw new Error("flowSOM: fewer events than SOM nodes");

  // Node weights initialized from random events.
  const nodes: number[][] = [];
  for (let i = 0; i < nNodes; i++) {
    const e = idx[Math.floor(rng() * n)];
    const w = new Array(d);
    for (let j = 0; j < d; j++) w[j] = columns[j][e];
    nodes.push(w);
  }
  const gx = (i: number) => i % xdim;
  const gy = (i: number) => Math.floor(i / xdim);

  const bmu = (e: number): number => {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < nNodes; i++) {
      const w = nodes[i];
      let s = 0;
      for (let j = 0; j < d; j++) {
        const dv = columns[j][e] - w[j];
        s += dv * dv;
      }
      if (s < bestD) {
        bestD = s;
        best = i;
      }
    }
    return best;
  };

  // Online Kohonen training with decaying radius + learning rate.
  const total = epochs * n;
  const radius0 = Math.max(xdim, ydim) / 2;
  const lr0 = 0.05;
  let step = 0;
  for (let ep = 0; ep < epochs; ep++) {
    for (let s = 0; s < n; s++) {
      const e = idx[Math.floor(rng() * n)];
      const frac = step / total;
      const radius = Math.max(1, radius0 * (1 - frac));
      const lr = lr0 * (1 - frac);
      const b = bmu(e);
      const bxp = gx(b);
      const byp = gy(b);
      const twoR2 = 2 * radius * radius;
      for (let i = 0; i < nNodes; i++) {
        const gd = (gx(i) - bxp) ** 2 + (gy(i) - byp) ** 2;
        if (gd > twoR2) continue; // negligible neighborhood influence
        const infl = lr * Math.exp(-gd / twoR2);
        if (infl < 1e-4) continue;
        const w = nodes[i];
        for (let j = 0; j < d; j++) w[j] += infl * (columns[j][e] - w[j]);
      }
      step++;
    }
  }

  // Map events to BMU nodes.
  const nodeOf = new Int32Array(n);
  for (let p = 0; p < n; p++) nodeOf[p] = bmu(idx[p]);

  // Metacluster the node weight vectors (k-means over node weights).
  const nodeCols: Float64Array[] = [];
  for (let j = 0; j < d; j++) {
    const c = new Float64Array(nNodes);
    for (let i = 0; i < nNodes; i++) c[i] = nodes[i][j];
    nodeCols.push(c);
  }
  const meta = kmeans(nodeCols, Math.min(metaclusters, nNodes), {
    seed: opts.seed ?? 1,
  });
  const metaOf = meta.labels;

  const eventMeta = new Int32Array(n);
  for (let p = 0; p < n; p++) eventMeta[p] = metaOf[nodeOf[p]];

  return { xdim, ydim, nodes, nodeOf, metaOf, eventMeta, mst: primMst(nodes) };
}

/** Minimum spanning tree over node weights (Prim, dense). */
function primMst(nodes: number[][]): { a: number; b: number; weight: number }[] {
  const n = nodes.length;
  const d = nodes[0]?.length ?? 0;
  const dist = (i: number, j: number) => {
    let s = 0;
    for (let k = 0; k < d; k++) {
      const dv = nodes[i][k] - nodes[j][k];
      s += dv * dv;
    }
    return Math.sqrt(s);
  };
  const inTree = new Uint8Array(n);
  const best = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  best[0] = 0;
  const edges: { a: number; b: number; weight: number }[] = [];
  for (let it = 0; it < n; it++) {
    let u = -1;
    let bd = Infinity;
    for (let i = 0; i < n; i++) if (!inTree[i] && best[i] < bd) ((bd = best[i]), (u = i));
    if (u === -1) break;
    inTree[u] = 1;
    if (parent[u] !== -1) edges.push({ a: parent[u], b: u, weight: best[u] });
    for (let v = 0; v < n; v++) {
      if (inTree[v]) continue;
      const dd = dist(u, v);
      if (dd < best[v]) {
        best[v] = dd;
        parent[v] = u;
      }
    }
  }
  return edges;
}
