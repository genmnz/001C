import type { Population } from "../population.ts";
import { kmeans } from "./kmeans.ts";

/**
 * Consensus clustering (Monti et al. 2003; ConsensusClusterPlus is the FlowSOM
 * metaclustering reference). Run k-means `runs` times with different seeds, build
 * a co-association matrix (fraction of runs where i,j share a cluster), then
 * agglomeratively merge on co-association distance (1 − coassoc) to k stable
 * clusters. Reduces seed-dependence of a single run. O(N²) — for modest N
 * (SOM-node metaclustering).
 */
export interface ConsensusResult {
  labels: Int32Array;
  /** Row-major n×n co-association (fraction of runs clustered together). */
  coassociation: Float64Array;
}

export function consensusCluster(
  columns: ArrayLike<number>[],
  k: number,
  opts: { runs?: number; seed?: number; parent?: Population } = {},
): ConsensusResult {
  const runs = opts.runs ?? 25;
  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;

  const coassoc = new Float64Array(n * n);
  for (let r = 0; r < runs; r++) {
    const km = kmeans(columns, k, { seed: (opts.seed ?? 1) + r * 97, population: opts.parent });
    const lab = km.labels; // aligns to idx order
    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        if (lab[i] === lab[j]) {
          coassoc[i * n + j]++;
          coassoc[j * n + i]++;
        }
      }
    }
  }
  for (let t = 0; t < n * n; t++) coassoc[t] /= runs;

  // Agglomerative average-linkage on distance = 1 - coassoc, cut to k.
  const dist = (i: number, j: number) => 1 - coassoc[i * n + j];
  const members: number[][] = Array.from({ length: n }, (_, i) => [i]);
  const active = new Set<number>(members.map((_, i) => i));
  const cdist = (a: number, b: number) => {
    let acc = 0;
    let cnt = 0;
    for (const pi of members[a])
      for (const pj of members[b]) {
        acc += dist(pi, pj);
        cnt++;
      }
    return acc / (cnt || 1);
  };
  while (active.size > k) {
    let bestA = -1;
    let bestB = -1;
    let bestD = Infinity;
    const arr = [...active];
    for (let x = 0; x < arr.length; x++)
      for (let y = x + 1; y < arr.length; y++) {
        const d = cdist(arr[x], arr[y]);
        if (d < bestD) {
          bestD = d;
          bestA = arr[x];
          bestB = arr[y];
        }
      }
    if (bestA === -1) break;
    members[bestA] = members[bestA].concat(members[bestB]);
    members[bestB] = [];
    active.delete(bestB);
  }

  const labels = new Int32Array(n);
  let lab = 0;
  for (const a of active) {
    for (const pi of members[a]) labels[pi] = lab;
    lab++;
  }
  return { labels, coassociation: coassoc };
}
