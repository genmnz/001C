import { describe, expect, test } from "bun:test";
import { kmeans } from "../src/cluster/kmeans.ts";
import { spectralCluster } from "../src/cluster/spectral.ts";
import { mulberry32 } from "./helpers.ts";

/**
 * Two concentric rings: the inner (r≈1) and outer (r≈5) rings are not linearly
 * separable, so k-means slices them by angle and mixes the rings. Spectral
 * clustering follows the graph structure and recovers the two rings.
 */
function concentricRings(): { cols: number[][]; inner: number; total: number } {
  const rng = mulberry32(7);
  const xs: number[] = [];
  const ys: number[] = [];
  const perRing = 60;
  const push = (r: number) => {
    for (let i = 0; i < perRing; i++) {
      const a = (i / perRing) * 2 * Math.PI;
      xs.push(r * Math.cos(a) + (rng() - 0.5) * 0.15);
      ys.push(r * Math.sin(a) + (rng() - 0.5) * 0.15);
    }
  };
  push(1); // inner: indices [0, perRing)
  push(5); // outer: indices [perRing, 2*perRing)
  return { cols: [xs, ys], inner: perRing, total: 2 * perRing };
}

function purity(labels: Int32Array, inner: number, total: number): number {
  // Fraction of points whose label agrees with the majority label of their ring.
  const majority = (lo: number, hi: number): number => {
    const counts = new Map<number, number>();
    for (let i = lo; i < hi; i++)
      counts.set(labels[i], (counts.get(labels[i]) ?? 0) + 1);
    return Math.max(...counts.values());
  };
  return (majority(0, inner) + majority(inner, total)) / total;
}

describe("spectralCluster", () => {
  test("separates two concentric rings where k-means fails", () => {
    const { cols, inner, total } = concentricRings();

    const spec = spectralCluster(cols, 2, { k: 8, seed: 1 });
    expect(spec.labels.length).toBe(total);
    // Rings recovered near-perfectly.
    expect(purity(spec.labels, inner, total)).toBeGreaterThan(0.98);
    // Inner and outer rings get different labels.
    expect(spec.labels[0]).not.toBe(spec.labels[inner]);

    // Baseline: plain k-means cannot cleanly separate concentric rings.
    const km = kmeans(cols, 2, { seed: 1 });
    expect(purity(km.labels, inner, total)).toBeLessThan(0.9);
  });

  test("is deterministic for a fixed seed", () => {
    const { cols } = concentricRings();
    const a = spectralCluster(cols, 2, { k: 8, seed: 3 });
    const b = spectralCluster(cols, 2, { k: 8, seed: 3 });
    expect(Array.from(a.labels)).toEqual(Array.from(b.labels));
  });
});
