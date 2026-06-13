import type { Viewport } from "../renderer.ts";
import { screenToDisplay } from "./viewport.ts";

/**
 * Turn screen-space gestures into gate geometry in DISPLAY coordinates. The UI
 * adds channel names to make a GateSpec; this layer is pure geometry so it's
 * testable without a DOM. (GateSpec lives in @joeee/engine-controller; keeping
 * this dependency-free avoids a UI→controller cycle.)
 */
export interface RectGeometry {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Rectangle from two drag corners (any order), normalized to min/max. */
export function rectFromDrag(
  sx0: number,
  sy0: number,
  sx1: number,
  sy1: number,
  vp: Viewport,
  width: number,
  height: number,
): RectGeometry {
  const a = screenToDisplay(sx0, sy0, vp, width, height);
  const b = screenToDisplay(sx1, sy1, vp, width, height);
  return {
    xMin: Math.min(a.x, b.x),
    xMax: Math.max(a.x, b.x),
    yMin: Math.min(a.y, b.y),
    yMax: Math.max(a.y, b.y),
  };
}

/** Polygon vertices (display space) from a click sequence in screen space. */
export function polygonFromScreen(
  points: ReadonlyArray<{ x: number; y: number }>,
  vp: Viewport,
  width: number,
  height: number,
): [number, number][] {
  return points.map((p) => {
    const d = screenToDisplay(p.x, p.y, vp, width, height);
    return [d.x, d.y] as [number, number];
  });
}

/** Move one polygon vertex (by display delta) — for handle dragging. */
export function movePolygonVertex(
  vertices: ReadonlyArray<readonly [number, number]>,
  index: number,
  dxDisplay: number,
  dyDisplay: number,
): [number, number][] {
  return vertices.map((v, i) =>
    i === index ? [v[0] + dxDisplay, v[1] + dyDisplay] : [v[0], v[1]],
  );
}
