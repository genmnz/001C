import { describe, expect, test } from "bun:test";
import { knn } from "../src/graph/knn.ts";
import { leiden } from "../src/graph/leiden.ts";
import { louvain, modularity, type WeightedGraph } from "../src/graph/louvain.ts";

/** True iff every community in `labels` induces a connected subgraph of `g`. */
function allCommunitiesConnected(g: WeightedGraph, labels: Int32Array): boolean {
  const nbr: number[][] = Array.from({ length: g.n }, () => []);
  for (const [u, v] of g.edges) {
    if (u === v) continue;
    nbr[u].push(v);
    nbr[v].push(u);
  }
  const byComm = new Map<number, number[]>();
  for (let i = 0; i < g.n; i++) {
    const c = labels[i];
    (byComm.get(c) ?? byComm.set(c, []).get(c)!).push(i);
  }
  for (const members of byComm.values()) {
    const set = new Set(members);
    const seen = new Set<number>([members[0]]);
    const stack = [members[0]];
    while (stack.length) {
      const u = stack.pop()!;
      for (const v of nbr[u]) {
        if (set.has(v) && !seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }
    if (seen.size !== members.length) return false;
  }
  return true;
}

function ringOfCliques(cliques: number, size: number): WeightedGraph {
  const edges: [number, number, number][] = [];
  for (let c = 0; c < cliques; c++) {
    const base = c * size;
    for (let i = 0; i < size; i++)
      for (let j = i + 1; j < size; j++) edges.push([base + i, base + j, 1]);
    // Weak bridge to the next clique (ring).
    const next = ((c + 1) % cliques) * size;
    edges.push([Math.min(base, next), Math.max(base, next), 0.05]);
  }
  return { n: cliques * size, edges };
}

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

describe("leiden", () => {
  test("splits two weakly-bridged cliques into two communities", () => {
    const edges: [number, number, number][] = [];
    const clique = (base: number) => {
      for (let i = 0; i < 5; i++)
        for (let j = i + 1; j < 5; j++) edges.push([base + i, base + j, 1]);
    };
    clique(0);
    clique(5);
    edges.push([4, 5, 0.05]);
    const g: WeightedGraph = { n: 10, edges };
    const labels = leiden(g, { resolution: 1 });
    expect(labels[0]).not.toBe(labels[5]);
    for (let i = 0; i < 5; i++) expect(labels[i]).toBe(labels[0]);
    for (let i = 5; i < 10; i++) expect(labels[i]).toBe(labels[5]);
  });

  test("recovers each clique in a ring of cliques; communities are connected", () => {
    const g = ringOfCliques(4, 6);
    const labels = leiden(g, { resolution: 1 });
    expect(new Set(Array.from(labels)).size).toBe(4);
    // Each clique maps to one community.
    for (let c = 0; c < 4; c++)
      for (let i = 1; i < 6; i++)
        expect(labels[c * 6 + i]).toBe(labels[c * 6]);
    expect(allCommunitiesConnected(g, labels)).toBe(true);
  });

  test("matches or beats Louvain modularity on the ring of cliques", () => {
    const g = ringOfCliques(5, 5);
    const ml = modularity(g, leiden(g));
    const mv = modularity(g, louvain(g));
    expect(ml).toBeGreaterThan(0.5);
    expect(ml).toBeGreaterThanOrEqual(mv - 1e-9);
    expect(allCommunitiesConnected(g, leiden(g))).toBe(true);
  });

  test("a single clique stays one connected community", () => {
    const edges: [number, number, number][] = [];
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++) edges.push([i, j, 1]);
    const g: WeightedGraph = { n: 6, edges };
    const labels = leiden(g);
    expect(new Set(Array.from(labels)).size).toBe(1);
    expect(allCommunitiesConnected(g, labels)).toBe(true);
  });
});
