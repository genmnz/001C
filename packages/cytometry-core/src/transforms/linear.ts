import type { Transform } from "./types.ts";

/**
 * GatingML 2.0 `flin`: f(x) = (x + A) / (T + A), mapping [-A, T] onto [0, 1].
 */
export class LinearTransform implements Transform {
  readonly kind = "linear";
  constructor(
    private readonly t = 262144,
    private readonly a = 0,
  ) {
    if (t + a <= 0) throw new RangeError("linear: T + A must be > 0");
  }
  scale(x: number): number {
    return (x + this.a) / (this.t + this.a);
  }
  unscale(y: number): number {
    return y * (this.t + this.a) - this.a;
  }
}
