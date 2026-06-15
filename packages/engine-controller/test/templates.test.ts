import { describe, expect, test } from "bun:test";
import { EngineController, createInProcessBackend } from "../src/index.ts";

describe("gate templates", () => {
  test("save a gate as a template and re-apply it (with channel remap)", async () => {
    const c = new EngineController(createInProcessBackend());
    await c.addSampleFromColumns(
      "s",
      [{ name: "A" }, { name: "B" }, { name: "C" }],
      [
        [1, 2, 3, 4, 5],
        [1, 2, 3, 4, 5],
        [5, 4, 3, 2, 1],
      ],
    );
    c.setTransform({ kind: "linear", T: 10, A: 0 });

    const g = await c.addGate(
      { kind: "rectangle", xChannel: "A", yChannel: "B", xMin: 0, xMax: 0.35, yMin: 0, yMax: 1 },
      { name: "lowA" },
    );
    const tmpl = c.saveGateTemplate(g.id, "lowGate");
    expect(c.store.get().templates).toHaveLength(1);

    // Apply same geometry on A/B again -> same count.
    const again = await c.applyGateTemplate(tmpl.id);
    expect(again.count).toBe(g.count);

    // Apply remapped to A/C -> a gate on different axes (spec channels changed).
    const remapped = await c.applyGateTemplate(tmpl.id, { channels: { x: "A", y: "C" } });
    expect(remapped.spec.kind).toBe("rectangle");
    if (remapped.spec.kind === "rectangle") expect(remapped.spec.yChannel).toBe("C");
  });
});
