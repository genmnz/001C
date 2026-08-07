import { describe, expect, test } from "bun:test";
import { parseFcs } from "../src/index.ts";
import { writeFcs } from "./synth.ts";

/**
 * The injectable allocator (ParseOptions.alloc) is the seam that lets the engine
 * parse a sample straight into a SharedArrayBuffer in the worker. The parser
 * itself stays dependency-free: default is a plain ArrayBuffer, and whatever the
 * caller returns backs the event matrix verbatim.
 */
describe("FCS parser matrix allocation", () => {
  const buf = writeFcs({
    channels: [
      { name: "FSC-A", bits: 32, range: 262144 },
      { name: "CD3", bits: 32, range: 262144 },
    ],
    columns: [
      [1, 2, 3],
      [4, 5, 6],
    ],
    datatype: "F",
  });

  test("defaults to a plain ArrayBuffer", () => {
    const f = parseFcs(buf);
    expect(f.data.buffer).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(f.data)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("uses the injected allocator, sized to tot*par*4, with identical layout", () => {
    let asked = -1;
    const f = parseFcs(buf, {
      alloc: (n) => {
        asked = n;
        return new ArrayBuffer(n);
      },
    });
    expect(asked).toBe(3 * 2 * Float32Array.BYTES_PER_ELEMENT);
    expect(f.data.length).toBe(6);
    expect(Array.from(f.data)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test("a SharedArrayBuffer allocator backs the matrix in shared memory", () => {
    if (typeof SharedArrayBuffer === "undefined") return; // not applicable
    const f = parseFcs(buf, { alloc: (n) => new SharedArrayBuffer(n) });
    expect(f.data.buffer).toBeInstanceOf(SharedArrayBuffer);
    expect(Array.from(f.data)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
