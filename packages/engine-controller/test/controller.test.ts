import { describe, expect, test } from "bun:test";
import { EngineController, createInProcessBackend } from "../src/index.ts";
import { writeFcs } from "../../fcs/test/synth.ts";

describe("EngineController (in-process backend)", () => {
  test("end-to-end: load columns -> density -> gate -> stats", async () => {
    const controller = new EngineController(createInProcessBackend());
    const channels = [{ name: "FSC-A" }, { name: "CD3" }];
    // A tight low cluster (raw 1-3) and a high cluster (raw 100-101).
    const cols = [
      [1, 2, 3, 100, 101],
      [1, 2, 3, 100, 101],
    ];
    await controller.addSampleFromColumns("s1", channels, cols);

    const st0 = controller.store.get();
    expect(st0.activeSampleId).toBe("s1");
    expect(st0.axes).toEqual({ x: "FSC-A", y: "CD3" }); // first two channels auto-selected

    // Linear transform maps raw -> raw/1000, keeping the math easy to assert.
    controller.setTransform({ kind: "linear", T: 1000, A: 0 });

    const bins = await controller.density({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, 10, 10);
    expect(bins.counts.reduce((a, b) => a + b, 0)).toBe(5); // all 5 events in range

    // Rectangle in DISPLAY space catching only the low cluster (display ~0.001-0.003).
    const node = await controller.addGate({
      kind: "rectangle",
      xChannel: "FSC-A",
      yChannel: "CD3",
      xMin: 0,
      xMax: 0.01,
      yMin: 0,
      yMax: 0.01,
    });
    expect(node.count).toBe(3);
    expect(controller.store.get().gates).toHaveLength(1);

    await controller.refreshStats(node.id, "FSC-A");
    const stat = controller.store.get().stats[`${node.populationId}:FSC-A`];
    expect(stat.count).toBe(3);
    expect(stat.median).toBeCloseTo(2, 6); // median of raw {1,2,3}
    expect(stat.ofTotal).toBeCloseTo(3 / 5, 6);
  });

  test("child gate is restricted to its parent population", async () => {
    const controller = new EngineController(createInProcessBackend());
    await controller.addSampleFromColumns(
      "s1",
      [{ name: "X" }, { name: "Y" }],
      [
        [1, 2, 3, 4, 5],
        [1, 2, 3, 4, 5],
      ],
    );
    controller.setTransform({ kind: "linear", T: 10, A: 0 });
    // Parent: x in display [0, 0.35] -> raw {1,2,3} (0.1,0.2,0.3).
    const parent = await controller.addGate({
      kind: "rectangle",
      xChannel: "X",
      yChannel: "Y",
      xMin: 0,
      xMax: 0.35,
      yMin: 0,
      yMax: 1,
    });
    expect(parent.count).toBe(3);
    // Child within parent: x in [0.15, 1] -> from {1,2,3} keeps {2,3}.
    const child = await controller.addGate(
      {
        kind: "rectangle",
        xChannel: "X",
        yChannel: "Y",
        xMin: 0.15,
        xMax: 1,
        yMin: 0,
        yMax: 1,
      },
      { parentId: parent.id },
    );
    expect(child.count).toBe(2); // restricted to parent, not all 4 raw>=2
  });

  test("integration: loadSample parses a real FCS buffer end-to-end", async () => {
    const buf = writeFcs({
      datatype: "F",
      channels: [
        { name: "FSC-A", bits: 32, range: 262144 },
        { name: "CD3", label: "CD3", bits: 32, range: 262144 },
      ],
      columns: [
        [10, 20],
        [30, 40],
      ],
    });
    const controller = new EngineController(createInProcessBackend());
    const info = await controller.loadSample("real", buf);
    expect(info.eventCount).toBe(2);
    expect(info.channels.map((c) => c.name)).toEqual(["FSC-A", "CD3"]);
    expect(controller.store.get().activeSampleId).toBe("real");
  });
});
