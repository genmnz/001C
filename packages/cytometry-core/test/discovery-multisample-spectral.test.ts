import { describe, expect, test } from "bun:test";
import { isotopeCompensate } from "../src/cytof/spillover.ts";
import { appendAutofluorescence, unmixOLS, unmixMatrix, unmixWLS } from "../src/compensation/unmix.ts";
import { markerEnrichment, topMarkers } from "../src/discovery/enrichment.ts";
import { sampleSimilarity } from "../src/multisample/similarity.ts";

describe("markerEnrichment", () => {
  test("z-scores identify the defining marker of each cluster", () => {
    // marker0 high in cluster0, marker1 high in cluster1.
    const m0 = [10, 10, 0, 0];
    const m1 = [0, 0, 10, 10];
    const labels = [0, 0, 1, 1];
    const e = markerEnrichment([m0, m1], labels, 2);
    expect(e.z[0 * 2 + 0]).toBeGreaterThan(0.5); // cluster0 high marker0
    expect(e.z[0 * 2 + 1]).toBeLessThan(-0.5); // cluster0 low marker1
    expect(topMarkers(e, 1)[0][0]).toBe(0);
    expect(topMarkers(e, 1)[1][0]).toBe(1);
  });
});

describe("sampleSimilarity", () => {
  test("within-group samples are more similar than across-group", () => {
    // 2 clusters, 4 samples; group A (0,1) ~ [0.8,0.2], group B (2,3) ~ [0.2,0.8]
    const nClusters = 2;
    const nSamples = 4;
    const prop = new Float64Array(nClusters * nSamples);
    const set = (c: number, s: number, v: number) => (prop[c * nSamples + s] = v);
    set(0, 0, 0.8); set(1, 0, 0.2);
    set(0, 1, 0.78); set(1, 1, 0.22);
    set(0, 2, 0.2); set(1, 2, 0.8);
    set(0, 3, 0.22); set(1, 3, 0.78);
    const sim = sampleSimilarity(prop, nClusters, nSamples, "cosine");
    const within = sim[0 * nSamples + 1]; // A-A
    const across = sim[0 * nSamples + 2]; // A-B
    expect(within).toBeGreaterThan(across);
  });
});

describe("spectral unmixing WLS + autofluorescence", () => {
  const M = [
    [1.0, 0.0],
    [0.8, 0.2],
    [0.2, 0.8],
    [0.0, 1.0],
  ];
  test("WLS recovers known abundances (noiseless)", () => {
    const a = [3, 5];
    const x = M.map((r) => r[0] * a[0] + r[1] * a[1]);
    const est = unmixWLS(M, x);
    expect(est[0]).toBeCloseTo(3, 4);
    expect(est[1]).toBeCloseTo(5, 4);
  });
  test("autofluorescence column is recovered as its own abundance", () => {
    const af = [0.3, 0.5, 0.5, 0.3];
    const M2 = appendAutofluorescence(M, af); // d×3 now
    const a = [2, 4, 7]; // fluor1, fluor2, AF
    const x = M2.map((r) => r[0] * a[0] + r[1] * a[1] + r[2] * a[2]);
    const { P, f, d } = unmixMatrix(M2);
    const est = unmixOLS(P, f, d, x);
    expect(est[2]).toBeCloseTo(7, 4); // AF abundance
  });
});

describe("isotopeCompensate (NNLS)", () => {
  test("recovers non-negative true counts from a spillover-mixed signal", () => {
    // 3 channels, small isotope/oxide spill.
    const S = [
      [1.0, 0.02, 0.0],
      [0.05, 1.0, 0.03],
      [0.0, 0.04, 1.0],
    ];
    const trueC = [[100, 0], [0, 200], [50, 50]]; // per-channel columns for 2 events
    const cols = [new Float64Array(2), new Float64Array(2), new Float64Array(2)];
    for (let e = 0; e < 2; e++) {
      for (let i = 0; i < 3; i++) {
        let obs = 0;
        for (let j = 0; j < 3; j++) obs += S[i][j] * trueC[j][e];
        cols[i][e] = obs;
      }
    }
    const fixed = isotopeCompensate(S, cols);
    expect(fixed[0][0]).toBeCloseTo(100, 3);
    expect(fixed[1][1]).toBeCloseTo(200, 3);
    expect(fixed[2][0]).toBeCloseTo(50, 3);
    for (const c of fixed) for (const v of c) expect(v).toBeGreaterThanOrEqual(0);
  });
});
