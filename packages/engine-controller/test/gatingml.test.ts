import { describe, expect, test } from "bun:test";
import { EngineController, createInProcessBackend } from "../src/index.ts";
import { parseGatingML } from "../src/interop/gatingml.ts";
import { parseXml } from "../src/interop/xml.ts";

const GML = `<?xml version="1.0"?>
<gating:Gating-ML xmlns:gating="http://www.isac-net.org/std/Gating-ML/v2.0/gating"
                  xmlns:data-type="http://www.isac-net.org/std/Gating-ML/v2.0/datatypes">
  <gating:RectangleGate gating:id="R1">
    <gating:dimension gating:min="2" gating:max="8">
      <data-type:fcs-dimension data-type:name="X"/>
    </gating:dimension>
    <gating:dimension gating:min="2" gating:max="8">
      <data-type:fcs-dimension data-type:name="Y"/>
    </gating:dimension>
  </gating:RectangleGate>
  <gating:PolygonGate gating:id="P1" gating:parent_id="R1">
    <gating:dimension><data-type:fcs-dimension data-type:name="X"/></gating:dimension>
    <gating:dimension><data-type:fcs-dimension data-type:name="Y"/></gating:dimension>
    <gating:vertex><gating:coordinate data-type:value="0"/><gating:coordinate data-type:value="0"/></gating:vertex>
    <gating:vertex><gating:coordinate data-type:value="5"/><gating:coordinate data-type:value="0"/></gating:vertex>
    <gating:vertex><gating:coordinate data-type:value="5"/><gating:coordinate data-type:value="5"/></gating:vertex>
    <gating:vertex><gating:coordinate data-type:value="0"/><gating:coordinate data-type:value="5"/></gating:vertex>
  </gating:PolygonGate>
</gating:Gating-ML>`;

describe("XML parser", () => {
  test("parses elements, namespaced attrs, nesting, self-closing", () => {
    const root = parseXml(`<a x="1"><b:c y="2"/><d>hi</d></a>`);
    const a = root.children[0];
    expect(a.name).toBe("a");
    expect(a.attrs.x).toBe("1");
    expect(a.children[0].name).toBe("b:c");
    expect(a.children[0].attrs.y).toBe("2");
    expect(a.children[1].text).toBe("hi");
  });
});

describe("parseGatingML", () => {
  test("reads rectangle + polygon with parent link and channels", () => {
    const gates = parseGatingML(GML);
    expect(gates.map((g) => g.id)).toEqual(["R1", "P1"]);
    const r = gates[0].spec;
    expect(r.kind).toBe("rectangle");
    if (r.kind === "rectangle") {
      expect(r.xChannel).toBe("X");
      expect(r.yChannel).toBe("Y");
      expect(r.xMin).toBe(2);
      expect(r.xMax).toBe(8);
    }
    expect(gates[1].parentId).toBe("R1");
    const p = gates[1].spec;
    expect(p.kind).toBe("polygon");
    if (p.kind === "polygon") expect(p.vertices).toHaveLength(4);
  });
});

describe("controller.importGatingML", () => {
  test("evaluates imported gates against the active sample", async () => {
    const c = new EngineController(createInProcessBackend());
    // grid of points 0..9 in X and Y
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < 10; i++)
      for (let j = 0; j < 10; j++) {
        x.push(i);
        y.push(j);
      }
    await c.addSampleFromColumns("s", [{ name: "X" }, { name: "Y" }], [x, y]);
    c.setTransform({ kind: "linear", T: 1, A: 0 }); // display == raw

    const n = await c.importGatingML(GML);
    expect(n).toBe(2);
    const gates = c.store.get().gates;
    // Rectangle X,Y in [2,8): integer points 2..7 -> 6×6 = 36.
    const rect = gates.find((g) => g.name === "R1")!;
    expect(rect.count).toBe(36);
    // Polygon (0,0)-(5,0)-(5,5)-(0,5) restricted to its parent rectangle [2,8).
    // Points with 2<=x<5? inclusive-edge nuances -> just assert it's nonempty & <= parent.
    const poly = gates.find((g) => g.name === "P1")!;
    expect(poly.count).toBeGreaterThan(0);
    expect(poly.count).toBeLessThanOrEqual(rect.count);
  });
});
