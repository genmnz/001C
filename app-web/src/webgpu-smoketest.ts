import { density } from "@joeee/cytometry-core";
import {
  WebGPUDensityRenderer,
  detectWebGPU,
  initWebGPU,
  isCrossOriginIsolated,
} from "@joeee/cytometry-gpu";

/**
 * Manual on-device check for the things CI can't run: a real WebGPU device, the
 * compute->render shared STORAGE buffer, and cross-origin isolation. Open in a
 * browser served with COOP/COEP. Proves the Phase-0 platform risk is cleared.
 */
const log = document.getElementById("log")!;
const lines: string[] = [];
const say = (msg: string, cls = "") => {
  lines.push(cls ? `<span class="${cls}">${msg}</span>` : msg);
  log.innerHTML = lines.join("\n");
};

async function run(): Promise<void> {
  say(`crossOriginIsolated: ${isCrossOriginIsolated()}`, isCrossOriginIsolated() ? "ok" : "bad");
  say(`SharedArrayBuffer: ${typeof SharedArrayBuffer !== "undefined"}`);
  say(`navigator.gpu present: ${detectWebGPU()}`, detectWebGPU() ? "ok" : "bad");
  if (!detectWebGPU()) {
    say("WebGPU unavailable — update your browser, or use the Canvas2D fallback.", "bad");
    return;
  }

  const canvas = document.getElementById("c") as HTMLCanvasElement;
  const handles = await initWebGPU(canvas);
  if (!handles) {
    say("Failed to acquire a WebGPU device/adapter.", "bad");
    return;
  }
  say("WebGPU device acquired.", "ok");

  // Two synthetic clusters in display space [0,1].
  const n = 200_000;
  const positions = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    const lower = i < n * 0.6;
    positions[i * 2] = (lower ? 0.3 : 0.7) + (Math.random() - 0.5) * 0.2;
    positions[i * 2 + 1] = (lower ? 0.35 : 0.75) + (Math.random() - 0.5) * 0.2;
  }

  // CPU bins (source of truth) only to get the max for color normalization.
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = positions[i * 2];
    ys[i] = positions[i * 2 + 1];
  }
  const cpu = density.histogram2d(xs, ys, {
    binsX: 512,
    binsY: 512,
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
  });

  const renderer = new WebGPUDensityRenderer(handles);
  renderer.setEvents(positions);
  renderer.setBins(512, 512);
  const t0 = performance.now();
  renderer.render({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, cpu.max);
  const dt = performance.now() - t0;

  say(`Compute->render of ${n.toLocaleString()} events in ${dt.toFixed(1)} ms.`, "ok");
  say("If you see two colored blobs above, the shared STORAGE buffer path works.", "ok");
}

run().catch((e) => say(`error: ${String(e)}`, "bad"));
