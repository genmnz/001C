import { describe, expect, test } from "bun:test";
import { phenograph } from "../src/cluster/phenograph.ts";
import { umap } from "../src/reduce/umap.ts";
import { mulberry32, uniform } from "./helpers.ts";

// Three separated 4-D blobs.
function blobs(seed: number, per = 150) {
  const r = mulberry32(seed);
  const d = 4;
  const centers = [
    [0, 0, 0, 0],
    [15, 15, 0, 0],
    [0, 0, 15, 15],
  ];
  const cols: Float64Array[] = Array.from({ length: d }, () => new Float64Array(per * 3));
  const label = new Int32Array(per * 3);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < per; i++) {
      const k = c * per + i;
      label[k] = c;
      for (let j = 0; j < d; j++) cols[j][k] = centers[c][j] + uniform(r, -1.5, 1.5);
    }
  }
  return { cols, label, per };
}

describe("phenograph", () => {
  test("communities never span blobs (PhenoGraph may over-segment)", () => {
    const { cols, label, per } = blobs(1);
    const res = phenograph(cols, { k: 30 });
    // PhenoGraph famously finds fine structure -> >= the true 3, possibly more.
    expect(res.clusterCount).toBeGreaterThanOrEqual(3);
    expect(res.modularity).toBeGreaterThan(0.3);

    // The real correctness criterion: every community is dominated by ONE blob
    // (no community mixes blobs). Overall purity = sum of per-community majorities.
    const byComm = new Map<number, Map<number, number>>();
    for (let i = 0; i < per * 3; i++) {
      const c = res.labels[i];
      const m = byComm.get(c) ?? new Map<number, number>();
      m.set(label[i], (m.get(label[i]) ?? 0) + 1);
      byComm.set(c, m);
    }
    let correct = 0;
    for (const counts of byComm.values()) correct += Math.max(...counts.values());
    expect(correct / (per * 3)).toBeGreaterThan(0.98);
  });
});

describe("umap", () => {
  test("preserves cluster structure (nearest embedded neighbor shares the blob)", () => {
    const { cols, label } = blobs(2, 120);
    const Y = umap(cols, { nNeighbors: 15, epochs: 200, seed: 4 });
    let agree = 0;
    for (let i = 0; i < Y.length; i++) {
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < Y.length; j++) {
        if (i === j) continue;
        const dx = Y[i][0] - Y[j][0];
        const dy = Y[i][1] - Y[j][1];
        const dd = dx * dx + dy * dy;
        if (dd < bestD) {
          bestD = dd;
          best = j;
        }
      }
      if (label[best] === label[i]) agree++;
    }
    expect(agree / Y.length).toBeGreaterThan(0.85);
  });
});
