import { describe, expect, test } from "bun:test";
import {
  detectGenerationPeaks,
  modelProliferation,
  proliferationIndices,
} from "../src/proliferation/index.ts";
import { mulberry32 } from "./helpers.ts";

describe("proliferationIndices", () => {
  test("matches the hand-computed division-tracking formulas", () => {
    // gen0=10, gen1=8, gen2=8.
    // precursors = 10 + 8/2 + 8/4 = 16; divided = 4 + 2 = 6.
    // Σ i·Nᵢ/2ⁱ = 0 + 4 + 4 = 8.
    const r = proliferationIndices([10, 8, 8]);
    expect(r.total).toBe(26);
    expect(r.precursors).toBeCloseTo(16, 10);
    expect(r.dividedPrecursors).toBeCloseTo(6, 10);
    expect(r.percentDivided).toBeCloseTo(37.5, 6);
    expect(r.divisionIndex).toBeCloseTo(0.5, 10); // 8/16
    expect(r.proliferationIndex).toBeCloseTo(8 / 6, 10);
    expect(r.expansionIndex).toBeCloseTo(26 / 16, 10);
    expect(r.replicationIndex).toBeCloseTo(16 / 6, 10);
  });

  test("an undivided population reports zero proliferation", () => {
    const r = proliferationIndices([100]);
    expect(r.percentDivided).toBe(0);
    expect(r.divisionIndex).toBe(0);
    expect(r.proliferationIndex).toBe(0); // no responders → defined as 0
    expect(r.replicationIndex).toBe(0);
    expect(r.expansionIndex).toBeCloseTo(1, 10);
  });
});

describe("modelProliferation", () => {
  // Synthetic CFSE ladder: 4 generations, peaks at 8,7,6,5 (spacing 1), each a
  // tight Gaussian of 150 cells on the transformed dye axis.
  function ladder() {
    const r = mulberry32(5);
    const gauss = () => {
      const u1 = Math.max(r(), 1e-12);
      const u2 = r();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    };
    const vals: number[] = [];
    const truth = [0, 0, 0, 0];
    for (let gen = 0; gen < 4; gen++) {
      const center = 8 - gen;
      for (let i = 0; i < 150; i++) {
        vals.push(center + gauss() * 0.12);
        truth[gen]++;
      }
    }
    return { vals, truth };
  }

  test("detects the 4-peak generation ladder with unit spacing", () => {
    const { vals } = ladder();
    const { peaks, spacing } = detectGenerationPeaks(vals, { bins: 400 });
    expect(peaks.length).toBe(4);
    expect(spacing).toBeCloseTo(1, 1);
    expect(peaks[0]).toBeCloseTo(8, 1); // brightest = gen 0
  });

  test("assigns generations and computes plausible indices", () => {
    const { vals } = ladder();
    const m = modelProliferation(vals, { bins: 400 });
    expect(m.counts.length).toBe(4);
    // Each generation recovered near its true size (150) by nearest-peak rounding.
    for (let g = 0; g < 4; g++) expect(m.counts[g]).toBeGreaterThan(130);
    expect(m.total).toBe(600);
    // Raw-equal generations → ~47% of precursors divided (100·87.5/187.5).
    expect(m.percentDivided).toBeGreaterThan(35);
    expect(m.percentDivided).toBeLessThan(60);
    expect(m.proliferationIndex).toBeGreaterThan(1); // responders divided ≥ once
    expect(m.generations.length).toBe(600);
  });

  test("honors an explicit gen0 peak + spacing (no detection)", () => {
    const { vals } = ladder();
    const m = modelProliferation(vals, { gen0Peak: 8, spacing: 1, maxGen: 3 });
    expect(m.peaks).toHaveLength(0);
    expect(m.counts.reduce((s, c) => s + c, 0)).toBe(600);
  });
});
