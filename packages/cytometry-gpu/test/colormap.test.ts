import { describe, expect, test } from "bun:test";
import { colormapNames, sampleColormap } from "../src/colormap.ts";

describe("sampleColormap", () => {
  test("hits the viridis anchors", () => {
    expect(sampleColormap("viridis", 0)).toEqual([68, 1, 84]);
    expect(sampleColormap("viridis", 0.5)).toEqual([33, 145, 140]);
    expect(sampleColormap("viridis", 1)).toEqual([253, 231, 37]);
  });
  test("clamps out-of-range t", () => {
    expect(sampleColormap("viridis", -1)).toEqual([68, 1, 84]);
    expect(sampleColormap("viridis", 2)).toEqual([253, 231, 37]);
  });
  test("interpolates between anchors", () => {
    const mid = sampleColormap("viridis", 0.125); // halfway between stop 0 and 0.25
    expect(mid[0]).toBeGreaterThan(59);
    expect(mid[0]).toBeLessThan(68);
  });
  test("unknown colormap falls back to viridis", () => {
    expect(sampleColormap("nope", 0)).toEqual([68, 1, 84]);
  });
  test("lists available colormaps", () => {
    expect(colormapNames()).toContain("viridis");
    expect(colormapNames()).toContain("inferno");
  });
});
