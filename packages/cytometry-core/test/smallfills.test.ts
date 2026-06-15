import { describe, expect, test } from "bun:test";
import { detectDrift } from "../src/cleaning/drift.ts";
import { isolationForest } from "../src/cleaning/isolation.ts";
import { pmtNormalize } from "../src/compensation/pmt.ts";
import { EventMatrix } from "../src/matrix.ts";
import { trackPopulations } from "../src/multisample/track.ts";
import { enrichmentScore } from "../src/stats/summary.ts";
import { percentile } from "../src/stats/descriptive.ts";
import { flowJoBiex } from "../src/transforms/biexponential.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("isolationForest", () => {
  test("scores far outliers higher and excludes them from inliers", () => {
    const r = mulberry32(3);
    const n = 205;
    const m = EventMatrix.allocate(n, [{ name: "x" }, { name: "y" }]);
    const x = m.column(0);
    const y = m.column(1);
    for (let i = 0; i < 200; i++) {
      x[i] = uniform(r, -1, 1);
      y[i] = uniform(r, -1, 1);
    }
    const outliers = [200, 201, 202, 203, 204];
    for (const i of outliers) {
      x[i] = 50 + uniform(r, -1, 1);
      y[i] = 50 + uniform(r, -1, 1);
    }
    const res = isolationForest(m, { trees: 100, seed: 1, contamination: 0.05 });
    // outliers excluded from inliers
    let outlierInliers = 0;
    for (const i of outliers) if (res.inliers.get(i)) outlierInliers++;
    expect(outlierInliers).toBeLessThanOrEqual(1);
    // mean outlier score > mean cloud score
    let mo = 0;
    for (const i of outliers) mo += res.scores[i];
    mo /= outliers.length;
    let mc = 0;
    for (let i = 0; i < 200; i++) mc += res.scores[i];
    mc /= 200;
    expect(mo).toBeGreaterThan(mc);
  });
});

describe("detectDrift", () => {
  test("flags a drifting channel, not a stable one", () => {
    const n = 1000;
    const m = EventMatrix.allocate(n, [{ name: "drift" }, { name: "stable" }]);
    for (let e = 0; e < n; e++) {
      m.column(0)[e] = (e / n) * 100; // 0 -> 100
      m.column(1)[e] = 50;
    }
    const r = detectDrift(m, { bins: 40, threshold: 0.2 });
    expect(Math.abs(r.drift[0])).toBeGreaterThan(0.5);
    expect(r.flagged[0]).toBe(true);
    expect(r.flagged[1]).toBe(false);
  });
});

describe("pmtNormalize", () => {
  test("rescales a channel's median to the target", () => {
    const m = EventMatrix.allocate(5, [{ name: "c" }]);
    m.column(0).set([50, 100, 100, 100, 150]); // median 100
    pmtNormalize(m, { c: 200 });
    expect(percentile(Float64Array.from(m.column(0)).sort(), 50)).toBeCloseTo(200, 6);
  });
});

describe("flowJoBiex", () => {
  test("produces a valid biexponential that round-trips", () => {
    const t = flowJoBiex({ maxValue: 262144, positiveDecades: 4.5, widthBasis: -100 });
    expect(t.scale(262144)).toBeCloseTo(1, 6);
    for (const v of [-1000, 0, 100, 10000, 262144]) {
      expect(t.unscale(t.scale(v))).toBeCloseTo(v, 2);
    }
  });
});

describe("trackPopulations", () => {
  test("follows two clusters across three samples", () => {
    // 3 samples, 2 clusters near (0,0) and (10,10), order shuffled in sample 2.
    const s0 = [[0, 0], [10, 10]];
    const s1 = [[10.2, 9.8], [0.1, -0.1]]; // swapped order
    const s2 = [[0, 0.2], [9.9, 10.1]];
    const tracks = trackPopulations([s0, s1, s2]);
    expect(tracks).toHaveLength(2);
    for (const t of tracks) {
      expect(t).toHaveLength(3);
      expect(t.includes(-1)).toBe(false);
    }
    // track starting at cluster 0 (0,0) should land on the (0,0) cluster each sample
    const t0 = tracks[0];
    expect(t0[1]).toBe(1); // (0,0) is index 1 in s1
    expect(t0[2]).toBe(0); // (0,0) is index 0 in s2
  });
});

describe("enrichmentScore", () => {
  test("fold over-representation vs reference", () => {
    expect(enrichmentScore(50, 100, 10, 100)).toBeCloseTo(5, 9);
    expect(enrichmentScore(10, 100, 50, 100)).toBeCloseTo(0.2, 9);
  });
});
