import { describe, expect, test } from "bun:test";
import { benjaminiHochberg } from "../src/stats/comparative.ts";
import { clusterAbundance, differentialAbundance } from "../src/diff/abundance.ts";
import { cytoNormApply, cytoNormTrain } from "../src/normalize/cytonorm.ts";
import { percentile } from "../src/stats/descriptive.ts";
import { mulberry32 } from "./helpers.ts";

function gauss(r: () => number, mean: number, sd: number): number {
  const u = Math.max(1e-9, r());
  const v = r();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

describe("benjaminiHochberg", () => {
  test("controls FDR; one tiny p stays significant, the rest do not", () => {
    const q = benjaminiHochberg([0.001, 0.5, 0.6, 0.7]);
    expect(q[0]).toBeLessThan(0.05);
    expect(q[1]).toBeGreaterThan(0.1);
    expect(Math.max(...q)).toBeLessThanOrEqual(1);
  });
});

describe("differential abundance", () => {
  test("flags the cluster whose proportion differs between groups", () => {
    // 3 clusters, 6 samples (0-2 group A, 3-5 group B). Cluster 0 enriched in B.
    const nClusters = 3;
    const nSamples = 6;
    const proportions = new Float64Array(nClusters * nSamples);
    const set = (c: number, s: number, v: number) => (proportions[c * nSamples + s] = v);
    // cluster 0: A low (~0.1), B high (~0.4)
    [0.10, 0.12, 0.09].forEach((v, s) => set(0, s, v));
    [0.40, 0.38, 0.42].forEach((v, s) => set(0, s + 3, v));
    // clusters 1,2: same in both groups
    for (let s = 0; s < 6; s++) {
      set(1, s, 0.3);
      set(2, s, 0.6 - proportions[0 * nSamples + s] - 0.3);
    }
    const rows = differentialAbundance(proportions, nClusters, nSamples, [0, 1, 2], [3, 4, 5]);
    const c0 = rows.find((r) => r.cluster === 0)!;
    expect(c0.meanB).toBeGreaterThan(c0.meanA);
    expect(c0.q).toBeLessThan(0.2);
    expect(rows.find((r) => r.cluster === 1)!.q).toBeGreaterThan(0.2);
  });

  test("clusterAbundance builds count + proportion matrices", () => {
    // 4 events: sample 0 has clusters [0,1]; sample 1 has [0,0]
    const labels = [0, 1, 0, 0];
    const sampleOf = [0, 0, 1, 1];
    const { counts, proportions } = clusterAbundance(labels, sampleOf, 2, 2);
    expect(counts[0 * 2 + 0]).toBe(1); // cluster0, sample0
    expect(counts[0 * 2 + 1]).toBe(2); // cluster0, sample1
    expect(proportions[0 * 2 + 1]).toBeCloseTo(1, 9); // sample1 all cluster0
  });
});

describe("CytoNorm", () => {
  test("aligns two batches with a shifted marker to a common goal", () => {
    const r = mulberry32(5);
    const n = 1000;
    const mk = (mean: number) => {
      const col = new Float64Array(n);
      for (let i = 0; i < n; i++) col[i] = gauss(r, mean, 1);
      return col;
    };
    const a = mk(10);
    const b = mk(15); // batch B shifted +5
    const clusterOf = new Int32Array(n); // single cluster
    const samples = [
      { batchId: "A", clusterOf, columns: [a], eventCount: n },
      { batchId: "B", clusterOf, columns: [b], eventCount: n },
    ];
    const model = cytoNormTrain(samples, [0], 1, 101);
    const na = cytoNormApply(model, samples[0])[0];
    const nb = cytoNormApply(model, samples[1])[0];
    const medA = percentile(Float64Array.from(na).sort(), 50);
    const medB = percentile(Float64Array.from(nb).sort(), 50);
    // both map to the goal (~12.5) and to each other
    expect(Math.abs(medA - medB)).toBeLessThan(0.5);
    expect(medA).toBeGreaterThan(11.5);
    expect(medA).toBeLessThan(13.5);
  });
});
