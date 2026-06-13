import { describe, expect, test } from "bun:test";
import { applyCompensation } from "../src/compensation/apply.ts";
import { EventMatrix } from "../src/matrix.ts";
import golden from "./golden/compensation.golden.json";

/**
 * External-oracle validation of compensation against flowutils
 * (flowutils.compensate, i.e. solve(S^T, observed)). This is the test that
 * pins down the spillover convention — applying inv(S) instead of inv(S^T) is
 * the classic compensation bug and would fail here.
 */
describe("applyCompensation vs flowutils oracle", () => {
  test("golden file came from the flowutils oracle", () => {
    expect(golden.provenance.oracle).toBe("flowutils");
  });

  for (let ci = 0; ci < golden.cases.length; ci++) {
    const c = golden.cases[ci];
    test(`un-mixes to match the oracle (case ${ci})`, () => {
      const channels = c.channels.map((name) => ({ name }));
      const n = c.observed.length;
      const m = EventMatrix.allocate(n, channels);
      for (let ch = 0; ch < channels.length; ch++) {
        m.column(ch).set(c.observed.map((row) => row[ch]));
      }
      applyCompensation(m, {
        channels: c.channels,
        values: Float64Array.from(c.spill),
      });
      let maxRel = 0;
      for (let e = 0; e < n; e++) {
        for (let ch = 0; ch < channels.length; ch++) {
          const got = m.value(e, ch);
          const exp = c.compensated[e][ch];
          maxRel = Math.max(maxRel, Math.abs(got - exp) / Math.max(1, Math.abs(exp)));
        }
      }
      expect(maxRel).toBeLessThan(1e-6);
    });
  }
});
