import { describe, expect, test } from "bun:test";
import { invertSquare } from "../src/compensation/invert.ts";
import { applyCompensation } from "../src/compensation/apply.ts";
import { EventMatrix } from "../src/matrix.ts";

describe("invertSquare", () => {
  test("A * A^-1 == I for a known matrix", () => {
    const n = 3;
    // det = 3 (non-singular); chosen to exercise pivoting.
    const a = Float64Array.from([4, 3, 2, 1, 1, 1, 3, 2, 4]);
    const inv = invertSquare(a, n);
    // Multiply a*inv and check identity.
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        let acc = 0;
        for (let k = 0; k < n; k++) acc += a[i * n + k] * inv[k * n + j];
        expect(acc).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
  });

  test("throws on a singular matrix", () => {
    // Rows 2 and 3 are linearly dependent.
    const a = Float64Array.from([1, 2, 3, 2, 4, 6, 7, 8, 9]);
    expect(() => invertSquare(a, 3)).toThrow(/singular/);
  });
});

describe("applyCompensation", () => {
  test("un-mixes a known 2-channel spillover (flowutils convention)", () => {
    // Convention matches flowutils/FlowJo: compensated = inv(S^T) · observed,
    // so observed = S^T · true. Seed OBSERVED and expect recovery of TRUE.
    const channels = [{ name: "A" }, { name: "B" }];
    const m = EventMatrix.allocate(2, channels);
    const trueA = [100, 0];
    const trueB = [0, 100];
    const S = [
      [1.0, 0.2],
      [0.1, 1.0],
    ];
    // observed_i = sum_j S^T[i][j] * true_j = sum_j S[j][i] * true_j
    const colA = m.column(0);
    const colB = m.column(1);
    for (let e = 0; e < 2; e++) {
      colA[e] = S[0][0] * trueA[e] + S[1][0] * trueB[e];
      colB[e] = S[0][1] * trueA[e] + S[1][1] * trueB[e];
    }
    applyCompensation(m, {
      channels: ["A", "B"],
      values: Float64Array.from([1.0, 0.2, 0.1, 1.0]),
    });
    expect(colA[0]).toBeCloseTo(100, 4);
    expect(colB[0]).toBeCloseTo(0, 4);
    expect(colA[1]).toBeCloseTo(0, 4);
    expect(colB[1]).toBeCloseTo(100, 4);
  });
});
