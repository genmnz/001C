import { invertSquare } from "./invert.ts";

/**
 * Spectral unmixing — solve observed = M·abundances for abundances, where M is
 * the d×f spectral signature matrix (d detectors ≥ f fluorophores). OLS uses the
 * normal equations P = (MᵀM)⁻¹Mᵀ (precompute once, apply per event); NNLS
 * (Lawson-Hanson active-set) enforces non-negative abundances. Reimplemented from
 * the generalized unmixing model (Novo et al., PMC4177998). The per-event apply
 * is the spectral hot loop (Rust→WASM candidate); the f×f inverse is one-time.
 *
 * M is row-major d*f (d rows of f values).
 */

/** Precompute the OLS pseudo-inverse P (f×d, row-major) = (MᵀM)⁻¹ Mᵀ. */
export function unmixMatrix(M: number[][]): { P: Float64Array; f: number; d: number } {
  const d = M.length;
  const f = M[0].length;
  // MtM (f×f)
  const mtm = new Float64Array(f * f);
  for (let a = 0; a < f; a++) {
    for (let b = 0; b < f; b++) {
      let s = 0;
      for (let k = 0; k < d; k++) s += M[k][a] * M[k][b];
      mtm[a * f + b] = s;
    }
  }
  const inv = invertSquare(mtm, f); // (MtM)^-1, f×f
  // P = inv · Mᵀ  -> f×d
  const P = new Float64Array(f * d);
  for (let a = 0; a < f; a++) {
    for (let k = 0; k < d; k++) {
      let s = 0;
      for (let b = 0; b < f; b++) s += inv[a * f + b] * M[k][b];
      P[a * d + k] = s;
    }
  }
  return { P, f, d };
}

/** Apply the OLS pseudo-inverse to one observed spectrum x (length d). */
export function unmixOLS(
  P: Float64Array,
  f: number,
  d: number,
  x: ArrayLike<number>,
): number[] {
  const a = new Array(f).fill(0);
  for (let i = 0; i < f; i++) {
    let s = 0;
    for (let k = 0; k < d; k++) s += P[i * d + k] * x[k];
    a[i] = s;
  }
  return a;
}

/**
 * Non-negative least squares (Lawson & Hanson 1974) for one spectrum:
 * argmin_{a>=0} ||M·a - x||. M is d×f (number[][]).
 */
export function nnls(
  M: number[][],
  x: ArrayLike<number>,
  maxIter = 100,
  tol = 1e-10,
): number[] {
  const d = M.length;
  const f = M[0].length;
  const a = new Float64Array(f); // solution, starts at 0
  const P = new Set<number>(); // passive (active variables) set
  const Z = new Set<number>(); // zeroed set
  for (let i = 0; i < f; i++) Z.add(i);

  const mtCol = (j: number, v: Float64Array): number => {
    let s = 0;
    for (let k = 0; k < d; k++) s += M[k][j] * v[k];
    return s;
  };

  const residual = (): Float64Array => {
    const r = new Float64Array(d);
    for (let k = 0; k < d; k++) {
      let mk = 0;
      for (let j = 0; j < f; j++) mk += M[k][j] * a[j];
      r[k] = x[k] - mk;
    }
    return r;
  };

  for (let outer = 0; outer < maxIter; outer++) {
    const r = residual();
    // Gradient w = Mᵀ r; find the zeroed index with the largest positive w.
    let best = -1;
    let bestW = tol;
    for (const j of Z) {
      const w = mtCol(j, r);
      if (w > bestW) {
        bestW = w;
        best = j;
      }
    }
    if (best === -1) break; // optimal

    Z.delete(best);
    P.add(best);

    // Inner loop: solve unconstrained LS on the passive set; if any go <=0, fix.
    for (let inner = 0; inner < maxIter; inner++) {
      const cols = [...P].sort((u, v) => u - v);
      const z = solvePassive(M, x, cols, d);
      let allPositive = true;
      for (let ci = 0; ci < cols.length; ci++) {
        if (z[ci] <= 0) {
          allPositive = false;
          break;
        }
      }
      if (allPositive) {
        for (let j = 0; j < f; j++) a[j] = 0;
        for (let ci = 0; ci < cols.length; ci++) a[cols[ci]] = z[ci];
        break;
      }
      // Step toward z, stopping at the first variable hitting 0.
      let alpha = Infinity;
      for (let ci = 0; ci < cols.length; ci++) {
        const j = cols[ci];
        if (z[ci] <= 0) alpha = Math.min(alpha, a[j] / (a[j] - z[ci]));
      }
      for (let ci = 0; ci < cols.length; ci++) {
        const j = cols[ci];
        a[j] = a[j] + alpha * (z[ci] - a[j]);
      }
      // Move variables that hit zero back to Z.
      for (const j of [...P]) {
        if (a[j] <= tol) {
          a[j] = 0;
          P.delete(j);
          Z.add(j);
        }
      }
    }
  }
  return Array.from(a);
}

/**
 * Weighted least squares unmixing: solve (Mᵀ W M) a = Mᵀ W x with per-detector
 * weights. Default weights ≈ 1/max(x, eps) (Poisson-noise model), down-weighting
 * bright, noisy detectors. M is d×f.
 */
export function unmixWLS(
  M: number[][],
  x: ArrayLike<number>,
  opts: { weights?: ArrayLike<number>; eps?: number } = {},
): number[] {
  const d = M.length;
  const f = M[0].length;
  const eps = opts.eps ?? 1;
  const w = new Float64Array(d);
  for (let k = 0; k < d; k++) {
    w[k] = opts.weights ? opts.weights[k] : 1 / Math.max(x[k], eps);
  }
  const mtwm = new Float64Array(f * f);
  const mtwx = new Float64Array(f);
  for (let a = 0; a < f; a++) {
    for (let b = 0; b < f; b++) {
      let s = 0;
      for (let k = 0; k < d; k++) s += M[k][a] * w[k] * M[k][b];
      mtwm[a * f + b] = s;
    }
    let sb = 0;
    for (let k = 0; k < d; k++) sb += M[k][a] * w[k] * x[k];
    mtwx[a] = sb;
  }
  const inv = invertSquare(mtwm, f);
  const out = new Array(f).fill(0);
  for (let a = 0; a < f; a++) {
    let s = 0;
    for (let b = 0; b < f; b++) s += inv[a * f + b] * mtwx[b];
    out[a] = s;
  }
  return out;
}

/** Append an autofluorescence spectrum as an extra "fluorophore" column of M,
 *  so unmixing yields a per-cell AF abundance (AF extraction/subtraction). */
export function appendAutofluorescence(M: number[][], af: number[]): number[][] {
  return M.map((row, k) => [...row, af[k]]);
}

/** Solve the unconstrained LS using only `cols` of M (normal equations). */
function solvePassive(
  M: number[][],
  x: ArrayLike<number>,
  cols: number[],
  d: number,
): number[] {
  const p = cols.length;
  const ata = new Float64Array(p * p);
  const atb = new Float64Array(p);
  for (let a = 0; a < p; a++) {
    for (let b = 0; b < p; b++) {
      let s = 0;
      for (let k = 0; k < d; k++) s += M[k][cols[a]] * M[k][cols[b]];
      ata[a * p + b] = s;
    }
    let sb = 0;
    for (let k = 0; k < d; k++) sb += M[k][cols[a]] * x[k];
    atb[a] = sb;
  }
  const inv = invertSquare(ata, p);
  const z = new Array(p).fill(0);
  for (let a = 0; a < p; a++) {
    let s = 0;
    for (let b = 0; b < p; b++) s += inv[a * p + b] * atb[b];
    z[a] = s;
  }
  return z;
}
