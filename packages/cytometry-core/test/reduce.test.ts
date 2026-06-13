import { describe, expect, test } from "bun:test";
import { jacobiEigen, pca } from "../src/reduce/pca.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("jacobiEigen", () => {
  test("diagonal matrix -> diagonal eigenvalues", () => {
    const { values } = jacobiEigen(Float64Array.from([3, 0, 0, 5]), 2);
    expect(values.slice().sort((a, b) => a - b)).toEqual([3, 5]);
  });
  test("[[2,1],[1,2]] -> eigenvalues 1 and 3, axes along (1,±1)", () => {
    const { values, vectors } = jacobiEigen(Float64Array.from([2, 1, 1, 2]), 2);
    const sorted = [...values].sort((a, b) => a - b);
    expect(sorted[0]).toBeCloseTo(1, 9);
    expect(sorted[1]).toBeCloseTo(3, 9);
    // eigenvectors are unit and orthogonal
    for (const v of vectors) {
      expect(Math.hypot(v[0], v[1])).toBeCloseTo(1, 9);
    }
    expect(vectors[0][0] * vectors[1][0] + vectors[0][1] * vectors[1][1]).toBeCloseTo(0, 9);
  });
});

describe("pca", () => {
  test("correlated 2D data -> PC1 along the (1,1) diagonal, high variance ratio", () => {
    const r = mulberry32(7);
    const n = 5000;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const t = uniform(r, -10, 10);
      x[i] = t + uniform(r, -0.3, 0.3);
      y[i] = t + uniform(r, -0.3, 0.3); // strongly correlated with x
    }
    const p = pca([x, y]);
    // PC1 direction ~ (±0.707, ±0.707), same sign (positive correlation)
    expect(Math.abs(Math.abs(p.components[0][0]) - Math.SQRT1_2)).toBeLessThan(0.05);
    expect(Math.abs(Math.abs(p.components[0][1]) - Math.SQRT1_2)).toBeLessThan(0.05);
    expect(p.components[0][0] * p.components[0][1]).toBeGreaterThan(0);
    // almost all variance on PC1
    expect(p.explainedVarianceRatio[0]).toBeGreaterThan(0.95);
    // projection of the mean is ~0
    expect(Math.abs(p.project(p.mean)[0])).toBeLessThan(1e-9);
  });
});
