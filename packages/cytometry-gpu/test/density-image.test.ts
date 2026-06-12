import { describe, expect, test } from "bun:test";
import { densityToImage } from "../src/density-image.ts";

describe("densityToImage", () => {
  const bins = {
    binsX: 2,
    binsY: 2,
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
    // row-major: (ix,iy) at iy*binsX+ix. Count 5 at ix=1,iy=0.
    counts: new Uint32Array([0, 5, 0, 0]),
    max: 5,
  };

  test("produces an RGBA image sized to the bin grid", () => {
    const img = densityToImage(bins, { scale: "log" });
    expect(img.width).toBe(2);
    expect(img.height).toBe(2);
    expect(img.data.length).toBe(2 * 2 * 4);
  });

  test("max-count bin gets the top colormap color at full opacity", () => {
    const img = densityToImage(bins, { scale: "log", flipY: true });
    // iy=0 with flipY -> bottom row (row index binsY-1=1), ix=1 -> pixel (1*2+1)*4 = 12.
    const px = 12;
    expect(img.data[px + 3]).toBe(255); // opaque
    expect([img.data[px], img.data[px + 1], img.data[px + 2]]).toEqual([
      253, 231, 37,
    ]); // log1p(5)/log1p(5) = 1 -> viridis(1)
  });

  test("empty bins are transparent", () => {
    const img = densityToImage(bins);
    // ix=0,iy=0 -> flipped row 1, pixel (1*2+0)*4 = 8.
    expect(img.data[8 + 3]).toBe(0);
  });
});
