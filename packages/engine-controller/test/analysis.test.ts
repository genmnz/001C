import { describe, expect, test } from "bun:test";
import { EngineController, createInProcessBackend } from "../src/index.ts";

function blobs(per = 200) {
  const d = 3;
  const centers = [
    [0, 0, 0],
    [20, 20, 0],
    [0, 0, 20],
  ];
  const cols: number[][] = Array.from({ length: d }, () => []);
  let s = 12345;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x7fffffff - 0.5) * 3;
  };
  for (let c = 0; c < 3; c++)
    for (let i = 0; i < per; i++)
      for (let j = 0; j < d; j++) cols[j].push(centers[c][j] + rnd());
  return cols;
}

describe("controller analysis ops", () => {
  test("cluster (k-means) returns labels + count; embed (pca) returns 2-D points", async () => {
    const c = new EngineController(createInProcessBackend());
    const cols = blobs(200);
    await c.addSampleFromColumns(
      "s",
      [{ name: "m0" }, { name: "m1" }, { name: "m2" }],
      cols,
    );
    c.setTransform({ kind: "linear", T: 1, A: 0 }); // display == raw

    const cl = await c.cluster("kmeans", 3, { seed: 1 });
    expect(cl.clusterCount).toBe(3);
    expect(cl.labels.length).toBe(cl.eventIndex.length);
    expect(cl.labels.length).toBe(600);

    const emb = await c.embed("pca", { maxPoints: 300, seed: 1 });
    expect(emb.points.length).toBe(300);
    expect(emb.points[0]).toHaveLength(2);
    expect(emb.eventIndex.length).toBe(300);
  });
});
