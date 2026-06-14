import { knn } from "../graph/knn.ts";
import type { Population } from "../population.ts";

/**
 * UMAP (McInnes et al. 2018) — fuzzy simplicial set + force-directed embedding.
 * Clean reimplementation of the published algorithm (umap-learn is BSD-3, no
 * patent): per-point smooth-kNN membership (rho + sigma binary search),
 * probabilistic symmetrization, then the canonical edge-sampled SGD with
 * negative sampling and decaying learning rate. The kNN graph is the cost
 * (HNSW/Rust at scale). Stochastic → validate by neighbor preservation.
 *
 * a,b default to the curve fit for min_dist=0.1, spread=1.0.
 */
export interface UmapOptions {
  nNeighbors?: number;
  epochs?: number;
  seed?: number;
  a?: number;
  b?: number;
  negativeSampleRate?: number;
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

const clamp4 = (g: number) => (g > 4 ? 4 : g < -4 ? -4 : g);

export function umap(
  columns: ArrayLike<number>[],
  opts: UmapOptions = {},
): number[][] {
  const nN = opts.nNeighbors ?? 15;
  const epochs = opts.epochs ?? 200;
  const a = opts.a ?? 1.5769;
  const b = opts.b ?? 0.8951;
  const negRate = opts.negativeSampleRate ?? 5;
  const rng = mulberry32(opts.seed ?? 1);

  const g = knn(columns, nN, { parent: opts.parent });
  const n = g.n;

  // Smooth kNN: per-point rho (nearest nonzero dist) and sigma (binary search).
  const targetLog = Math.log2(nN);
  const rho = new Float64Array(n);
  const sigma = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let nearest = Infinity;
    for (let t = 0; t < nN; t++) {
      const dd = g.distances[i * nN + t];
      if (dd > 0 && dd < nearest) nearest = dd;
    }
    rho[i] = Number.isFinite(nearest) ? nearest : 0;
    let lo = 0;
    let hi = Infinity;
    let s = 1;
    for (let iter = 0; iter < 64; iter++) {
      let sum = 0;
      for (let t = 0; t < nN; t++) {
        const dd = Math.max(0, g.distances[i * nN + t] - rho[i]);
        sum += Math.exp(-dd / s);
      }
      if (Math.abs(sum - targetLog) < 1e-5) break;
      if (sum > targetLog) {
        hi = s;
        s = (lo + hi) / 2;
      } else {
        lo = s;
        s = hi === Infinity ? s * 2 : (lo + hi) / 2;
      }
    }
    sigma[i] = s;
  }

  // Directed memberships, then probabilistic symmetrization p = a+b-ab.
  const dirW = new Map<string, number>();
  const getDir = (i: number, j: number): number => dirW.get(`${i}>${j}`) ?? 0;
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < nN; t++) {
      const j = g.indices[i * nN + t];
      if (j === i) continue;
      const dd = Math.max(0, g.distances[i * nN + t] - rho[i]);
      dirW.set(`${i}>${j}`, Math.exp(-dd / sigma[i]));
    }
  }
  const edgeMap = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < nN; t++) {
      const j = g.indices[i * nN + t];
      if (j === i) continue;
      const lo = Math.min(i, j);
      const hi = Math.max(i, j);
      const key = `${lo},${hi}`;
      if (edgeMap.has(key)) continue;
      const wij = getDir(i, j);
      const wji = getDir(j, i);
      edgeMap.set(key, wij + wji - wij * wji);
    }
  }
  const edges: { i: number; j: number; w: number }[] = [];
  let maxW = 0;
  for (const [key, w] of edgeMap) {
    const [i, j] = key.split(",").map(Number);
    edges.push({ i, j, w });
    if (w > maxW) maxW = w;
  }
  if (maxW === 0) maxW = 1;

  // Random init.
  const Y = new Float64Array(n * 2);
  for (let k = 0; k < n * 2; k++) Y[k] = (rng() - 0.5) * 20;

  // Canonical edge-sampled SGD with negative sampling.
  const epochsPerSample = edges.map((e) => maxW / e.w);
  const nextEpoch = epochsPerSample.slice();
  const epochsPerNeg = epochsPerSample.map((v) => v / negRate);
  const nextNeg = epochsPerNeg.slice();

  for (let epoch = 0; epoch < epochs; epoch++) {
    const alpha = 1 - epoch / epochs;
    for (let e = 0; e < edges.length; e++) {
      if (nextEpoch[e] > epoch) continue;
      const { i, j } = edges[e];
      // attractive
      let dx = Y[i * 2] - Y[j * 2];
      let dy = Y[i * 2 + 1] - Y[j * 2 + 1];
      let d2 = dx * dx + dy * dy;
      if (d2 > 0) {
        const grad = (-2 * a * b * Math.pow(d2, b - 1)) / (1 + a * Math.pow(d2, b));
        const gx = clamp4(grad * dx) * alpha;
        const gy = clamp4(grad * dy) * alpha;
        Y[i * 2] += gx;
        Y[i * 2 + 1] += gy;
        Y[j * 2] -= gx;
        Y[j * 2 + 1] -= gy;
      }
      // negative samples
      const nNeg = Math.floor((epoch - nextNeg[e]) / epochsPerNeg[e]);
      for (let s = 0; s < nNeg; s++) {
        const kpt = Math.floor(rng() * n);
        if (kpt === i) continue;
        dx = Y[i * 2] - Y[kpt * 2];
        dy = Y[i * 2 + 1] - Y[kpt * 2 + 1];
        d2 = dx * dx + dy * dy;
        let grad = 0;
        if (d2 > 0) grad = (2 * b) / ((0.001 + d2) * (1 + a * Math.pow(d2, b)));
        Y[i * 2] += clamp4(grad * dx) * alpha;
        Y[i * 2 + 1] += clamp4(grad * dy) * alpha;
      }
      nextEpoch[e] += epochsPerSample[e];
      nextNeg[e] += nNeg * epochsPerNeg[e];
    }
  }

  const out: number[][] = [];
  for (let i = 0; i < n; i++) out.push([Y[i * 2], Y[i * 2 + 1]]);
  return out;
}
