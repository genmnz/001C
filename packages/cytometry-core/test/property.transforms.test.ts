import { describe, expect, test } from "bun:test";
import {
  AsinhTransform,
  CofactorAsinhTransform,
  HyperlogTransform,
  LinearTransform,
  LogTransform,
  LogicleTransform,
  type Transform,
} from "../src/transforms/index.ts";
import { mulberry32, uniform } from "./helpers.ts";

/**
 * Heavy fuzz of the transform invariants across randomized VALID parameters:
 *  - round-trip: unscale(scale(v)) == v
 *  - strict monotonicity of scale()
 * Thousands of evaluations per family; deterministic via a seeded PRNG.
 */
function checkRoundTripAndMonotonic(
  t: Transform,
  values: number[],
  rtTol: number,
): void {
  const sorted = [...values].sort((a, b) => a - b);
  let prev = -Infinity;
  for (const v of sorted) {
    const s = t.scale(v);
    expect(Number.isFinite(s)).toBe(true);
    // strictly increasing (distinct inputs)
    expect(s).toBeGreaterThan(prev);
    prev = s;
    const back = t.unscale(s);
    const tol = Math.max(rtTol, Math.abs(v) * rtTol);
    expect(Math.abs(back - v)).toBeLessThan(tol);
  }
}

describe("logicle/hyperlog fuzz over random valid params", () => {
  const r = mulberry32(0xc0ffee);
  for (let trial = 0; trial < 120; trial++) {
    const M = uniform(r, 2, 6);
    const W = uniform(r, 0.05, M / 2 - 0.01); // (0, M/2)
    const A = uniform(r, 0, M - 2 * W); // valid non-negative A
    const T = [16384, 65536, 262144, 1048576][trial % 4];
    const values: number[] = [0];
    for (let k = 0; k < 30; k++) values.push(uniform(r, -0.2 * T, T));
    // de-dup-ish: jitter equal-zero collisions are negligible with random floats
    test.skipIf(false)(`logicle T=${T} W=${W.toFixed(2)} M=${M.toFixed(2)}`, () => {
      checkRoundTripAndMonotonic(new LogicleTransform(T, W, M, A), values, 1e-3);
    });
    test.skipIf(false)(`hyperlog T=${T} W=${W.toFixed(2)} M=${M.toFixed(2)}`, () => {
      checkRoundTripAndMonotonic(new HyperlogTransform(T, W, M, A), values, 1e-3);
    });
  }
});

describe("asinh/log/linear fuzz", () => {
  const r = mulberry32(42);
  test("asinh round-trips and is monotonic (incl. negatives)", () => {
    for (let trial = 0; trial < 80; trial++) {
      const M = uniform(r, 2, 6);
      const A = uniform(r, 0, 1);
      const T = 262144;
      const values = Array.from({ length: 30 }, () => uniform(r, -0.5 * T, T));
      checkRoundTripAndMonotonic(new AsinhTransform(T, M, A), values, 1e-6);
    }
  });
  test("cofactor asinh round-trips", () => {
    for (let trial = 0; trial < 50; trial++) {
      const cof = uniform(r, 1, 500);
      const values = Array.from({ length: 30 }, () => uniform(r, -1e5, 1e5));
      checkRoundTripAndMonotonic(new CofactorAsinhTransform(cof), values, 1e-6);
    }
  });
  test("log round-trips for positive values", () => {
    for (let trial = 0; trial < 50; trial++) {
      const M = uniform(r, 2, 6);
      const T = 262144;
      const values = Array.from({ length: 30 }, () => uniform(r, 1, T));
      checkRoundTripAndMonotonic(new LogTransform(T, M), values, 1e-6);
    }
  });
  test("linear round-trips and is monotonic", () => {
    for (let trial = 0; trial < 50; trial++) {
      const T = uniform(r, 1000, 1e6);
      const values = Array.from({ length: 30 }, () => uniform(r, -T, T));
      checkRoundTripAndMonotonic(new LinearTransform(T, 0), values, 1e-6);
    }
  });
});
