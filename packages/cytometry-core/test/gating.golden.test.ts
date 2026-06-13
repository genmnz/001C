import { describe, expect, test } from "bun:test";
import { EllipseGate, PolygonGate } from "../src/gating/index.ts";
import golden from "./golden/gating.golden.json";

/**
 * External-oracle validation of gate geometry against flowutils
 * (points_in_polygon — winding rule; points_in_ellipsoid — covariance form).
 * ~18k random points across simple, concave, and irregular polygons plus three
 * rotated ellipses; membership must match the oracle exactly (random floats
 * never land on an edge, so the even-odd/winding inclusivity difference doesn't
 * arise).
 */
describe("PolygonGate vs flowutils points_in_polygon", () => {
  test("oracle provenance", () => {
    expect(golden.provenance.oracle).toBe("flowutils");
  });
  for (let i = 0; i < golden.polygons.length; i++) {
    const p = golden.polygons[i];
    test(`polygon ${i} membership matches (${p.points.length} pts)`, () => {
      const gate = new PolygonGate(
        "x",
        "y",
        p.vertices as [number, number][],
      );
      let mismatches = 0;
      for (let k = 0; k < p.points.length; k++) {
        const got = gate.contains(p.points[k][0], p.points[k][1]) ? 1 : 0;
        if (got !== p.inside[k]) mismatches++;
      }
      expect(mismatches).toBe(0);
    });
  }
});

describe("EllipseGate vs flowutils points_in_ellipsoid", () => {
  for (let i = 0; i < golden.ellipses.length; i++) {
    const e = golden.ellipses[i];
    test(`ellipse ${i} membership matches (${e.points.length} pts)`, () => {
      const gate = new EllipseGate("x", "y", e.cx, e.cy, e.rx, e.ry, e.angle);
      let mismatches = 0;
      for (let k = 0; k < e.points.length; k++) {
        const got = gate.contains(e.points[k][0], e.points[k][1]) ? 1 : 0;
        if (got !== e.inside[k]) mismatches++;
      }
      expect(mismatches).toBe(0);
    });
  }
});
