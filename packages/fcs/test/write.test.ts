import { describe, expect, test } from "bun:test";
import { parseFcs, writeFcs } from "../src/index.ts";

describe("writeFcs round-trips with parseFcs", () => {
  test("channels, labels, counts, and column-major data are preserved", () => {
    const eventCount = 4;
    // column-major: ch0 then ch1
    const data = Float32Array.from([1, 2, 3, 4, 10, 20, 30, 40]);
    const buf = writeFcs({
      channels: [
        { name: "FSC-A", range: 262144 },
        { name: "CD3", label: "CD3", range: 262144 },
      ],
      eventCount,
      data,
    });
    const f = parseFcs(buf);
    expect(f.version).toBe("FCS3.1");
    expect(f.eventCount).toBe(4);
    expect(f.channels.map((c) => c.name)).toEqual(["FSC-A", "CD3"]);
    expect(f.channels[1].label).toBe("CD3");
    expect(Array.from(f.data)).toEqual([1, 2, 3, 4, 10, 20, 30, 40]);
  });

  test("spillover survives the round-trip", () => {
    const buf = writeFcs({
      channels: [{ name: "A" }, { name: "B" }],
      eventCount: 1,
      data: Float32Array.from([5, 7]),
      spillover: { channels: ["A", "B"], values: [1, 0.1, 0.2, 1] },
    });
    const f = parseFcs(buf);
    expect(f.spillover?.channels).toEqual(["A", "B"]);
    expect(Array.from(f.spillover!.values)).toEqual([1, 0.1, 0.2, 1]);
  });
});
