import { describe, expect, test } from "bun:test";
import { knn } from "../src/graph/knn.ts";
import { louvain, modularity, type WeightedGraph } from "../src/graph/louvain.ts";

describe("knn", () => {
  test("finds the nearest neighbors of points on a line", () => {
    // points at x = 0,1,2,10,11,12 (1-D)
    const x = [0, 1, 2, 10, 11, 12];
    const r = knn([x], 2);
    // nearest of point 0 (x=0) should be point 1 (x=1) then 2.
    expect(r.indices[0]).toBe(1);
    expect(r.distances[0]).toBeCloseTo(1, 9);
    // nearest of point 3 (x=10) should be 4 (x=11).
    expect(r.indices[3 * 2]).toBe(4);
  });
});

describe("louvain", () => {
  test("splits two cliques joined by a weak edge into two communities", () => {
    // nodes 0-4 clique, nodes 5-9 clique, one weak bridge 4-5.
    const edges: [number, number, number][] = [];
    const clique = (base: number) => {
      for (let i = 0; i < 5; i++)
        for (let j = i + 1; j < 5; j++) edges.push([base + i, base + j, 1]);
    };
    clique(0);
    clique(5);
    edges.push([4, 5, 0.05]); // weak bridge
    const g: WeightedGraph = { n: 10, edges };
    const labels = louvain(g, { resolution: 1 });
    // two communities, matching the cliques
    const a = labels[0];
    const b = labels[5];
    expect(a).not.toBe(b);
    for (let i = 0; i < 5; i++) expect(labels[i]).toBe(a);
    for (let i = 5; i < 10; i++) expect(labels[i]).toBe(b);
    expect(modularity(g, labels)).toBeGreaterThan(0.3);
  });

  test("a single clique stays one community", () => {
    const edges: [number, number, number][] = [];
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++) edges.push([i, j, 1]);
    const labels = louvain({ n: 6, edges });
    const set = new Set(Array.from(labels));
    expect(set.size).toBe(1);
  });
});
