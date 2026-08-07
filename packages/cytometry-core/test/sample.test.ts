import { describe, expect, test } from "bun:test";
import { EventMatrix } from "../src/matrix.ts";
import {
  concatenate,
  densityDependentDownsample,
  downsample,
  exportCsv,
  systematicDownsample,
} from "../src/sample/index.ts";

function mat(values: number[][]): EventMatrix {
  const n = values[0].length;
  const channels = values.map((_, i) => ({ name: `c${i}` }));
  const m = EventMatrix.allocate(n, channels);
  values.forEach((col, i) => m.column(i).set(col));
  return m;
}

describe("concatenate", () => {
  test("conserves events and copies columns", () => {
    const a = mat([[1, 2], [10, 20]]);
    const b = mat([[3], [30]]);
    const out = concatenate([a, b]);
    expect(out.eventCount).toBe(3);
    expect(Array.from(out.column(0))).toEqual([1, 2, 3]);
    expect(Array.from(out.column(1))).toEqual([10, 20, 30]);
  });
  test("rejects mismatched channels", () => {
    expect(() => concatenate([mat([[1]]), mat([[1], [2]])])).toThrow();
  });
});

describe("downsample", () => {
  test("reservoir keeps exactly n distinct events, deterministic by seed", () => {
    const p1 = downsample(1000, 100, { seed: 7 });
    const p2 = downsample(1000, 100, { seed: 7 });
    expect(p1.count()).toBe(100);
    expect(Array.from(p1.toMask())).toEqual(Array.from(p2.toMask())); // deterministic
  });
  test("n >= total keeps everything", () => {
    expect(downsample(50, 100).count()).toBe(50);
  });
  test("systematic is every-k and deterministic", () => {
    const p = systematicDownsample(100, 10);
    expect(p.count()).toBe(10);
    expect(p.get(0)).toBe(true);
    expect(p.get(10)).toBe(true);
  });
});

describe("densityDependentDownsample", () => {
  // A dense blob of 400 points around (0,0) plus a rare cluster of 40 points
  // far away at (50,50). SPADE downsampling should thin the dense blob far more
  // aggressively than the rare cluster, boosting the rare fraction.
  function twoBlobs() {
    const rng = (() => {
      let a = 12345;
      return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();
    const xs: number[] = [];
    const ys: number[] = [];
    const dense = 400;
    const rare = 40;
    for (let i = 0; i < dense; i++) {
      xs.push((rng() - 0.5) * 2);
      ys.push((rng() - 0.5) * 2);
    }
    for (let i = 0; i < rare; i++) {
      xs.push(50 + (rng() - 0.5) * 2);
      ys.push(50 + (rng() - 0.5) * 2);
    }
    return { xs, ys, dense, rare };
  }

  test("keeps rare cells at a higher rate than dense cells; deterministic", () => {
    const { xs, ys, dense, rare } = twoBlobs();
    const p1 = densityDependentDownsample([xs, ys], { seed: 3 });
    const p2 = densityDependentDownsample([xs, ys], { seed: 3 });
    expect(Array.from(p1.toMask())).toEqual(Array.from(p2.toMask())); // deterministic

    let keptDense = 0;
    let keptRare = 0;
    p1.forEach((i) => (i < dense ? keptDense++ : keptRare++));

    expect(p1.count()).toBeLessThan(dense + rare); // actually downsampled
    const denseFrac = keptDense / dense;
    const rareFrac = keptRare / rare;
    expect(rareFrac).toBeGreaterThan(denseFrac); // rare population preserved
  });
});

describe("exportCsv", () => {
  test("header + gathered rows; honors a population and a transform", () => {
    const m = mat([[1, 2, 3], [4, 5, 6]]);
    const all = exportCsv(m);
    expect(all.split("\n")[0]).toBe("c0,c1");
    expect(all.split("\n")).toHaveLength(4); // header + 3 rows

    const pop = downsample(3, 3); // all, but exercise the path
    const t = exportCsv(m, pop, (_, v) => v * 10);
    expect(t.split("\n")[1]).toBe("10,40");
  });
});
