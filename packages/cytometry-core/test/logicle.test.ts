import { describe, expect, test } from "bun:test";
import {
  AsinhTransform,
  CofactorAsinhTransform,
  LinearTransform,
  LogTransform,
  LogicleTransform,
} from "../src/transforms/index.ts";

describe("LogicleTransform", () => {
  const T = 262144;
  const lg = new LogicleTransform(T, 0.5, 4.5, 0);

  test("analytic anchors: B(x1)=0 and B(1)=T", () => {
    // scale(0) must land at the internal breakpoint x1, and unscale(scale(0))=0.
    expect(lg.unscale(lg.scale(0))).toBeCloseTo(0, 6);
    // Top of scale: data value T maps to scale 1.
    expect(lg.scale(T)).toBeCloseTo(1, 9);
    expect(lg.unscale(1)).toBeCloseTo(T, 3);
  });

  test("round-trips unscale(scale(v)) == v across the dynamic range", () => {
    const values = [
      -5000, -1000, -200, -50, -10, -1, 0, 1, 10, 100, 1000, 10000, 100000, T,
    ];
    for (const v of values) {
      const back = lg.unscale(lg.scale(v));
      // Relative tolerance, with an absolute floor for values near zero.
      const tol = Math.max(1e-4, Math.abs(v) * 1e-5);
      expect(Math.abs(back - v)).toBeLessThan(tol);
    }
  });

  test("round-trips scale(unscale(x)) == x across display space", () => {
    for (let x = 0.02; x <= 1.0; x += 0.02) {
      expect(lg.scale(lg.unscale(x))).toBeCloseTo(x, 6);
    }
  });

  test("is strictly monotonically increasing", () => {
    let prev = -Infinity;
    for (let v = -10000; v <= T; v += 977) {
      const s = lg.scale(v);
      expect(s).toBeGreaterThan(prev);
      prev = s;
    }
  });

  test("maps positive data into (x1, ~1] and reflects negatives below x1", () => {
    const s0 = lg.scale(0);
    expect(lg.scale(1000)).toBeGreaterThan(s0);
    expect(lg.scale(-1000)).toBeLessThan(s0);
  });

  test("rejects out-of-range parameters", () => {
    expect(() => new LogicleTransform(0)).toThrow();
    expect(() => new LogicleTransform(T, -1)).toThrow();
    expect(() => new LogicleTransform(T, 3, 4.5)).toThrow(); // W > M/2
  });

  test("W=0 degenerates gracefully (logicle -> asinh-like) and round-trips", () => {
    const lg0 = new LogicleTransform(T, 0, 4.5, 0);
    for (const v of [-100, 0, 100, 10000, T]) {
      expect(lg0.unscale(lg0.scale(v))).toBeCloseTo(v, 2);
    }
  });
});

describe("LinearTransform", () => {
  const lin = new LinearTransform(262144, 0);
  test("round-trips and hits anchors", () => {
    expect(lin.scale(0)).toBe(0);
    expect(lin.scale(262144)).toBeCloseTo(1, 12);
    for (const v of [-1000, 0, 5, 131072, 262144]) {
      expect(lin.unscale(lin.scale(v))).toBeCloseTo(v, 6);
    }
  });
});

describe("LogTransform", () => {
  const log = new LogTransform(262144, 4.5);
  test("round-trips for positive values and clamps non-positive", () => {
    expect(log.scale(262144)).toBeCloseTo(1, 12);
    expect(log.scale(0)).toBe(0);
    expect(log.scale(-5)).toBe(0);
    for (const v of [1, 100, 10000, 262144]) {
      expect(log.unscale(log.scale(v))).toBeCloseTo(v, 3);
    }
  });
});

describe("AsinhTransform", () => {
  test("GatingML fasinh round-trips including negatives", () => {
    const t = new AsinhTransform(262144, 4.5, 0);
    for (const v of [-10000, -100, -1, 0, 1, 100, 10000, 262144]) {
      expect(t.unscale(t.scale(v))).toBeCloseTo(v, 2);
    }
  });
  test("cofactor asinh round-trips (CyTOF cofactor=5)", () => {
    const t = new CofactorAsinhTransform(5);
    expect(t.scale(0)).toBe(0);
    for (const v of [-50, -5, 0, 5, 50, 5000]) {
      expect(t.unscale(t.scale(v))).toBeCloseTo(v, 6);
    }
  });
});
