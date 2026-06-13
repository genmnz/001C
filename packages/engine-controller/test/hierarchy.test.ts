import { describe, expect, test } from "bun:test";
import { EngineController, createInProcessBackend } from "../src/index.ts";

/**
 * Heavy end-to-end test of hierarchical gating through the controller: a 4-level
 * chain at 100k events where each gate partially overlaps its parent, so parent
 * restriction genuinely matters (effective membership = intersection of the
 * whole ancestor chain). Counts must equal an independent naive computation and
 * be non-increasing down the tree.
 */
describe("gate hierarchy (4 levels, 100k events)", () => {
  test("counts match naive intersection and are monotonic", async () => {
    const n = 100_000;
    const X = new Float32Array(n);
    const Y = new Float32Array(n);
    // Deterministic grid-ish spread across [0,1)^2.
    let s = 0x12345;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < n; i++) {
      X[i] = rnd();
      Y[i] = rnd();
    }

    const controller = new EngineController(createInProcessBackend());
    await controller.addSampleFromColumns("s", [{ name: "X" }, { name: "Y" }], [X, Y]);
    // Linear T=1, A=0 => display == raw, so gate coords are raw coords.
    controller.setTransform({ kind: "linear", T: 1, A: 0 });

    // Each gate is [xMin,xMax,yMin,yMax]; partially overlapping the previous.
    const rects: [number, number, number, number][] = [
      [0.1, 0.6, -1, 2], // L1: x in [0.1,0.6]
      [0.4, 0.9, -1, 2], // L2: x in [0.4,0.9]  -> chain x in [0.4,0.6]
      [-1, 2, 0.0, 0.5], // L3: y in [0,0.5]
      [0.5, 2, 0.0, 0.7], // L4: x in [0.5,..], y in [0,0.7]
    ];

    // Naive intersection counts down the chain.
    const inRect = (r: number[], x: number, y: number) =>
      x >= r[0] && x < r[1] && y >= r[2] && y < r[3];
    const naive: number[] = [];
    for (let level = 0; level < rects.length; level++) {
      let c = 0;
      for (let i = 0; i < n; i++) {
        let inAll = true;
        for (let l = 0; l <= level; l++) {
          if (!inRect(rects[l], X[i], Y[i])) {
            inAll = false;
            break;
          }
        }
        if (inAll) c++;
      }
      naive.push(c);
    }

    // Build the gate chain through the controller.
    let parentId: string | null = null;
    const counts: number[] = [];
    for (const [xMin, xMax, yMin, yMax] of rects) {
      const node = await controller.addGate(
        { kind: "rectangle", xChannel: "X", yChannel: "Y", xMin, xMax, yMin, yMax },
        { parentId },
      );
      counts.push(node.count);
      parentId = node.id;
    }

    expect(counts).toEqual(naive);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
    }
    expect(controller.store.get().gates).toHaveLength(4);
  });
});
