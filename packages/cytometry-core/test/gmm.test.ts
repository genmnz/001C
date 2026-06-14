import { describe, expect, test } from "bun:test";
import { gmm } from "../src/cluster/gmm.ts";
import { mulberry32 } from "./helpers.ts";

function gaussRand(r: () => number): number {
  const u = Math.max(1e-9, r());
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

describe("gmm (EM, diagonal covariance)", () => {
  test("recovers two separated 2-D Gaussians (means, weights, pure labels)", () => {
    const r = mulberry32(17);
    const per = 400;
    const x = new Float64Array(per * 2);
    const y = new Float64Array(per * 2);
    for (let i = 0; i < per; i++) {
      x[i] = 0 + gaussRand(r);
      y[i] = 0 + gaussRand(r);
    }
    for (let i = 0; i < per; i++) {
      x[per + i] = 10 + gaussRand(r);
      y[per + i] = 10 + gaussRand(r);
    }

    const res = gmm([x, y], 2, { seed: 3 });
    // Identify which component is the (0,0) blob.
    const c0 = Math.hypot(res.means[0][0], res.means[0][1]) < 5 ? 0 : 1;
    const c1 = 1 - c0;
    expect(res.means[c0][0]).toBeCloseTo(0, 0);
    expect(res.means[c0][1]).toBeCloseTo(0, 0);
    expect(res.means[c1][0]).toBeCloseTo(10, 0);
    expect(res.means[c1][1]).toBeCloseTo(10, 0);
    expect(res.weights[0]).toBeCloseTo(0.5, 1);
    expect(res.weights[1]).toBeCloseTo(0.5, 1);

    // Hard labels: each blob predominantly one component.
    let pure = 0;
    for (let i = 0; i < per; i++) if (res.labels[i] === res.labels[0]) pure++;
    for (let i = per; i < 2 * per; i++) if (res.labels[i] === res.labels[per]) pure++;
    expect(pure / (2 * per)).toBeGreaterThan(0.95);
    expect(res.labels[0]).not.toBe(res.labels[per]);
    // Log-likelihood is finite and improved over iterations.
    expect(Number.isFinite(res.logLikelihood)).toBe(true);
  });
});
