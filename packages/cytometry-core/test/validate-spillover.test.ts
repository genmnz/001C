import { describe, expect, test } from "bun:test";
import { validateSpillover } from "../src/compensation/validate.ts";

const spill = (channels: string[], values: number[]) => ({
  channels,
  values: Float64Array.from(values),
});

describe("validateSpillover", () => {
  test("accepts a normalized, invertible matrix with no issues", () => {
    const r = validateSpillover(spill(["A", "B"], [1, 0.2, 0.1, 1]));
    expect(r.valid).toBe(true);
    expect(r.issues).toEqual([]);
  });

  test("rejects a values/channels² length mismatch", () => {
    const r = validateSpillover(spill(["A", "B"], [1, 0.2, 0.1]));
    expect(r.valid).toBe(false);
    expect(r.issues[0].severity).toBe("error");
    expect(r.issues[0].message).toMatch(/≠/);
  });

  test("rejects an empty matrix", () => {
    const r = validateSpillover(spill([], []));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /no channels/.test(i.message))).toBe(true);
  });

  test("rejects duplicate channel names", () => {
    const r = validateSpillover(spill(["A", "A"], [1, 0.2, 0.1, 1]));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /duplicate/.test(i.message))).toBe(true);
  });

  test("rejects non-finite entries", () => {
    const r = validateSpillover(spill(["A", "B"], [1, NaN, 0.1, 1]));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /non-finite/.test(i.message))).toBe(true);
  });

  test("rejects a zero on the diagonal", () => {
    const r = validateSpillover(spill(["A", "B"], [0, 0.1, 0.1, 1]));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /diagonal/.test(i.message))).toBe(true);
  });

  test("rejects a singular matrix", () => {
    const r = validateSpillover(spill(["A", "B"], [1, 1, 1, 1]));
    expect(r.valid).toBe(false);
    expect(r.issues.some((i) => /singular/.test(i.message))).toBe(true);
  });

  test("warns (but stays valid) on an unnormalized diagonal", () => {
    const r = validateSpillover(spill(["A", "B"], [0.9, 0.2, 0.1, 1.1]));
    expect(r.valid).toBe(true);
    expect(r.issues.length).toBe(2);
    expect(r.issues.every((i) => i.severity === "warning")).toBe(true);
  });

  test("warns (but stays valid) on negative off-diagonal spill", () => {
    const r = validateSpillover(spill(["A", "B"], [1, -0.2, 0.1, 1]));
    expect(r.valid).toBe(true);
    expect(r.issues.length).toBe(1);
    expect(r.issues[0].severity).toBe("warning");
    expect(r.issues[0].message).toMatch(/negative/);
  });
});
