import { describe, expect, test } from "bun:test";
import { flowSOM } from "../src/cluster/flowsom.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("flowSOM", () => {
  // Three well-separated 4-D blobs; events [0,per) [per,2per) [2per,3per).
  const r = mulberry32(2025);
  const per = 600;
  const d = 4;
  const centers = [
    [0, 0, 0, 0],
    [20, 20, 0, 0],
    [0, 0, 20, 20],
  ];
  const cols: Float64Array[] = Array.from({ length: d }, () => new Float64Array(per * 3));
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < per; i++) {
      const k = c * per + i;
      for (let j = 0; j < d; j++) cols[j][k] = centers[c][j] + uniform(r, -2, 2);
    }
  }

  test("metaclusters recover the three blobs with high purity", () => {
    const res = flowSOM(cols, { xdim: 6, ydim: 6, metaclusters: 3, epochs: 20, seed: 7 });
    expect(res.nodes.length).toBe(36);
    expect(res.eventMeta.length).toBe(per * 3);
    expect(res.mst.length).toBe(36 - 1); // spanning tree over nodes

    // Per-blob dominant metacluster + purity.
    const dominant: number[] = [];
    let totalCorrect = 0;
    for (let c = 0; c < 3; c++) {
      const counts = new Map<number, number>();
      for (let i = 0; i < per; i++) {
        const m = res.eventMeta[c * per + i];
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
      let bestM = -1;
      let bestN = 0;
      for (const [m, cnt] of counts) if (cnt > bestN) ((bestN = cnt), (bestM = m));
      dominant.push(bestM);
      totalCorrect += bestN;
    }
    // Three blobs map to three distinct metaclusters...
    expect(new Set(dominant).size).toBe(3);
    // ...with high purity overall.
    expect(totalCorrect / (per * 3)).toBeGreaterThan(0.9);
  });

  test("is deterministic for a fixed seed", () => {
    const a = flowSOM(cols, { xdim: 5, ydim: 5, metaclusters: 3, epochs: 10, seed: 3 });
    const b = flowSOM(cols, { xdim: 5, ydim: 5, metaclusters: 3, epochs: 10, seed: 3 });
    expect(Array.from(a.eventMeta)).toEqual(Array.from(b.eventMeta));
  });
});
