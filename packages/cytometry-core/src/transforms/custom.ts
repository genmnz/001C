import type { Transform } from "./types.ts";

/**
 * User-defined transform: supply a forward function and its inverse. Lets the
 * engine apply arbitrary channel scalings (e.g. a custom biexponential variant)
 * without a dedicated class. The caller guarantees fInv is the inverse of f.
 */
export class CustomTransform implements Transform {
  readonly kind = "custom";
  constructor(
    private readonly f: (x: number) => number,
    private readonly fInv: (y: number) => number,
  ) {}
  scale(x: number): number {
    return this.f(x);
  }
  unscale(y: number): number {
    return this.fInv(y);
  }
}
