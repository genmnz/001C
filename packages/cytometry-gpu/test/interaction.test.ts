import { describe, expect, test } from "bun:test";
import { mulberry32, uniform } from "../../cytometry-core/test/helpers.ts";
import { rectFromDrag, polygonFromScreen } from "../src/interaction/gates.ts";
import {
  displayToScreen,
  panViewport,
  screenToDisplay,
  zoomViewport,
} from "../src/interaction/viewport.ts";
import type { Viewport } from "../src/renderer.ts";

const r = mulberry32(0xface);
function randomVp(): Viewport {
  const xMin = uniform(r, -1000, 1000);
  const yMin = uniform(r, -1000, 1000);
  return {
    xMin,
    xMax: xMin + uniform(r, 0.01, 5000),
    yMin,
    yMax: yMin + uniform(r, 0.01, 5000),
  };
}

describe("screen <-> display mapping (fuzz)", () => {
  test("round-trips both directions", () => {
    for (let i = 0; i < 5000; i++) {
      const vp = randomVp();
      const w = 1 + Math.floor(uniform(r, 1, 2048));
      const h = 1 + Math.floor(uniform(r, 1, 2048));
      const sx = uniform(r, 0, w);
      const sy = uniform(r, 0, h);
      const d = screenToDisplay(sx, sy, vp, w, h);
      const back = displayToScreen(d.x, d.y, vp, w, h);
      expect(Math.abs(back.x - sx)).toBeLessThan(1e-6);
      expect(Math.abs(back.y - sy)).toBeLessThan(1e-6);
    }
  });

  test("Y is flipped (display y increases upward)", () => {
    const vp = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    expect(screenToDisplay(0, 0, vp, 100, 100).y).toBeCloseTo(1, 9); // top -> yMax
    expect(screenToDisplay(0, 100, vp, 100, 100).y).toBeCloseTo(0, 9); // bottom -> yMin
  });
});

describe("pan (content follows the cursor)", () => {
  test("a content point moves by exactly the pixel delta", () => {
    for (let i = 0; i < 3000; i++) {
      const vp = randomVp();
      const w = 800;
      const h = 600;
      const sx = uniform(r, 0, w);
      const sy = uniform(r, 0, h);
      const dxPx = uniform(r, -300, 300);
      const dyPx = uniform(r, -300, 300);
      const d = screenToDisplay(sx, sy, vp, w, h);
      const vp2 = panViewport(vp, dxPx, dyPx, w, h);
      const moved = displayToScreen(d.x, d.y, vp2, w, h);
      expect(Math.abs(moved.x - (sx + dxPx))).toBeLessThan(1e-6);
      expect(Math.abs(moved.y - (sy + dyPx))).toBeLessThan(1e-6);
    }
  });

  test("pan then anti-pan returns to the original viewport", () => {
    const vp = { xMin: -5, xMax: 5, yMin: 0, yMax: 10 };
    const a = panViewport(vp, 123, -45, 800, 600);
    const b = panViewport(a, -123, 45, 800, 600);
    expect(b.xMin).toBeCloseTo(vp.xMin, 9);
    expect(b.yMax).toBeCloseTo(vp.yMax, 9);
  });
});

describe("zoom about a cursor", () => {
  test("the anchored display point stays under the cursor", () => {
    for (let i = 0; i < 3000; i++) {
      const vp = randomVp();
      const w = 1024;
      const h = 768;
      const ax = uniform(r, 0, w);
      const ay = uniform(r, 0, h);
      const factor = uniform(r, 0.2, 5);
      const before = screenToDisplay(ax, ay, vp, w, h);
      const vp2 = zoomViewport(vp, factor, ax, ay, w, h);
      const s = displayToScreen(before.x, before.y, vp2, w, h);
      expect(Math.abs(s.x - ax)).toBeLessThan(1e-6);
      expect(Math.abs(s.y - ay)).toBeLessThan(1e-6);
    }
  });

  test("zoom by f then 1/f about the same point restores the viewport", () => {
    const vp = { xMin: -2, xMax: 8, yMin: 1, yMax: 4 };
    const z1 = zoomViewport(vp, 0.5, 300, 200, 800, 600);
    const z2 = zoomViewport(z1, 2, 300, 200, 800, 600);
    expect(z2.xMin).toBeCloseTo(vp.xMin, 9);
    expect(z2.xMax).toBeCloseTo(vp.xMax, 9);
    expect(z2.yMin).toBeCloseTo(vp.yMin, 9);
    expect(z2.yMax).toBeCloseTo(vp.yMax, 9);
  });
});

describe("gate construction from gestures", () => {
  test("rectFromDrag is direction-independent and maps correctly", () => {
    const vp = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    // drag from (20,80)->(60,20) screen on a 100x100 canvas (y flipped):
    //   (20,80) -> display (20, 20); (60,20) -> display (60, 80)
    const a = rectFromDrag(20, 80, 60, 20, vp, 100, 100);
    const b = rectFromDrag(60, 20, 20, 80, vp, 100, 100); // reversed
    expect(a).toEqual(b);
    expect(a.xMin).toBeCloseTo(20, 6);
    expect(a.xMax).toBeCloseTo(60, 6);
    expect(a.yMin).toBeCloseTo(20, 6);
    expect(a.yMax).toBeCloseTo(80, 6);
  });

  test("polygonFromScreen round-trips through displayToScreen", () => {
    const vp = randomVp();
    const w = 640;
    const h = 480;
    const screenPts = [
      { x: 100, y: 100 },
      { x: 300, y: 120 },
      { x: 250, y: 400 },
    ];
    const verts = polygonFromScreen(screenPts, vp, w, h);
    verts.forEach(([x, y], i) => {
      const s = displayToScreen(x, y, vp, w, h);
      expect(Math.abs(s.x - screenPts[i].x)).toBeLessThan(1e-6);
      expect(Math.abs(s.y - screenPts[i].y)).toBeLessThan(1e-6);
    });
  });
});
