import { describe, expect, test } from "bun:test";
import { EngineController, createInProcessBackend } from "../src/index.ts";

describe("controller undo/redo", () => {
  test("undo/redo step through gate additions", async () => {
    const c = new EngineController(createInProcessBackend());
    await c.addSampleFromColumns(
      "s",
      [{ name: "X" }, { name: "Y" }],
      [
        [1, 2, 3, 4, 5],
        [1, 2, 3, 4, 5],
      ],
    );
    c.setTransform({ kind: "linear", T: 10, A: 0 });
    const rect = { kind: "rectangle" as const, xChannel: "X", yChannel: "Y", xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
    await c.addGate(rect, { name: "g1" });
    await c.addGate(rect, { name: "g2" });
    expect(c.store.get().gates).toHaveLength(2);

    expect(c.undo()).toBe(true);
    expect(c.store.get().gates).toHaveLength(1);
    expect(c.undo()).toBe(true);
    expect(c.store.get().gates).toHaveLength(0);

    expect(c.redo()).toBe(true);
    expect(c.store.get().gates).toHaveLength(1);
    expect(c.redo()).toBe(true);
    expect(c.store.get().gates).toHaveLength(2);
    expect(c.store.get().gates[1].name).toBe("g2");
  });

  test("importGatingML is a single undo unit", async () => {
    const c = new EngineController(createInProcessBackend());
    await c.addSampleFromColumns("s", [{ name: "X" }, { name: "Y" }], [[1, 5], [1, 5]]);
    c.setTransform({ kind: "linear", T: 10, A: 0 });
    const xml = `<gating:Gating-ML xmlns:gating="g" xmlns:data-type="d">
      <gating:RectangleGate gating:id="A"><gating:dimension gating:min="0" gating:max="1">
      <data-type:fcs-dimension data-type:name="X"/></gating:dimension>
      <gating:dimension gating:min="0" gating:max="1"><data-type:fcs-dimension data-type:name="Y"/></gating:dimension>
      </gating:RectangleGate>
      <gating:RectangleGate gating:id="B"><gating:dimension gating:min="0" gating:max="10">
      <data-type:fcs-dimension data-type:name="X"/></gating:dimension>
      <gating:dimension gating:min="0" gating:max="10"><data-type:fcs-dimension data-type:name="Y"/></gating:dimension>
      </gating:RectangleGate></gating:Gating-ML>`;
    await c.importGatingML(xml);
    expect(c.store.get().gates).toHaveLength(2);
    expect(c.undo()).toBe(true); // one undo removes the whole import
    expect(c.store.get().gates).toHaveLength(0);
  });
});
