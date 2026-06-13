import { describe, expect, test } from "bun:test";
import { EventMatrix } from "../src/matrix.ts";
import {
  concatenate,
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
