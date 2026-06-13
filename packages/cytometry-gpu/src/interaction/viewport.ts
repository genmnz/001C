import type { Viewport } from "../renderer.ts";

/**
 * Pure pixel↔display mapping and pan/zoom math for the plot. No DOM — the React
 * (or any) UI feeds pixel coordinates in and gets viewports/points out, so this
 * is fully unit-testable (and heavily fuzzed). Screen origin is top-left with y
 * increasing downward; display space has y increasing upward (cytometry
 * convention), so the mapping flips Y.
 */
export interface Pt {
  x: number;
  y: number;
}

/** Screen pixel -> display-space coordinate. */
export function screenToDisplay(
  sx: number,
  sy: number,
  vp: Viewport,
  width: number,
  height: number,
): Pt {
  const fx = sx / width;
  const fy = 1 - sy / height; // flip Y
  return {
    x: vp.xMin + fx * (vp.xMax - vp.xMin),
    y: vp.yMin + fy * (vp.yMax - vp.yMin),
  };
}

/** Display-space coordinate -> screen pixel. */
export function displayToScreen(
  x: number,
  y: number,
  vp: Viewport,
  width: number,
  height: number,
): Pt {
  const fx = (x - vp.xMin) / (vp.xMax - vp.xMin);
  const fy = (y - vp.yMin) / (vp.yMax - vp.yMin);
  return { x: fx * width, y: (1 - fy) * height };
}

/** Pan by a pixel delta (content follows the cursor). */
export function panViewport(
  vp: Viewport,
  dxPx: number,
  dyPx: number,
  width: number,
  height: number,
): Viewport {
  const dx = (dxPx / width) * (vp.xMax - vp.xMin);
  const dy = (dyPx / height) * (vp.yMax - vp.yMin);
  // Dragging right moves the view left in data space; screen-down is display-up.
  return {
    xMin: vp.xMin - dx,
    xMax: vp.xMax - dx,
    yMin: vp.yMin + dy,
    yMax: vp.yMax + dy,
  };
}

/**
 * Zoom about a screen anchor, keeping the display point under the cursor fixed.
 * `factor` < 1 zooms in (range shrinks), > 1 zooms out.
 */
export function zoomViewport(
  vp: Viewport,
  factor: number,
  anchorSx: number,
  anchorSy: number,
  width: number,
  height: number,
): Viewport {
  const a = screenToDisplay(anchorSx, anchorSy, vp, width, height);
  return {
    xMin: a.x - (a.x - vp.xMin) * factor,
    xMax: a.x + (vp.xMax - a.x) * factor,
    yMin: a.y - (a.y - vp.yMin) * factor,
    yMax: a.y + (vp.yMax - a.y) * factor,
  };
}
