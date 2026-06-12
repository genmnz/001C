import type { Transform } from "./types.ts";

/**
 * Logicle (biexponential) transform — Moore W.A. & Parks D.R., "Update for the
 * logicle data scale including operational code implementations," Cytometry
 * Part A 2012;81A(4):273-277 (doi:10.1002/cyto.a.22030). Original method:
 * Parks, Roederer & Moore, Cytometry A 2006;69A(6):541-551.
 *
 * Reference implementation © Board of Trustees, Leland Stanford Junior
 * University, BSD-style license (package edu.stanford.facs.transform). This is a
 * faithful TypeScript port. The forward map is a biexponential
 *
 *     B(x) = a*e^(b*x) - c*e^(-d*x) + f
 *
 * constructed so that B(x1) = 0 (data value 0 sits at scale x1, giving a
 * linear-like region around zero) and B(1) = T (top of scale). `unscale` is a
 * direct evaluation; `scale` inverts B numerically with a bracketed
 * Newton/bisection (RTSAFE) — robust for the whole domain including negatives.
 *
 * PATENT NOTE: the logicle display is covered by US Patent 6,954,722 (Stanford).
 * It ships under a permissive BSD license, is part of the ISAC Gating-ML 2.0
 * standard, and downstream projects report Stanford does not enforce it for flow
 * cytometry. Get legal sign-off before commercial distribution. See
 * docs/DERISKING.md.
 *
 * VALIDATION NOTE: this port passes round-trip, monotonicity, and analytic
 * anchor tests (B(x1)=0, B(1)=T). Before production it must additionally be
 * checked against flowCore/FlowKit golden values — see
 * test/logicle.golden.test.ts for the (stubbed) harness.
 */

const LN10 = Math.LN10;
const TAYLOR_LENGTH = 16;

/**
 * Solve for the parameter `d` of the biexponential given `b` and the
 * (normalized) linearization width `w`. Finds the root of
 *   g(d) = 2*ln(d) + w*d - 2*ln(b) + w*b
 * on (0, b) via RTSAFE (Numerical Recipes): Newton's method safeguarded by
 * bisection. g is strictly increasing, g(0+) -> -inf, g(b) = 2*w*b > 0.
 */
export function solveD(b: number, w: number): number {
  if (w === 0) return b; // degenerate: logicle collapses to asinh
  const tolerance = 2 * b * Number.EPSILON;
  let dLo = 0;
  let dHi = b;
  const fConst = -2 * Math.log(b) + w * b;
  let d = 0.5 * (dLo + dHi);
  let lastDelta = dHi - dLo;
  let f = 2 * Math.log(d) + w * d + fConst;

  for (let i = 0; i < 40; i++) {
    const df = 2 / d + w;
    let delta: number;
    // Bisect if Newton would leave the bracket or is converging too slowly.
    if (
      ((d - dHi) * df - f) * ((d - dLo) * df - f) >= 0 ||
      Math.abs(1.9 * f) > Math.abs(lastDelta * df)
    ) {
      delta = 0.5 * (dHi - dLo);
      const dNew = dLo + delta;
      if (dNew === dLo) return dNew;
      d = dNew;
    } else {
      delta = f / df;
      const prev = d;
      d -= delta;
      if (d === prev) return d;
    }
    if (Math.abs(delta) < tolerance) return d;
    lastDelta = delta;
    f = 2 * Math.log(d) + w * d + fConst;
    if (f < 0) dLo = d;
    else dHi = d;
  }
  return d;
}

export class LogicleTransform implements Transform {
  readonly kind = "logicle";
  readonly T: number;
  readonly W: number;
  readonly M: number;
  readonly A: number;

  // Biexponential parameters.
  private readonly a: number;
  private readonly b: number;
  private readonly c: number;
  private readonly d: number;
  private readonly f: number;
  // Breakpoints in scale space.
  private readonly w: number;
  private readonly x1: number;
  private readonly xTaylor: number;
  // Taylor coefficients of B around x1 (taylor[k] is the coeff of (x-x1)^(k+1)).
  private readonly taylor: Float64Array;

  /**
   * @param T top of data scale (e.g. 262144 = 2^18 for 18-bit data)
   * @param W width of the linearization region, in decades (e.g. 0.5)
   * @param M total number of decades the scale spans (e.g. 4.5)
   * @param A number of additional negative decades to display (e.g. 0)
   */
  constructor(T = 262144, W = 0.5, M = 4.5, A = 0) {
    if (T <= 0) throw new RangeError("logicle: T must be > 0");
    if (W < 0) throw new RangeError("logicle: W must be >= 0");
    if (M <= 0) throw new RangeError("logicle: M must be > 0");
    if (W > M / 2) throw new RangeError("logicle: W must be <= M/2");
    if (A < -W || A > M - 2 * W) throw new RangeError("logicle: A out of range");
    this.T = T;
    this.W = W;
    this.M = M;
    this.A = A;

    this.w = W / (M + A);
    const x2 = A / (M + A);
    this.x1 = x2 + this.w;
    const x0 = x2 + 2 * this.w;
    this.b = (M + A) * LN10;
    this.d = solveD(this.b, this.w);

    const cA = Math.exp(x0 * (this.b + this.d));
    const mfA = Math.exp(this.b * this.x1) - cA / Math.exp(this.d * this.x1);
    this.a = T / (Math.exp(this.b) - mfA - cA / Math.exp(this.d));
    this.c = cA * this.a;
    this.f = -mfA * this.a;

    // Taylor series of B around x1 avoids catastrophic cancellation near 0.
    this.xTaylor = this.x1 + this.w / 4;
    let posCoef = this.a * Math.exp(this.b * this.x1);
    let negCoef = -this.c * Math.exp(-this.d * this.x1);
    const taylor = new Float64Array(TAYLOR_LENGTH);
    for (let i = 0; i < TAYLOR_LENGTH; i++) {
      posCoef *= this.b / (i + 1);
      negCoef *= -this.d / (i + 1);
      taylor[i] = posCoef + negCoef;
    }
    this.taylor = taylor;
  }

  private seriesBiexponential(scale: number): number {
    const t = scale - this.x1;
    const taylor = this.taylor;
    let sum = taylor[TAYLOR_LENGTH - 1];
    for (let i = TAYLOR_LENGTH - 2; i >= 0; i--) sum = sum * t + taylor[i];
    return sum * t;
  }

  /** Evaluate B(x) for x >= x1 (no negative-reflection). */
  private evalB(x: number): number {
    if (x < this.xTaylor) return this.seriesBiexponential(x);
    return this.a * Math.exp(this.b * x) + this.f - this.c * Math.exp(-this.d * x);
  }

  /** B'(x) = a*b*e^(b*x) + c*d*e^(-d*x) > 0 — strictly increasing. */
  private evalBprime(x: number): number {
    return (
      this.a * this.b * Math.exp(this.b * x) +
      this.c * this.d * Math.exp(-this.d * x)
    );
  }

  /** logicle scale -> data value */
  unscale(scale: number): number {
    const negative = scale < this.x1;
    const x = negative ? 2 * this.x1 - scale : scale;
    const value = this.evalB(x);
    return negative ? -value : value;
  }

  /** data value -> logicle scale */
  scale(value: number): number {
    if (value === 0) return this.x1;
    const negative = value < 0;
    const v = negative ? -value : value;

    // Bracket the root of B(x) - v on [x1, hi]; B(x1)=0 <= v, extend hi until
    // B(hi) >= v (handles over-range data above T).
    let lo = this.x1;
    let hi = 1;
    while (this.evalB(hi) < v && hi < 64) hi *= 2;

    let x = 0.5 * (lo + hi);
    let dxOld = hi - lo;
    let dx = dxOld;
    let fx = this.evalB(x) - v;
    let dfx = this.evalBprime(x);
    // Tolerance is on the step in scale space (x in ~[0,1]), NOT on the data
    // residual — mixing data-space v in here makes it far too loose at large T.
    const tol = 1e-13;

    for (let i = 0; i < 60; i++) {
      if (
        ((x - hi) * dfx - fx) * ((x - lo) * dfx - fx) > 0 ||
        Math.abs(2 * fx) > Math.abs(dxOld * dfx)
      ) {
        dxOld = dx;
        dx = 0.5 * (hi - lo);
        x = lo + dx;
        if (lo === x) break;
      } else {
        dxOld = dx;
        dx = fx / dfx;
        const prev = x;
        x -= dx;
        if (prev === x) break;
      }
      if (Math.abs(dx) < tol) break;
      fx = this.evalB(x) - v;
      dfx = this.evalBprime(x);
      if (fx < 0) lo = x;
      else hi = x;
    }
    return negative ? 2 * this.x1 - x : x;
  }
}
