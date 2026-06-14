import { describe, expect, test } from "bun:test";
import { CustomTransform } from "../src/transforms/custom.ts";
import { absoluteConcentration, violin } from "../src/stats/summary.ts";

describe("CustomTransform", () => {
  test("applies a user forward/inverse pair and round-trips", () => {
    const t = new CustomTransform((x) => 2 * x + 1, (y) => (y - 1) / 2);
    expect(t.scale(3)).toBe(7);
    expect(t.unscale(t.scale(3))).toBeCloseTo(3, 12);
  });
});

describe("violin", () => {
  test("five-number summary + KDE silhouette", () => {
    const v = Array.from({ length: 101 }, (_, i) => i); // 0..100
    const data = violin(v, { bins: 64 });
    expect(data.min).toBe(0);
    expect(data.max).toBe(100);
    expect(data.median).toBeCloseTo(50, 0);
    expect(data.q1).toBeLessThan(data.median);
    expect(data.q3).toBeGreaterThan(data.median);
    // KDE integrates to ~1
    let area = 0;
    const dx = data.kde.x[1] - data.kde.x[0];
    for (let i = 1; i < data.kde.density.length; i++)
      area += ((data.kde.density[i] + data.kde.density[i - 1]) / 2) * dx;
    expect(area).toBeGreaterThan(0.85);
    expect(area).toBeLessThan(1.15);
  });
});

describe("absoluteConcentration", () => {
  test("bead-based cells/µL", () => {
    expect(absoluteConcentration(1000, 200, 1000)).toBe(5000);
    expect(absoluteConcentration(5, 0, 100)).toBe(0); // guard
  });
});
