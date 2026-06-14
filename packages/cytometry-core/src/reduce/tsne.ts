import type { Population } from "../population.ts";

/**
 * t-SNE (van der Maaten & Hinton 2008) — exact O(N²) variant, suitable up to a
 * few thousand events (subsample, or use a Barnes-Hut/Rust path, beyond that).
 * Gaussian input affinities calibrated to a target perplexity by binary search,
 * Student-t output affinities, gradient descent with early exaggeration +
 * adaptive gains + momentum. No patent (t-SNE/viSNE are unencumbered). Stochastic
 * → validate by neighbor preservation, never exact coordinates.
 */
export interface TsneOptions {
  perplexity?: number;
  iterations?: number;
  learningRate?: number;
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

export function tsne(
  columns: ArrayLike<number>[],
  opts: TsneOptions = {},
): number[][] {
  const d = columns.length;
  const perplexity = opts.perplexity ?? 30;
  const iterations = opts.iterations ?? 500;
  const eta = opts.learningRate ?? 200;
  const rng = mulberry32(opts.seed ?? 1);

  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;

  // Pairwise squared distances (n×n).
  const D = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let k = 0; k < d; k++) {
        const dv = columns[k][idx[i]] - columns[k][idx[j]];
        s += dv * dv;
      }
      D[i * n + j] = s;
      D[j * n + i] = s;
    }
  }

  // Calibrate per-point precision (beta) to the target perplexity, build P.
  const P = new Float64Array(n * n);
  const logU = Math.log(perplexity);
  for (let i = 0; i < n; i++) {
    let beta = 1;
    let betaMin = -Infinity;
    let betaMax = Infinity;
    const row = new Float64Array(n);
    for (let tries = 0; tries < 60; tries++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) {
          row[j] = 0;
          continue;
        }
        row[j] = Math.exp(-D[i * n + j] * beta);
        sum += row[j];
      }
      if (sum === 0) sum = 1e-12;
      let H = 0;
      for (let j = 0; j < n; j++) H += D[i * n + j] * row[j];
      H = Math.log(sum) + (beta * H) / sum;
      const diff = H - logU;
      if (Math.abs(diff) < 1e-5) break;
      if (diff > 0) {
        betaMin = beta;
        beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2;
      } else {
        betaMax = beta;
        beta = betaMin === -Infinity ? beta / 2 : (beta + betaMin) / 2;
      }
    }
    let sum = 0;
    for (let j = 0; j < n; j++) sum += row[j];
    if (sum === 0) sum = 1e-12;
    for (let j = 0; j < n; j++) P[i * n + j] = row[j] / sum;
  }
  // Symmetrize + normalize, with early exaggeration.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const v = (P[i * n + j] + P[j * n + i]) / (2 * n);
      P[i * n + j] = v;
      P[j * n + i] = v;
    }
  }
  const EXAG = 12;
  for (let k = 0; k < n * n; k++) P[k] = Math.max(P[k] * EXAG, 1e-12);

  // Initialize Y ~ N(0, 1e-4) in 2D.
  const Y = new Float64Array(n * 2);
  const gauss = () => {
    const u = Math.max(1e-9, rng());
    const v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  for (let k = 0; k < n * 2; k++) Y[k] = gauss() * 1e-4;

  const dY = new Float64Array(n * 2);
  const iY = new Float64Array(n * 2); // momentum
  const gains = new Float64Array(n * 2).fill(1);
  const num = new Float64Array(n * n);

  for (let iter = 0; iter < iterations; iter++) {
    // Student-t affinities Q.
    let qsum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = Y[i * 2] - Y[j * 2];
        const dy = Y[i * 2 + 1] - Y[j * 2 + 1];
        const nij = 1 / (1 + dx * dx + dy * dy);
        num[i * n + j] = nij;
        num[j * n + i] = nij;
        qsum += 2 * nij;
      }
    }
    if (qsum === 0) qsum = 1e-12;

    // Gradient.
    dY.fill(0);
    for (let i = 0; i < n; i++) {
      let gx = 0;
      let gy = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const q = num[i * n + j] / qsum;
        const mult = (P[i * n + j] - q) * num[i * n + j];
        gx += mult * (Y[i * 2] - Y[j * 2]);
        gy += mult * (Y[i * 2 + 1] - Y[j * 2 + 1]);
      }
      dY[i * 2] = 4 * gx;
      dY[i * 2 + 1] = 4 * gy;
    }

    const momentum = iter < 250 ? 0.5 : 0.8;
    for (let k = 0; k < n * 2; k++) {
      const sameSign = Math.sign(dY[k]) === Math.sign(iY[k]);
      gains[k] = Math.max(0.01, sameSign ? gains[k] * 0.8 : gains[k] + 0.2);
      iY[k] = momentum * iY[k] - eta * gains[k] * dY[k];
      Y[k] += iY[k];
    }
    // Re-center.
    for (let dim = 0; dim < 2; dim++) {
      let mean = 0;
      for (let i = 0; i < n; i++) mean += Y[i * 2 + dim];
      mean /= n;
      for (let i = 0; i < n; i++) Y[i * 2 + dim] -= mean;
    }
    // End early exaggeration.
    if (iter === 100) for (let k = 0; k < n * n; k++) P[k] /= EXAG;
  }

  const out: number[][] = [];
  for (let i = 0; i < n; i++) out.push([Y[i * 2], Y[i * 2 + 1]]);
  return out;
}
