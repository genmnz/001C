import type { Population } from "../population.ts";
import { kmeans } from "./kmeans.ts";

/**
 * Gaussian Mixture Model via EM with diagonal covariances — the backbone of
 * model-based (flowClust-style) gating and soft clustering. k-means++ init,
 * responsibilities computed in log-space (log-sum-exp) for stability, variance
 * floored to avoid collapse. Diagonal covariance is the stable default for
 * cytometry; full covariance is a future option. Per-event E-step is the hot
 * loop (Rust→WASM candidate).
 */
export interface GmmResult {
  weights: number[];
  means: number[][];
  /** Diagonal variances per component (k × d). */
  variances: number[][];
  /** Hard labels (argmax responsibility). */
  labels: Int32Array;
  /** Soft responsibilities, row-major n×k. */
  responsibilities: Float64Array;
  logLikelihood: number;
  iterations: number;
}

export interface GmmOptions {
  maxIter?: number;
  seed?: number;
  tol?: number;
  varianceFloor?: number;
  parent?: Population;
}

const LOG_2PI = Math.log(2 * Math.PI);

export function gmm(
  columns: ArrayLike<number>[],
  k: number,
  opts: GmmOptions = {},
): GmmResult {
  const d = columns.length;
  const maxIter = opts.maxIter ?? 100;
  const tol = opts.tol ?? 1e-5;
  const floor = opts.varianceFloor ?? 1e-6;

  const idx: number[] = [];
  if (opts.parent) opts.parent.forEach((i) => idx.push(i));
  else for (let i = 0; i < columns[0].length; i++) idx.push(i);
  const n = idx.length;
  const xat = (p: number, j: number) => columns[j][idx[p]];

  // Init means from k-means++; weights uniform; variances from global spread.
  const km = kmeans(columns, k, { seed: opts.seed ?? 1, population: opts.parent });
  const means = km.centroids.map((c) => [...c]);
  const weights = new Array(k).fill(1 / k);
  const variances: number[][] = [];
  {
    const gmean = new Array(d).fill(0);
    for (let p = 0; p < n; p++) for (let j = 0; j < d; j++) gmean[j] += xat(p, j);
    for (let j = 0; j < d; j++) gmean[j] /= n;
    const gvar = new Array(d).fill(0);
    for (let p = 0; p < n; p++)
      for (let j = 0; j < d; j++) gvar[j] += (xat(p, j) - gmean[j]) ** 2;
    for (let j = 0; j < d; j++) gvar[j] = Math.max(floor, gvar[j] / n);
    for (let c = 0; c < k; c++) variances.push([...gvar]);
  }

  const resp = new Float64Array(n * k);
  let prevLL = -Infinity;
  let ll = -Infinity;
  let iter = 0;

  for (; iter < maxIter; iter++) {
    // E-step: log responsibilities, normalized via log-sum-exp.
    ll = 0;
    for (let p = 0; p < n; p++) {
      let maxLog = -Infinity;
      const logp = new Array(k);
      for (let c = 0; c < k; c++) {
        let lg = Math.log(weights[c]);
        for (let j = 0; j < d; j++) {
          const v = variances[c][j];
          const diff = xat(p, j) - means[c][j];
          lg += -0.5 * (LOG_2PI + Math.log(v) + (diff * diff) / v);
        }
        logp[c] = lg;
        if (lg > maxLog) maxLog = lg;
      }
      let sum = 0;
      for (let c = 0; c < k; c++) {
        logp[c] = Math.exp(logp[c] - maxLog);
        sum += logp[c];
      }
      ll += maxLog + Math.log(sum);
      for (let c = 0; c < k; c++) resp[p * k + c] = logp[c] / sum;
    }

    // M-step.
    for (let c = 0; c < k; c++) {
      let Nk = 0;
      for (let p = 0; p < n; p++) Nk += resp[p * k + c];
      Nk = Math.max(Nk, 1e-12);
      weights[c] = Nk / n;
      for (let j = 0; j < d; j++) {
        let mu = 0;
        for (let p = 0; p < n; p++) mu += resp[p * k + c] * xat(p, j);
        mu /= Nk;
        means[c][j] = mu;
      }
      for (let j = 0; j < d; j++) {
        let v = 0;
        for (let p = 0; p < n; p++) {
          const diff = xat(p, j) - means[c][j];
          v += resp[p * k + c] * diff * diff;
        }
        variances[c][j] = Math.max(floor, v / Nk);
      }
    }

    if (Math.abs(ll - prevLL) < tol * Math.abs(ll || 1)) {
      iter++;
      break;
    }
    prevLL = ll;
  }

  const labels = new Int32Array(n);
  for (let p = 0; p < n; p++) {
    let best = 0;
    for (let c = 1; c < k; c++) if (resp[p * k + c] > resp[p * k + best]) best = c;
    labels[p] = best;
  }

  return { weights, means, variances, labels, responsibilities: resp, logLikelihood: ll, iterations: iter };
}
