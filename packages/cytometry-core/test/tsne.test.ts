import { describe, expect, test } from "bun:test";
import { tsne } from "../src/reduce/tsne.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("tsne", () => {
  test("preserves cluster structure: a point's nearest embedded neighbor shares its blob", () => {
    // Three separated 5-D blobs.
    const r = mulberry32(11);
    const per = 60;
    const d = 5;
    const centers = [
      [0, 0, 0, 0, 0],
      [15, 15, 0, 0, 0],
      [0, 0, 15, 15, 0],
    ];
    const cols: Float64Array[] = Array.from({ length: d }, () => new Float64Array(per * 3));
    const label = new Int32Array(per * 3);
    for (let c = 0; c < 3; c++) {
      for (let i = 0; i < per; i++) {
        const k = c * per + i;
        label[k] = c;
        for (let j = 0; j < d; j++) cols[j][k] = centers[c][j] + uniform(r, -1.5, 1.5);
      }
    }

    const Y = tsne(cols, { perplexity: 20, iterations: 300, seed: 5 });
    expect(Y.length).toBe(per * 3);

    // Neighbor preservation: nearest embedded neighbor has the same label.
    let agree = 0;
    for (let i = 0; i < Y.length; i++) {
      let best = -1;
      let bestD = Infinity;
      for (let j = 0; j < Y.length; j++) {
        if (i === j) continue;
        const dx = Y[i][0] - Y[j][0];
        const dy = Y[i][1] - Y[j][1];
        const dd = dx * dx + dy * dy;
        if (dd < bestD) {
          bestD = dd;
          best = j;
        }
      }
      if (label[best] === label[i]) agree++;
    }
    expect(agree / Y.length).toBeGreaterThan(0.9);
  });
});
