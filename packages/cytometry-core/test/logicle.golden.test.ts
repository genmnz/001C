import { describe, expect, test } from "bun:test";
import { LogicleTransform } from "../src/transforms/logicle.ts";
import golden from "./golden/logicle.golden.json";

/**
 * EXTERNAL-ORACLE validation. The golden values in logicle.golden.json are
 * produced by flowutils (the FlowKit logicle C extension, derived from the Moore
 * & Parks 2012 Stanford reference) — see scripts/golden/gen_logicle_golden.py.
 * Round-trip + anchor tests prove self-consistency; THIS test proves the joeee
 * port agrees with the canonical implementation it did not derive from.
 *
 * Regenerate: see docs/VALIDATION.md.
 */
describe("LogicleTransform vs flowutils golden values", () => {
  test("golden file came from the flowutils oracle", () => {
    expect(golden.provenance.oracle).toBe("flowutils");
    expect(golden.cases.length).toBeGreaterThan(0);
  });

  for (const c of golden.cases) {
    const { T, W, M, A } = c.params;
    const label = `T=${T} W=${W} M=${M} A=${A}`;

    test(`forward scale() matches oracle (${label})`, () => {
      const lg = new LogicleTransform(T, W, M, A);
      let maxErr = 0;
      for (const { x, scale } of c.forward) {
        const got = lg.scale(x);
        maxErr = Math.max(maxErr, Math.abs(got - scale));
      }
      // Scale space is ~[-0.5, 1.5]; the oracle agreement is near machine eps.
      expect(maxErr).toBeLessThan(1e-9);
    });

    test(`inverse unscale() matches oracle (${label})`, () => {
      const lg = new LogicleTransform(T, W, M, A);
      let maxRel = 0;
      for (const { s, value } of c.inverse) {
        const got = lg.unscale(s);
        const denom = Math.max(1, Math.abs(value));
        maxRel = Math.max(maxRel, Math.abs(got - value) / denom);
      }
      expect(maxRel).toBeLessThan(1e-6);
    });
  }
});
