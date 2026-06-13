import { describe, expect, test } from "bun:test";
import { HyperlogTransform } from "../src/transforms/hyperlog.ts";
import golden from "./golden/hyperlog.golden.json";

/**
 * External-oracle validation of hyperlog against flowutils (the GatingML 2.0
 * hyperlog C extension). Matches to ~3e-17 including the reflected negative
 * region — see docs/VALIDATION.md.
 */
describe("HyperlogTransform vs flowutils golden values", () => {
  test("oracle provenance", () => {
    expect(golden.provenance.oracle).toBe("flowutils");
  });

  for (const c of golden.cases) {
    const { T, W, M, A } = c.params;
    const label = `T=${T} W=${W} M=${M} A=${A}`;

    test(`forward scale() matches oracle (${label})`, () => {
      const hl = new HyperlogTransform(T, W, M, A);
      let maxErr = 0;
      for (const { x, scale } of c.forward) {
        maxErr = Math.max(maxErr, Math.abs(hl.scale(x) - scale));
      }
      expect(maxErr).toBeLessThan(1e-9);
    });

    test(`inverse unscale() matches oracle (${label})`, () => {
      const hl = new HyperlogTransform(T, W, M, A);
      let maxRel = 0;
      for (const { s, value } of c.inverse) {
        maxRel = Math.max(
          maxRel,
          Math.abs(hl.unscale(s) - value) / Math.max(1, Math.abs(value)),
        );
      }
      expect(maxRel).toBeLessThan(1e-6);
    });
  }
});
