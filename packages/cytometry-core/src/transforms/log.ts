import type { Transform } from "./types.ts";

/**
 * GatingML 2.0 `flog`: f(x) = (1/M) * log10(x / T) + 1 for x > 0.
 *
 * Non-positive inputs are undefined for a pure log scale; we clamp them to 0
 * (bottom of scale) so callers can render compensated/negative data without
 * throwing. Use logicle/asinh when negatives carry signal.
 */
export class LogTransform implements Transform {
  readonly kind = "log";
  constructor(
    private readonly t = 262144,
    private readonly m = 4.5,
  ) {
    if (t <= 0) throw new RangeError("log: T must be > 0");
    if (m <= 0) throw new RangeError("log: M must be > 0");
  }
  scale(x: number): number {
    if (x <= 0) return 0;
    return (1 / this.m) * Math.log10(x / this.t) + 1;
  }
  unscale(y: number): number {
    return this.t * Math.pow(10, (y - 1) * this.m);
  }
}
