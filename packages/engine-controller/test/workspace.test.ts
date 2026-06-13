import { describe, expect, test } from "bun:test";
import {
  EngineController,
  createInProcessBackend,
  serializeWorkspace,
  topoSortGates,
} from "../src/index.ts";

describe("workspace serialization", () => {
  async function buildController() {
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
    const parent = await c.addGate(
      { kind: "rectangle", xChannel: "X", yChannel: "Y", xMin: 0, xMax: 0.45, yMin: 0, yMax: 1 },
      { name: "Parent" },
    );
    await c.addGate(
      { kind: "rectangle", xChannel: "X", yChannel: "Y", xMin: 0.15, xMax: 1, yMin: 0, yMax: 1 },
      { name: "Child", parentId: parent.id },
    );
    return { c, parentCount: parent.count };
  }

  test("export -> JSON -> import rebuilds gates with the same structure & counts", async () => {
    const { c } = await buildController();
    const original = c.store.get().gates.map((g) => ({ name: g.name, count: g.count }));

    const doc = JSON.parse(JSON.stringify(c.exportWorkspace()));
    expect(doc.version).toBe(1);
    expect(doc.gates).toHaveLength(2);

    // Fresh controller + same sample, then import.
    const c2 = new EngineController(createInProcessBackend());
    await c2.addSampleFromColumns(
      "s",
      [{ name: "X" }, { name: "Y" }],
      [
        [1, 2, 3, 4, 5],
        [1, 2, 3, 4, 5],
      ],
    );
    await c2.importWorkspace(doc);

    const restored = c2.store.get().gates;
    expect(restored.map((g) => g.name)).toEqual(["Parent", "Child"]);
    expect(restored.map((g) => g.count)).toEqual(original.map((g) => g.count));
    expect(c2.store.get().transform).toEqual({ kind: "linear", T: 10, A: 0 });

    // Child's restored parentId points at the restored Parent node.
    const parent = restored.find((g) => g.name === "Parent")!;
    const child = restored.find((g) => g.name === "Child")!;
    expect(child.parentId).toBe(parent.id);
  });

  test("topoSortGates orders parents before children", () => {
    const sorted = topoSortGates([
      { id: "c", name: "c", spec: { kind: "range", channel: "X", min: 0, max: 1 }, parentId: "b" },
      { id: "a", name: "a", spec: { kind: "range", channel: "X", min: 0, max: 1 }, parentId: null },
      { id: "b", name: "b", spec: { kind: "range", channel: "X", min: 0, max: 1 }, parentId: "a" },
    ]);
    expect(sorted.map((g) => g.id)).toEqual(["a", "b", "c"]);
  });
});
