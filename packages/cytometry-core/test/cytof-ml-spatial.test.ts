import { describe, expect, test } from "bun:test";
import { beadNormalize } from "../src/cytof/beadnorm.ts";
import { debarcode } from "../src/cytof/debarcode.ts";
import { accuracy, logisticRegression } from "../src/ml/logistic.ts";
import { neighborhoodEnrichment } from "../src/spatial/neighborhood.ts";
import { percentile } from "../src/stats/descriptive.ts";
import { mulberry32, uniform } from "./helpers.ts";

describe("debarcode", () => {
  test("assigns events to the correct barcoded sample (npos=2 of 4)", () => {
    const r = mulberry32(1);
    // 3 samples, 4 channels, each sample positive in a distinct 2-subset.
    const key = [
      [1, 1, 0, 0],
      [1, 0, 1, 0],
      [0, 0, 1, 1],
    ];
    const per = 150;
    const cols: Float64Array[] = [0, 1, 2, 3].map(() => new Float64Array(per * 3));
    const truth = new Int32Array(per * 3);
    for (let s = 0; s < 3; s++) {
      for (let i = 0; i < per; i++) {
        const e = s * per + i;
        truth[e] = s;
        for (let ch = 0; ch < 4; ch++) {
          cols[ch][e] = (key[s][ch] ? 10 : 0) + uniform(r, -1, 1);
        }
      }
    }
    const res = debarcode(cols, key);
    let correct = 0;
    for (let e = 0; e < per * 3; e++) if (res.labels[e] === truth[e]) correct++;
    expect(correct / (per * 3)).toBeGreaterThan(0.97);
  });

  test("cutoff sends ambiguous events to -1", () => {
    const key = [
      [1, 0],
      [0, 1],
    ];
    // an ambiguous event: both channels equal -> tiny separation
    const cols = [new Float64Array([5]), new Float64Array([5])];
    const res = debarcode(cols, key, { cutoff: 1 });
    expect(res.labels[0]).toBe(-1);
  });
});

describe("beadNormalize", () => {
  test("removes a shared multiplicative drift tracked by beads", () => {
    const n = 1000;
    const bead = new Float64Array(n);
    const marker = new Float64Array(n);
    for (let e = 0; e < n; e++) {
      const drift = 1 + e / n; // 1.0 -> 2.0
      bead[e] = 100 * drift;
      marker[e] = 50 * drift; // same drift affects the marker
    }
    const [corrected] = beadNormalize([marker], bead, { reference: 100 });
    const med = percentile(Float64Array.from(corrected).sort(), 50);
    expect(med).toBeCloseTo(50, 0); // drift removed
    // spread is small after correction
    let min = Infinity;
    let max = -Infinity;
    for (const v of corrected) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(max - min).toBeLessThan(5);
  });
});

describe("logisticRegression", () => {
  test("learns a linear boundary with high accuracy", () => {
    const r = mulberry32(9);
    const n = 600;
    const x0 = new Float64Array(n);
    const x1 = new Float64Array(n);
    const y = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      x0[i] = uniform(r, -5, 5);
      x1[i] = uniform(r, -5, 5);
      y[i] = x0[i] + x1[i] > 0 ? 1 : 0; // separable boundary
    }
    const model = logisticRegression([x0, x1], y, { iterations: 30 });
    const preds = Array.from({ length: n }, (_, i) => model.predict([x0[i], x1[i]]));
    expect(accuracy(preds, y)).toBeGreaterThan(0.95);
    expect(model.weights[0]).toBeGreaterThan(0);
    expect(model.weights[1]).toBeGreaterThan(0);
  });
});

describe("neighborhoodEnrichment", () => {
  test("spatially segregated types self-enrich, cross-segregate", () => {
    const r = mulberry32(3);
    const per = 150;
    const x = new Float64Array(per * 2);
    const y = new Float64Array(per * 2);
    const labels = new Int32Array(per * 2);
    for (let i = 0; i < per; i++) {
      x[i] = uniform(r, 0, 10);
      y[i] = uniform(r, 0, 10);
      labels[i] = 0;
    }
    for (let i = 0; i < per; i++) {
      x[per + i] = uniform(r, 100, 110);
      y[per + i] = uniform(r, 100, 110);
      labels[per + i] = 1;
    }
    const res = neighborhoodEnrichment([x, y], labels, 2, 6);
    expect(res.enrichment[0 * 2 + 0]).toBeGreaterThan(1.5); // 0-0 enriched
    expect(res.enrichment[1 * 2 + 1]).toBeGreaterThan(1.5); // 1-1 enriched
    expect(res.enrichment[0 * 2 + 1]).toBeLessThan(0.5); // 0-1 segregated
  });
});
