import { describe, expect, test } from "bun:test";
import { isomap } from "../src/reduce/isomap.ts";
import { mds } from "../src/reduce/mds.ts";
import { mulberry32 } from "./helpers.ts";

/** |Pearson correlation| between two equal-length series. */
function absCorr(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  return Math.abs(cov / (Math.sqrt(va * vb) || 1));
}

/**
 * A three-quarter-circle arc in 2D: the two ends are close in Euclidean space
 * but far along the manifold. Isomap follows the arc, so its 1D coordinate
 * recovers the arc-length parameter; classical MDS (Euclidean) folds the ends
 * together and loses the ordering.
 */
function arc(): { cols: number[][]; t: number[] } {
  const rng = mulberry32(11);
  const xs: number[] = [];
  const ys: number[] = [];
  const t: number[] = [];
  const n = 80;
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1)) * 1.5 * Math.PI; // 0 .. 270°
    xs.push(Math.cos(a) + (rng() - 0.5) * 0.05);
    ys.push(Math.sin(a) + (rng() - 0.5) * 0.05);
    t.push(a);
  }
  return { cols: [xs, ys], t };
}

describe("isomap", () => {
  test("recovers geodesic (arc-length) ordering of a curved manifold", () => {
    const { cols, t } = arc();
    const emb = isomap(cols, { dims: 1, k: 5 });
    const coord = emb.map((p) => p[0]);
    // The 1D embedding is monotonic in the arc parameter (up to a sign flip).
    expect(absCorr(coord, t)).toBeGreaterThan(0.98);
  });

  test("beats classical MDS at preserving the manifold ordering", () => {
    const { cols, t } = arc();
    const iso = isomap(cols, { dims: 1, k: 5 }).map((p) => p[0]);
    const euc = mds(cols, { dims: 1 }).map((p) => p[0]);
    expect(absCorr(iso, t)).toBeGreaterThan(absCorr(euc, t));
  });

  test("returns one coordinate vector per input point", () => {
    const { cols } = arc();
    const emb = isomap(cols, { dims: 2, k: 6 });
    expect(emb.length).toBe(cols[0].length);
    expect(emb[0].length).toBe(2);
  });
});
