import { invertSquare } from "../compensation/invert.ts";

/**
 * Binary logistic regression via IRLS (Newton-Raphson) with optional L2 — a
 * permissive cell/population classifier and the regression backbone for
 * supervised gating. Columnar features; closed-form Newton steps on the small
 * (d+1)×(d+1) Hessian (training is batch; inference is per-event and cheap).
 */
export interface LogisticModel {
  weights: number[];
  bias: number;
  predict(x: ArrayLike<number>): number;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function logisticRegression(
  columns: ArrayLike<number>[],
  y: ArrayLike<number>,
  opts: { iterations?: number; l2?: number } = {},
): LogisticModel {
  const d = columns.length;
  const n = columns[0].length;
  const iterations = opts.iterations ?? 25;
  const l2 = opts.l2 ?? 1e-3;
  const p = d + 1; // + bias

  // Design row accessor (feature 0..d-1, then bias=1).
  const xrow = (i: number, j: number) => (j < d ? columns[j][i] : 1);
  const w = new Float64Array(p); // last is bias

  for (let iter = 0; iter < iterations; iter++) {
    // Gradient g (p) and Hessian H (p×p) of the penalized log-likelihood.
    const g = new Float64Array(p);
    const H = new Float64Array(p * p);
    for (let i = 0; i < n; i++) {
      let z = 0;
      for (let j = 0; j < p; j++) z += w[j] * xrow(i, j);
      const mu = sigmoid(z);
      const r = mu - y[i];
      const s = mu * (1 - mu);
      for (let a = 0; a < p; a++) {
        const xa = xrow(i, a);
        g[a] += r * xa;
        for (let b = 0; b < p; b++) H[a * p + b] += s * xa * xrow(i, b);
      }
    }
    // L2 (not on bias).
    for (let a = 0; a < d; a++) {
      g[a] += l2 * w[a];
      H[a * p + a] += l2;
    }
    let inv: Float64Array;
    try {
      inv = invertSquare(H, p);
    } catch {
      break; // singular Hessian -> stop
    }
    let maxStep = 0;
    for (let a = 0; a < p; a++) {
      let step = 0;
      for (let b = 0; b < p; b++) step += inv[a * p + b] * g[b];
      w[a] -= step;
      maxStep = Math.max(maxStep, Math.abs(step));
    }
    if (maxStep < 1e-8) break;
  }

  const weights = Array.from(w.slice(0, d));
  const bias = w[d];
  return {
    weights,
    bias,
    predict(x: ArrayLike<number>): number {
      let z = bias;
      for (let j = 0; j < d; j++) z += weights[j] * x[j];
      return sigmoid(z);
    },
  };
}

/** Accuracy of probabilistic predictions at a 0.5 threshold. */
export function accuracy(predProb: number[], y: ArrayLike<number>): number {
  let correct = 0;
  for (let i = 0; i < predProb.length; i++) {
    if ((predProb[i] >= 0.5 ? 1 : 0) === y[i]) correct++;
  }
  return correct / predProb.length;
}
