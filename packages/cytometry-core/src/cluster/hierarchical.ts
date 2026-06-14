import type { Population } from "../population.ts";

/**
 * Agglomerative hierarchical clustering with average / complete / single linkage,
 * cut to `k` flat clusters. Standard Lance-Williams-style merge of the closest
 * pair; O(N²) memory + O(N³) time, so for modest N (e.g. SOM-node metaclustering,
 * FlowSOM's consensus step). Returns dense 0..k-1 labels.
 */
export type Linkage = "average" | "complete" | "single";

export interface HierResult {
  labels: Int32Array;
  k: number;
}

export function agglomerative(
  columns: ArrayLike<number>[],
  k: number,
  opts: { linkage?: Linkage; parent?: Population } = {},
): HierResult {
  const linkage = opts.linkage ?? "average";
  const dd = columns.length;
  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;

  // Initial pairwise distances.
  const dist = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let c = 0; c < dd; c++) {
        const v = columns[c][idx[i]] - columns[c][idx[j]];
        s += v * v;
      }
      const d = Math.sqrt(s);
      dist[i * n + j] = d;
      dist[j * n + i] = d;
    }
  }

  // Each active cluster is a set of original indices; track membership + size.
  const members: number[][] = idx.map((_, i) => [i]);
  const active = new Set<number>(members.map((_, i) => i));
  // Cluster-to-cluster distance, initialized from point distances.
  const cdist = (a: number, b: number): number => {
    let acc = linkage === "single" ? Infinity : linkage === "complete" ? -Infinity : 0;
    let cnt = 0;
    for (const pi of members[a]) {
      for (const pj of members[b]) {
        const d = dist[pi * n + pj];
        if (linkage === "single") acc = Math.min(acc, d);
        else if (linkage === "complete") acc = Math.max(acc, d);
        else {
          acc += d;
          cnt++;
        }
      }
    }
    return linkage === "average" ? acc / (cnt || 1) : acc;
  };

  while (active.size > k) {
    let bestA = -1;
    let bestB = -1;
    let bestD = Infinity;
    const arr = [...active];
    for (let x = 0; x < arr.length; x++) {
      for (let y = x + 1; y < arr.length; y++) {
        const d = cdist(arr[x], arr[y]);
        if (d < bestD) {
          bestD = d;
          bestA = arr[x];
          bestB = arr[y];
        }
      }
    }
    if (bestA === -1) break;
    members[bestA] = members[bestA].concat(members[bestB]);
    members[bestB] = [];
    active.delete(bestB);
  }

  const labels = new Int32Array(n);
  let label = 0;
  for (const a of active) {
    for (const pi of members[a]) labels[pi] = label;
    label++;
  }
  return { labels, k: active.size };
}
