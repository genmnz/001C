import { describe, expect, test } from "bun:test";
import { EngineController, createInProcessBackend } from "../src/index.ts";
import { writeFcs } from "../../fcs/test/synth.ts";

/**
 * End-to-end compensation through the controller: applying a spillover changes
 * the sample's columns (verified via a full-coverage gate's median), and an FCS
 * $SPILLOVER is picked up so compensate() works with no argument.
 */
describe("controller.compensate", () => {
  // S[i][j]; observed_i = sum_j S[j][i] * true_j (the inv(S^T) convention).
  const S = [
    [1.0, 0.2],
    [0.1, 1.0],
  ];
  const trueA = [10, 20, 30, 40];
  const trueB = [100, 100, 100, 100];
  const obsA = trueA.map((a, i) => S[0][0] * a + S[1][0] * trueB[i]); // [20,30,40,50]
  const obsB = trueA.map((a, i) => S[0][1] * a + S[1][1] * trueB[i]); // [102,104,106,108]

  async function medianOfChannel(c: EngineController, ch: string): Promise<number> {
    // Linear T=1 => display == raw; a huge rectangle covers all events.
    c.setTransform({ kind: "linear", T: 1, A: 0 });
    const node = await c.addGate({
      kind: "rectangle",
      xChannel: "A",
      yChannel: "B",
      xMin: -1e6,
      xMax: 1e6,
      yMin: -1e6,
      yMax: 1e6,
    });
    await c.refreshStats(node.id, ch);
    return c.store.get().stats[`${node.populationId}:${ch}`].median;
  }

  test("applying an explicit spillover un-mixes the columns", async () => {
    const c = new EngineController(createInProcessBackend());
    await c.addSampleFromColumns("s", [{ name: "A" }, { name: "B" }], [obsA, obsB]);

    expect(await medianOfChannel(c, "A")).toBeCloseTo(35, 6); // observed median

    await c.compensate({ channels: ["A", "B"], values: [1.0, 0.2, 0.1, 1.0] });
    expect(c.store.get().samples["s"].compensated).toBe(true);
    expect(await medianOfChannel(c, "A")).toBeCloseTo(25, 4); // true median after un-mix
  });

  test("picks up $SPILLOVER from the FCS and compensates with no argument", async () => {
    const buf = writeFcs({
      datatype: "F",
      channels: [
        { name: "A", bits: 32, range: 262144 },
        { name: "B", bits: 32, range: 262144 },
      ],
      columns: [obsA, obsB],
      spillover: { channels: ["A", "B"], values: [1.0, 0.2, 0.1, 1.0] },
    });
    const c = new EngineController(createInProcessBackend());
    const info = await c.loadSample("real", buf);
    expect(info.hasSpillover).toBe(true);

    await c.compensate(); // uses the parsed $SPILLOVER
    expect(await medianOfChannel(c, "A")).toBeCloseTo(25, 4);
  });
});
