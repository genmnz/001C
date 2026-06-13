import { describe, expect, test } from "bun:test";
import { LogicleTransform, LinearTransform } from "@joeee/cytometry-core";
import { axisTicks } from "../src/axis/ticks.ts";

describe("axisTicks", () => {
  test("logicle axis includes 0 and positive decades, positions increasing", () => {
    const t = new LogicleTransform(262144, 0.5, 4.5, 0);
    const ticks = axisTicks(t, {
      dataMin: -1000,
      dataMax: 262144,
      pxStart: 0,
      pxEnd: 500,
      minorTicks: false,
    });
    const majors = ticks.filter((tk) => tk.major).map((tk) => tk.value);
    expect(majors).toContain(0);
    expect(majors).toContain(100);
    expect(majors).toContain(1000);
    expect(majors).toContain(100000);
    // px strictly increasing with value (monotone transform).
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i].px).toBeGreaterThan(ticks[i - 1].px);
    }
    // 0 sits inside the axis, not at an edge (the linear region).
    const zero = ticks.find((tk) => tk.value === 0)!;
    expect(zero.px).toBeGreaterThan(0);
    expect(zero.px).toBeLessThan(500);
  });

  test("labels use 10^k notation; minor ticks unlabeled", () => {
    const t = new LogicleTransform(262144, 0.5, 4.5, 0);
    const ticks = axisTicks(t, { dataMin: 0, dataMax: 100000, pxStart: 0, pxEnd: 100 });
    const k3 = ticks.find((tk) => tk.value === 1000)!;
    expect(k3.label).toBe("10³");
    expect(ticks.some((tk) => !tk.major && tk.label === "")).toBe(true);
  });

  test("respects the data range (no ticks outside it)", () => {
    const t = new LinearTransform(1000, 0);
    const ticks = axisTicks(t, { dataMin: 0, dataMax: 100, pxStart: 0, pxEnd: 10 });
    expect(ticks.every((tk) => tk.value >= 0 && tk.value <= 100)).toBe(true);
    expect(ticks.some((tk) => tk.value === 100)).toBe(true);
  });
});
