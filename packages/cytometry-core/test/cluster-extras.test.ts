import { describe, expect, test } from "bun:test";
import { consensusCluster } from "../src/cluster/consensus.ts";
import { labelsToPopulations } from "../src/cluster/labels.ts";
import { flowCutQC } from "../src/cleaning/qc.ts";
import { EventMatrix } from "../src/matrix.ts";
import { matchPopulations } from "../src/multisample/match.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("labelsToPopulations", () => {
  test("converts cluster labels into gateable populations", () => {
    const pops = labelsToPopulations([0, 1, 0, 2], 4);
    expect(pops).toHaveLength(3);
    expect(Array.from(pops[0].toMask())).toEqual([1, 0, 1, 0]);
    expect(pops[1].count()).toBe(1);
    expect(pops[2].get(3)).toBe(true);
  });
  test("noise (-1) is skipped; eventIndex maps to original indices", () => {
    const pops = labelsToPopulations([0, -1, 1], 10, { eventIndex: [5, 6, 7], nClusters: 2 });
    expect(pops[0].get(5)).toBe(true);
    expect(pops[1].get(7)).toBe(true);
    expect(pops[0].count() + pops[1].count()).toBe(2); // noise dropped
  });
});

describe("flowCutQC", () => {
  test("removes a contiguous anomalous acquisition block", () => {
    const r = mulberry32(1);
    const n = 1000;
    const m = EventMatrix.allocate(n, [{ name: "v" }]);
    const col = m.column(0);
    for (let e = 0; e < n; e++) col[e] = 10 + uniform(r, -0.5, 0.5);
    for (let e = 500; e < 560; e++) col[e] = 100; // clog
    const keep = flowCutQC(m, { bins: 50, madThreshold: 4 });
    expect(keep.get(520)).toBe(false); // anomalous block dropped
    expect(keep.get(100)).toBe(true); // normal kept
    expect(keep.count()).toBeGreaterThan(900);
    expect(keep.count()).toBeLessThan(n);
  });
});

describe("consensusCluster", () => {
  test("recovers separated blobs with pure stable clusters", () => {
    const r = mulberry32(7);
    const per = 40;
    const centers = [
      [0, 0],
      [20, 0],
      [0, 20],
    ];
    const x = new Float64Array(per * 3);
    const y = new Float64Array(per * 3);
    for (let c = 0; c < 3; c++)
      for (let i = 0; i < per; i++) {
        const k = c * per + i;
        x[k] = centers[c][0] + uniform(r, -1.5, 1.5);
        y[k] = centers[c][1] + uniform(r, -1.5, 1.5);
      }
    const { labels } = consensusCluster([x, y], 3, { runs: 15, seed: 2 });
    for (let c = 0; c < 3; c++) {
      const lbl = labels[c * per];
      for (let i = 1; i < per; i++) expect(labels[c * per + i]).toBe(lbl);
    }
    expect(new Set([labels[0], labels[per], labels[2 * per]]).size).toBe(3);
  });
});

describe("matchPopulations", () => {
  test("matches permuted centroids by nearest", () => {
    const A = [
      [0, 0],
      [10, 10],
      [20, 0],
    ];
    const B = [
      [10, 10],
      [20, 0],
      [0, 0],
    ];
    expect(matchPopulations(A, B)).toEqual([2, 0, 1]);
  });
});
