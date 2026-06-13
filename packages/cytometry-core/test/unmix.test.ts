import { describe, expect, test } from "bun:test";
import { nnls, unmixMatrix, unmixOLS } from "../src/compensation/unmix.ts";
import {
  spilloverFromControls,
  spilloverFromMedians,
} from "../src/compensation/spillover.ts";
import { EventMatrix } from "../src/matrix.ts";

describe("spectral unmixing", () => {
  // 4 detectors, 2 fluorophores; known signatures.
  const M = [
    [1.0, 0.0],
    [0.8, 0.2],
    [0.2, 0.8],
    [0.0, 1.0],
  ];

  test("OLS recovers known abundances from a synthetic mixture", () => {
    const { P, f, d } = unmixMatrix(M);
    const aTrue = [3, 5];
    const x = M.map((row) => row[0] * aTrue[0] + row[1] * aTrue[1]);
    const a = unmixOLS(P, f, d, x);
    expect(a[0]).toBeCloseTo(3, 8);
    expect(a[1]).toBeCloseTo(5, 8);
  });

  test("NNLS recovers non-negative abundances and clamps negatives to 0", () => {
    const aTrue = [2, 4];
    const x = M.map((row) => row[0] * aTrue[0] + row[1] * aTrue[1]);
    const a = nnls(M, x);
    expect(a[0]).toBeCloseTo(2, 6);
    expect(a[1]).toBeCloseTo(4, 6);

    // A spectrum that OLS would fit with a negative coefficient -> NNLS clamps.
    const xNeg = [0, 0, 0, 5]; // pure fluor 2 with detector noise pushing fluor1<0
    const an = nnls(M, xNeg);
    expect(an[0]).toBeGreaterThanOrEqual(0);
    expect(an[1]).toBeGreaterThan(0);
  });
});

describe("spillover from controls", () => {
  test("spilloverFromMedians normalizes the diagonal to 1", () => {
    // control 0 stained for ch0 leaks 20% into ch1; control 1 leaks 10% into ch0.
    const medians = [
      [100, 20],
      [10, 100],
    ];
    const s = spilloverFromMedians(medians, ["c0", "c1"]);
    expect(Array.from(s.values)).toEqual([1, 0.2, 0.1, 1]);
  });

  test("spilloverFromControls measures medians from event matrices", () => {
    const ctrl0 = EventMatrix.allocate(3, [{ name: "A" }, { name: "B" }]);
    ctrl0.column(0).set([100, 100, 100]); // stained A
    ctrl0.column(1).set([20, 20, 20]); // 20% spill into B
    const ctrl1 = EventMatrix.allocate(3, [{ name: "A" }, { name: "B" }]);
    ctrl1.column(0).set([10, 10, 10]); // 10% spill into A
    ctrl1.column(1).set([100, 100, 100]); // stained B
    const s = spilloverFromControls(
      [
        { stainChannel: "A", matrix: ctrl0 },
        { stainChannel: "B", matrix: ctrl1 },
      ],
      ["A", "B"],
    );
    expect(s.values[0]).toBeCloseTo(1, 9);
    expect(s.values[1]).toBeCloseTo(0.2, 9);
    expect(s.values[2]).toBeCloseTo(0.1, 9);
    expect(s.values[3]).toBeCloseTo(1, 9);
  });
});
