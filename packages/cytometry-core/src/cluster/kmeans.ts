import { Population } from "../population.ts";

/**
 * K-means (Lloyd's algorithm) with deterministic k-means++ seeding. Operates on
 * columnar channels over an optional population; labels align to the iteration
 * order of the population's set bits (or 0..n for the whole sample). The assign
 * step is the hot loop and is mirrored in the Rust/WASM crate (cluster.rs) for
 * large samples. Foundation for FlowSOM metaclustering.
 */
export interface KMeansResult {
  /** Cluster label per processed event (0..k-1). */
  labels: Int32Array;
  /** k centroids, each a d-vector. */
  centroids: number[][];
  /** Sum of squared distances to assigned centroids. */
  inertia: number;
  iterations: number;
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

export interface KMeansOptions {
  maxIter?: number;
  seed?: number;
  population?: Population;
}

export function kmeans(
  columns: ArrayLike<number>[],
  k: number,
  opts: KMeansOptions = {},
): KMeansResult {
  const d = columns.length;
  const maxIter = opts.maxIter ?? 100;
  const rng = mulberry32(opts.seed ?? 1);

  // Materialize the point index list (subset or all).
  const idx: number[] = [];
  if (opts.population) opts.population.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;
  if (n < k) throw new Error("kmeans: fewer events than clusters");

  const point = (p: number, out: number[]) => {
    const e = idx[p];
    for (let j = 0; j < d; j++) out[j] = columns[j][e];
  };
  const dist2 = (p: number, c: number[]): number => {
    const e = idx[p];
    let s = 0;
    for (let j = 0; j < d; j++) {
      const dv = columns[j][e] - c[j];
      s += dv * dv;
    }
    return s;
  };

  // k-means++ seeding.
  const centroids: number[][] = [];
  const first = Math.floor(rng() * n);
  const tmp = new Array(d);
  point(first, tmp);
  centroids.push([...tmp]);
  const dmin = new Float64Array(n).fill(Infinity);
  for (let c = 1; c < k; c++) {
    let total = 0;
    for (let p = 0; p < n; p++) {
      const dd = dist2(p, centroids[c - 1]);
      if (dd < dmin[p]) dmin[p] = dd;
      total += dmin[p];
    }
    let r = rng() * total;
    let chosen = 0;
    for (let p = 0; p < n; p++) {
      r -= dmin[p];
      if (r <= 0) {
        chosen = p;
        break;
      }
    }
    point(chosen, tmp);
    centroids.push([...tmp]);
  }

  const labels = new Int32Array(n);
  let iterations = 0;
  for (; iterations < maxIter; iterations++) {
    // Assign.
    let changed = false;
    for (let p = 0; p < n; p++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = dist2(p, centroids[c]);
        if (dd < bestD) {
          bestD = dd;
          best = c;
        }
      }
      if (labels[p] !== best) {
        labels[p] = best;
        changed = true;
      }
    }
    if (!changed && iterations > 0) break;

    // Update.
    const sums = Array.from({ length: k }, () => new Array(d).fill(0));
    const counts = new Int32Array(k);
    for (let p = 0; p < n; p++) {
      const c = labels[p];
      counts[c]++;
      const e = idx[p];
      for (let j = 0; j < d; j++) sums[c][j] += columns[j][e];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) continue; // keep empty centroid in place
      for (let j = 0; j < d; j++) centroids[c][j] = sums[c][j] / counts[c];
    }
  }

  let inertia = 0;
  for (let p = 0; p < n; p++) inertia += dist2(p, centroids[labels[p]]);

  return { labels, centroids, inertia, iterations };
}
