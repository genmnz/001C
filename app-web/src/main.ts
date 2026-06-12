import {
  EngineController,
  createInProcessBackend,
  // To move the engine off the main thread (recommended for real data):
  //   import { createWorkerBackend } from "@joeee/engine-controller";
  //   const worker = new Worker(new URL("@joeee/engine-controller/worker", import.meta.url), { type: "module" });
  //   const backend = createWorkerBackend(worker);
  type WorkspaceState,
} from "@joeee/engine-controller";
import {
  Canvas2DRenderer,
  detectWebGPU,
  isCrossOriginIsolated,
} from "@joeee/cytometry-gpu";

/**
 * Reference UI — deliberately vanilla. It demonstrates the contract: the UI
 * constructs a controller, issues commands, and renders from controller.store.
 * It never imports @joeee/cytometry-core and never touches an EventMatrix.
 * Replace this file with a React/Solid/Svelte app and the engine is unchanged.
 */

const $ = (id: string) => document.getElementById(id)!;

/** Two synthetic clusters so the demo has structure without a real FCS file. */
function synthClusters(n = 80_000): { fsc: Float32Array; cd3: Float32Array } {
  const fsc = new Float32Array(n);
  const cd3 = new Float32Array(n);
  const gauss = () =>
    (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2;
  for (let i = 0; i < n; i++) {
    const lower = i < n * 0.6;
    const cx = lower ? 800 : 40_000;
    const cy = lower ? 1_200 : 35_000;
    fsc[i] = Math.max(1, cx + gauss() * cx * 0.5);
    cd3[i] = Math.max(1, cy + gauss() * cy * 0.5);
  }
  return { fsc, cd3 };
}

async function main(): Promise<void> {
  const canvas = $("plot") as HTMLCanvasElement;
  const renderer = new Canvas2DRenderer(canvas);
  const controller = new EngineController(createInProcessBackend());

  $("backend").textContent = isCrossOriginIsolated()
    ? `WebGPU ${detectWebGPU() ? "available" : "unavailable"} · cross-origin isolated`
    : "NOT cross-origin isolated — run via the joeee server (COOP/COEP). Using Canvas2D.";

  // Render whenever view state changes — the only coupling between UI and engine.
  controller.store.subscribe((state) => paint(state));

  const { fsc, cd3 } = synthClusters();
  await controller.addSampleFromColumns(
    "demo.fcs",
    [{ name: "FSC-A" }, { name: "CD3" }],
    [fsc, cd3],
  );
  controller.setTransform({ kind: "logicle", T: 262144, W: 0.5, M: 4.5, A: 0 });

  const viewport = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };

  async function redraw(): Promise<void> {
    const bins = await controller.density(viewport, canvas.width, canvas.height);
    renderer.drawDensity(bins, "viridis", "log");
  }
  await redraw();

  $("add-gate").addEventListener("click", async () => {
    // A rectangle in DISPLAY (logicle) space grabbing the upper-right cluster.
    const gate = await controller.addGate({
      kind: "rectangle",
      xChannel: "FSC-A",
      yChannel: "CD3",
      xMin: 0.55,
      xMax: 1,
      yMin: 0.55,
      yMax: 1,
    });
    await controller.refreshStats(gate.id, "FSC-A");
    await redraw();
  });
}

function paint(state: WorkspaceState): void {
  const sample = state.activeSampleId ? state.samples[state.activeSampleId] : null;
  $("sample").textContent = sample
    ? `${sample.name} · ${sample.eventCount.toLocaleString()} events · ${sample.channels.length} channels`
    : "—";
  $("gates").innerHTML =
    state.gates.length === 0
      ? "—"
      : state.gates
          .map((g) => `${g.name}: ${g.count.toLocaleString()} events`)
          .join("<br/>");
  $("stats").textContent = JSON.stringify(state.stats, null, 2);
}

main().catch((e) => {
  document.getElementById("sample")!.textContent = `error: ${String(e)}`;
});
