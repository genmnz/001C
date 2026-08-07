import { describe, expect, test } from "bun:test";
import { parseFcs, parseSpillover, rangeMask } from "../src/index.ts";
import { writeFcs } from "./synth.ts";

describe("parseFcs — float data", () => {
  test("round-trips FCS3.1 float list-mode data, column-major", () => {
    const buf = writeFcs({
      version: "FCS3.1",
      datatype: "F",
      channels: [
        { name: "FSC-A", bits: 32, range: 262144 },
        { name: "CD3-A", label: "CD3", bits: 32, range: 262144 },
      ],
      columns: [
        [1, 2, 3],
        [10, 20, 30],
      ],
    });
    const f = parseFcs(buf);
    expect(f.version).toBe("FCS3.1");
    expect(f.eventCount).toBe(3);
    expect(f.channels.map((c) => c.name)).toEqual(["FSC-A", "CD3-A"]);
    expect(f.channels[1].label).toBe("CD3");
    expect(f.channels[0].bits).toBe(32);
    // Column-major: channel 0 then channel 1.
    expect(Array.from(f.data)).toEqual([1, 2, 3, 10, 20, 30]);
    expect(f.warnings).toEqual([]);
  });
});

describe("parseFcs — integer bit-masking ($PnR)", () => {
  test("masks high junk bits to the bits implied by $PnR", () => {
    // range 1024 -> 10 significant bits -> mask 0x3FF. 65541 & 0x3FF == 5.
    const buf = writeFcs({
      datatype: "I",
      channels: [{ name: "INT", bits: 32, range: 1024 }],
      columns: [[500, 65541, 1023]],
    });
    const f = parseFcs(buf);
    expect(Array.from(f.data)).toEqual([500, 5, 1023]);
  });

  test("rangeMask computes the right width", () => {
    expect(rangeMask(1024, 32)).toBe(1023); // 2^10 - 1
    expect(rangeMask(262144, 32)).toBe(262143); // 2^18 - 1
    expect(rangeMask(0, 16)).toBe(65535); // no range -> full width
  });
});

describe("parseFcs — endianness", () => {
  test("reads big-endian 16-bit integers", () => {
    const buf = writeFcs({
      datatype: "I",
      littleEndian: false,
      channels: [{ name: "BE", bits: 16, range: 65536 }],
      columns: [[258, 1000]], // 258 = 0x0102
    });
    const f = parseFcs(buf);
    expect(Array.from(f.data)).toEqual([258, 1000]);
  });
});

describe("parseFcs — ASCII ($DATATYPE A)", () => {
  test("round-trips delimited ASCII list-mode data, column-major", () => {
    const buf = writeFcs({
      datatype: "A",
      channels: [
        { name: "FSC-A", bits: 8, range: 1000 },
        { name: "CD3-A", label: "CD3", bits: 8, range: 1000 },
      ],
      columns: [
        [1, 2, 3],
        [10.5, 20.5, 30.5], // x.5 magnitudes are exact in Float32
      ],
    });
    const f = parseFcs(buf);
    expect(f.eventCount).toBe(3);
    expect(f.channels.map((c) => c.name)).toEqual(["FSC-A", "CD3-A"]);
    expect(Array.from(f.data)).toEqual([1, 2, 3, 10.5, 20.5, 30.5]);
    expect(f.warnings).toEqual([]);
  });

  test("parses signed and exponent notation", () => {
    const buf = writeFcs({
      datatype: "A",
      channels: [{ name: "X", bits: 8, range: 1000 }],
      columns: [[-1.5, 2e3, 0]],
    });
    const f = parseFcs(buf);
    expect(Array.from(f.data)).toEqual([-1.5, 2000, 0]);
  });

  test("falls back to fixed-width when values are packed without delimiters", () => {
    const buf = writeFcs({
      datatype: "A",
      asciiFixedWidth: true,
      channels: [
        { name: "A", bits: 6, range: 1000 },
        { name: "B", bits: 6, range: 1000 },
      ],
      columns: [
        [1, 22, 333],
        [4, 55, 666],
      ],
    });
    const f = parseFcs(buf);
    expect(f.eventCount).toBe(3);
    expect(Array.from(f.data)).toEqual([1, 22, 333, 4, 55, 666]);
  });

  test("honors maxEvents (progressive load) on ASCII data", () => {
    const buf = writeFcs({
      datatype: "A",
      channels: [
        { name: "A", bits: 8, range: 1000 },
        { name: "B", bits: 8, range: 1000 },
      ],
      columns: [
        [1, 2, 3, 4],
        [11, 12, 13, 14],
      ],
    });
    const f = parseFcs(buf, { maxEvents: 2 });
    expect(f.eventCount).toBe(2);
    // Column-major, first two events of each channel.
    expect(Array.from(f.data)).toEqual([1, 2, 11, 12]);
  });
});

describe("parseFcs — offset reconciliation", () => {
  test("falls back to $BEGINDATA/$ENDDATA when HEADER offsets are 0 (large-file rule)", () => {
    const buf = writeFcs({
      datatype: "F",
      headerDataOffsetsZero: true,
      channels: [{ name: "X", bits: 32, range: 262144 }],
      columns: [[42, 43]],
    });
    const f = parseFcs(buf);
    expect(Array.from(f.data)).toEqual([42, 43]);
  });

  test("warns and prefers HEADER when HEADER and TEXT offsets disagree", () => {
    const buf = writeFcs({
      datatype: "F",
      textDataOffsetDelta: 999, // corrupt the TEXT offsets only
      channels: [{ name: "X", bits: 32, range: 262144 }],
      columns: [[7, 8, 9]],
    });
    const f = parseFcs(buf);
    expect(Array.from(f.data)).toEqual([7, 8, 9]); // header offsets point at real data
    expect(f.warnings.some((w) => /disagree/.test(w))).toBe(true);
  });
});

describe("parseSpillover", () => {
  test("parses $SPILLOVER into channels + row-major matrix", () => {
    const text = new Map<string, string>([
      ["$SPILLOVER", "2,FL1,FL2,1,0.2,0.1,1"],
    ]);
    const s = parseSpillover(text)!;
    expect(s.channels).toEqual(["FL1", "FL2"]);
    expect(Array.from(s.values)).toEqual([1, 0.2, 0.1, 1]);
  });
  test("returns null when absent or malformed", () => {
    expect(parseSpillover(new Map())).toBeNull();
    expect(parseSpillover(new Map([["$SPILLOVER", "3,A,B"]]))).toBeNull();
  });
});
