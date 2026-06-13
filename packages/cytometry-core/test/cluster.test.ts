import { describe, expect, test } from "bun:test";
import { kmeans } from "../src/cluster/kmeans.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("kmeans", () => {
  // Three well-separated 2D blobs; indices [0,nA) [nA,2nA) [2nA,3nA).
  const r = mulberry32(99);
  const per = 400;
  const centers = [
    [0, 0],
    [20, 20],
    [40, 0],
  ];
  const x = new Float64Array(per * 3);
  const y = new Float64Array(per * 3);
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < per; i++) {
      const k = c * per + i;
      x[k] = centers[c][0] + uniform(r, -2, 2);
      y[k] = centers[c][1] + uniform(r, -2, 2);
    }
  }

  test("recovers 3 pure clusters with centroids near the true centers", () => {
    const res = kmeans([x, y], 3, { seed: 1 });
    expect(res.centroids.length).toBe(3);

    // Each blob's points must share a single label.
    for (let c = 0; c < 3; c++) {
      const base = c * per;
      const label = res.labels[base];
      for (let i = 1; i < per; i++) {
        expect(res.labels[base + i]).toBe(label);
      }
    }
    // The three blob labels are distinct.
    const labelsByBlob = [0, 1, 2].map((c) => res.labels[c * per]);
    expect(new Set(labelsByBlob).size).toBe(3);

    // Every true center has a centroid within distance 2.
    for (const ctr of centers) {
      const near = res.centroids.some(
        (cd) => Math.hypot(cd[0] - ctr[0], cd[1] - ctr[1]) < 2,
      );
      expect(near).toBe(true);
    }
  });

  test("is deterministic for a fixed seed", () => {
    const a = kmeans([x, y], 3, { seed: 42 });
    const b = kmeans([x, y], 3, { seed: 42 });
    expect(Array.from(a.labels)).toEqual(Array.from(b.labels));
    expect(a.inertia).toBeCloseTo(b.inertia, 9);
  });
});
