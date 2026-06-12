import type { Transform } from "./types.ts";

const LN10 = Math.LN10;

/**
 * GatingML 2.0 `fasinh` (inverse hyperbolic sine), the standard CyTOF transform.
 *
 *   f(x) = ( asinh( x * sinh(M*ln10) / T ) + A*ln10 ) / ( (M + A) * ln10 )
 *
 * It is symmetric about 0 (handles negative/compensated values natively) and,
 * unlike logicle, has a closed-form inverse — no root-finding required.
 */
export class AsinhTransform implements Transform {
  readonly kind = "asinh";
  private readonly sinhM: number;
  constructor(
    private readonly t = 262144,
    private readonly m = 4.5,
    private readonly a = 0,
  ) {
    if (t <= 0) throw new RangeError("asinh: T must be > 0");
    if (m <= 0) throw new RangeError("asinh: M must be > 0");
    this.sinhM = Math.sinh(m * LN10);
  }
  scale(x: number): number {
    const denom = (this.m + this.a) * LN10;
    return (Math.asinh((x * this.sinhM) / this.t) + this.a * LN10) / denom;
  }
  unscale(y: number): number {
    const arg = y * (this.m + this.a) * LN10 - this.a * LN10;
    return (this.t * Math.sinh(arg)) / this.sinhM;
  }
}

/**
 * Cofactor arcsinh, the form most cytometrists actually type: f(x) = asinh(x/c).
 * Typical cofactors: 5 for mass cytometry, 150 for fluorescence.
 */
export class CofactorAsinhTransform implements Transform {
  readonly kind = "asinh-cofactor";
  constructor(private readonly cofactor = 5) {
    if (cofactor <= 0) throw new RangeError("asinh: cofactor must be > 0");
  }
  scale(x: number): number {
    return Math.asinh(x / this.cofactor);
  }
  unscale(y: number): number {
    return Math.sinh(y) * this.cofactor;
  }
}
