import { describe, expect, test } from "bun:test";
import { detectWebGPU, isCrossOriginIsolated } from "../src/webgpu/device.ts";

describe("feature detection", () => {
  test("detectWebGPU returns false in a non-browser/headless env (no navigator.gpu)", () => {
    // The contract: never throw, just report absence so the app can degrade.
    expect(detectWebGPU()).toBe(false);
  });
  test("isCrossOriginIsolated is false when COOP/COEP are not set", () => {
    expect(isCrossOriginIsolated()).toBe(false);
  });
});
