import type { Population } from "../population.ts";

/**
 * DBSCAN density-based clustering (Ester et al. 1996). Labels: 0..k-1 for
 * clusters, -1 for noise. Reimplemented from the standard algorithm (linfa's
 * DBSCAN is the permissive reference). Region queries are naive O(N²); at scale
 * this becomes a kd-tree / Rust→WASM hot loop. Foundation alongside k-means for
 * the clustering tier.
 */
export interface DbscanResult {
  labels: Int32Array;
  clusterCount: number;
}

const NOISE = -1;
const UNVISITED = -2;

export function dbscan(
  columns: ArrayLike<number>[],
  eps: number,
  minPts: number,
  opts: { parent?: Population } = {},
): DbscanResult {
  const d = columns.length;
  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;

  const labels = new Int32Array(n).fill(UNVISITED);
  const eps2 = eps * eps;

  const dist2 = (p: number, q: number): number => {
    const ep = idx[p];
    const eq = idx[q];
    let s = 0;
    for (let j = 0; j < d; j++) {
      const dv = columns[j][ep] - columns[j][eq];
      s += dv * dv;
    }
    return s;
  };
  const neighbors = (p: number): number[] => {
    const out: number[] = [];
    for (let q = 0; q < n; q++) if (dist2(p, q) <= eps2) out.push(q);
    return out;
  };

  let cluster = 0;
  for (let p = 0; p < n; p++) {
    if (labels[p] !== UNVISITED) continue;
    const nb = neighbors(p);
    if (nb.length < minPts) {
      labels[p] = NOISE;
      continue;
    }
    labels[p] = cluster;
    const seeds = nb.filter((q) => q !== p);
    for (let s = 0; s < seeds.length; s++) {
      const q = seeds[s];
      if (labels[q] === NOISE) labels[q] = cluster; // border point
      if (labels[q] !== UNVISITED) continue;
      labels[q] = cluster;
      const qnb = neighbors(q);
      if (qnb.length >= minPts) {
        for (const r of qnb) if (!seeds.includes(r)) seeds.push(r);
      }
    }
    cluster++;
  }

  // Map any remaining UNVISITED (shouldn't happen) to NOISE.
  for (let i = 0; i < n; i++) if (labels[i] === UNVISITED) labels[i] = NOISE;
  return { labels, clusterCount: cluster };
}
