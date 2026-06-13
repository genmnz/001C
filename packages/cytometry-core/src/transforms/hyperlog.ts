import type { Transform } from "./types.ts";

/**
 * Hyperlog transform — Bagwell C.B., "Hyperlog—a flexible log-like transform for
 * negative, zero, and positive valued data," Cytometry A 2005;64(1):34-42; as in
 * the GatingML 2.0 spec. Display→data is the closed form
 *
 *     EH(y) = a·e^(b·y) + c·y − f
 *
 * (one exponential + a linear term), constructed so EH(x1)=0 and EH(1)=T.
 * data→display inverts EH numerically. EH is strictly increasing and, unlike
 * logicle's two-exponential B(x), has no catastrophic cancellation near zero —
 * so no Taylor series is needed. Validated against flowutils (oracle) in the
 * golden tests.
 */
const LN10 = Math.LN10;

export class HyperlogTransform implements Transform {
  readonly kind = "hyperlog";
  readonly T: number;
  readonly W: number;
  readonly M: number;
  readonly A: number;

  private readonly a: number;
  private readonly b: number;
  private readonly c: number;
  private readonly f: number;
  private readonly x1: number;

  constructor(T = 262144, W = 0.5, M = 4.5, A = 0) {
    if (T <= 0) throw new RangeError("hyperlog: T must be > 0");
    if (W <= 0) throw new RangeError("hyperlog: W must be > 0");
    if (M <= 0) throw new RangeError("hyperlog: M must be > 0");
    if (W > M / 2) throw new RangeError("hyperlog: W must be <= M/2");
    if (A < -W || A > M - 2 * W) throw new RangeError("hyperlog: A out of range");
    this.T = T;
    this.W = W;
    this.M = M;
    this.A = A;

    const w = W / (M + A);
    const x2 = A / (M + A);
    this.x1 = x2 + w;
    const x0 = x2 + 2 * w;
    this.b = (M + A) * LN10;

    const e0 = Math.exp(this.b * x0);
    const cA = e0 / w;
    const fA = Math.exp(this.b * this.x1) + cA * this.x1;
    this.a = T / (Math.exp(this.b) + cA - fA);
    this.c = cA * this.a;
    this.f = fA * this.a;
  }

  private EH(y: number): number {
    return this.a * Math.exp(this.b * y) + this.c * y - this.f;
  }
  private EHprime(y: number): number {
    return this.a * this.b * Math.exp(this.b * y) + this.c;
  }

  /** display -> data (reflected about x1, like logicle) */
  unscale(y: number): number {
    const negative = y < this.x1;
    const u = negative ? 2 * this.x1 - y : y;
    const v = this.EH(u);
    return negative ? -v : v;
  }

  /** data -> display (root of EH(y) - |x| for y >= x1, then reflect) */
  scale(x: number): number {
    if (x === 0) return this.x1;
    const negative = x < 0;
    const v = negative ? -x : x;

    let lo = this.x1;
    let hi = 1;
    while (this.EH(hi) < v && hi < 1e6) hi *= 2;

    let y = 0.5 * (lo + hi);
    let dxOld = hi - lo;
    let dx = dxOld;
    let fx = this.EH(y) - v;
    let dfx = this.EHprime(y);
    const tol = 1e-13;

    for (let i = 0; i < 80; i++) {
      if (
        ((y - hi) * dfx - fx) * ((y - lo) * dfx - fx) > 0 ||
        Math.abs(2 * fx) > Math.abs(dxOld * dfx)
      ) {
        dxOld = dx;
        dx = 0.5 * (hi - lo);
        y = lo + dx;
        if (lo === y) break;
      } else {
        dxOld = dx;
        dx = fx / dfx;
        const prev = y;
        y -= dx;
        if (prev === y) break;
      }
      if (Math.abs(dx) < tol) break;
      fx = this.EH(y) - v;
      dfx = this.EHprime(y);
      if (fx < 0) lo = y;
      else hi = y;
    }
    return negative ? 2 * this.x1 - y : y;
  }
}
