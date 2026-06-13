import { describe, expect, test } from "bun:test";
import { Population } from "../src/population.ts";
import {
  coExpression,
  differentialAbundance,
  foldChange,
  log2FoldChange,
  mannWhitneyU,
  markerPositivity,
  shannonDiversity,
  simpsonDiversity,
} from "../src/stats/comparative.ts";

describe("fold change", () => {
  test("ratio and log2", () => {
    expect(foldChange(10, 5)).toBe(2);
    expect(log2FoldChange(10, 5)).toBeCloseTo(1, 12);
    expect(foldChange(5, 0)).toBe(Infinity);
    expect(foldChange(0, 0)).toBe(1);
  });
});

describe("positivity & co-expression", () => {
  const pop = Population.all(4);
  test("markerPositivity counts strictly above threshold", () => {
    expect(markerPositivity(pop, [1, 2, 3, 4], 2)).toBeCloseTo(0.5, 12); // 3,4
  });
  test("coExpression quadrants", () => {
    const a = [1, 5, 5, 0];
    const b = [5, 5, 0, 0];
    const r = coExpression(pop, a, 2, b, 2);
    expect(r.bothPositive).toBe(1); // index 1
    expect(r.aOnly).toBe(1); // index 2
    expect(r.bOnly).toBe(1); // index 0
    expect(r.neither).toBe(1); // index 3
    expect(r.doublePositiveFraction).toBeCloseTo(0.25, 12);
  });
});

describe("diversity", () => {
  test("Shannon: uniform = ln(k), single population = 0", () => {
    expect(shannonDiversity([10, 10])).toBeCloseTo(Math.log(2), 10);
    expect(shannonDiversity([10, 0, 0])).toBeCloseTo(0, 12);
  });
  test("Simpson in [0,1)", () => {
    expect(simpsonDiversity([10, 0])).toBeCloseTo(0, 12);
    expect(simpsonDiversity([5, 5])).toBeCloseTo(0.5, 12);
  });
});

describe("Mann–Whitney U", () => {
  test("textbook interleaved example U=3", () => {
    expect(mannWhitneyU([1, 3, 5], [2, 4, 6]).U).toBe(3);
  });
  test("fully separated groups: U=0, small p", () => {
    const r = mannWhitneyU([1, 2, 3, 4, 5], [10, 11, 12, 13, 14]);
    expect(r.U).toBe(0);
    expect(r.p).toBeLessThan(0.05);
  });
  test("identical groups: large p", () => {
    const r = mannWhitneyU([1, 2, 3, 4], [1, 2, 3, 4]);
    expect(r.p).toBeGreaterThan(0.5);
  });
});

describe("differential abundance", () => {
  test("separated group frequencies -> negative log2FC, small p", () => {
    const da = differentialAbundance([0.01, 0.02, 0.015], [0.2, 0.25, 0.22]);
    expect(da.meanA).toBeLessThan(da.meanB);
    expect(da.log2FC).toBeLessThan(0);
    expect(da.p).toBeLessThan(0.1);
  });
});
