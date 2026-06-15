# @joeee/app-react

The reference UI for joeee — a Bun + Vite + React shell over the **agnostic
controller**. It is deliberately thin: it issues commands to an
`EngineController` and renders from its observable store. It never imports
`@joeee/cytometry-core` and never holds an `EventMatrix` — the engine + event
data live behind the controller (in a Web Worker in production). Swap React for
Solid/Svelte by re-implementing one hook; the engine is unchanged.

## Run

From the repo root:

```bash
bun i            # install workspace + app deps
bun run web      # this app (Vite dev, COOP/COEP isolated)
bun run both     # this app + test-watch
```

Or from here: `bun run dev` (dev), `bun run build` (→ `dist/`), `bun run preview`.

Production: `bun run build:web` then serve `app-react/dist` with the joeee server
(`bun run serve`) so the COOP/COEP headers are set (required for SharedArrayBuffer
+ threaded WASM).

## What's wired

- **Pages** — `ProjectsHub` (demo project + `.fcs` drag-drop/file-open) →
  the analysis workspace.
- **MenuBar** — File / Edit / View / Analysis / Transform / Help, dropdowns wired
  to operations.
- **OperationsPanel** (left) — Data, Compensation, Transform, Gating, Clustering,
  Dim-reduction, Statistics, History; each button calls a controller op.
- **Workspace tabs** —
  - **Density**: real density plot with pan, wheel-zoom-about-cursor,
    rectangle-gate drawing, logicle axis ticks, X/Y channel selectors.
  - **Embedding**: PCA/UMAP/t-SNE scatter colored by the last clustering.
  - **Heatmap**: real cluster × marker enrichment z-scores.
  - **Stats**: per-population statistics table.
- **Inspector** — gate tree + live stats. **Console** — operation log.
- **Export/import** — workspace JSON + gated CSV download; Gating-ML 2.0 import.

## Structure

```
src/
├── main.tsx              bootstrap: constructs the controller + renders <App>
├── App.tsx              workspace layout + the `actions` object (every operation)
├── actions.ts          Actions + Tab types shared by menus and sidebar
├── useController.ts    useWorkspace = useSyncExternalStore(controller.store)
├── synth.ts            synthetic demo sample
├── util/download.ts    browser file download
└── components/
    ├── MenuBar.tsx · OperationsPanel.tsx · ProjectsHub.tsx · ConsolePanel.tsx
    ├── PlotCanvas.tsx (density) · EmbeddingPlot.tsx · HeatmapPlot.tsx · StatsTable.tsx
    ├── AxisBar.tsx · GateTree.tsx · StatsPanel.tsx · Toolbar.tsx
```

The single binding to the engine is `useController.ts`. Everything else is
presentation that reads `controller.store` and calls `controller.*`.

## Notes

- For real data at scale, construct the controller with the **Worker backend**
  (`createWorkerBackend(new Worker(new URL("@joeee/engine-controller/worker", import.meta.url), { type: "module" }))`)
  so the engine runs off the main thread; `main.tsx` uses the in-process backend
  for the demo and documents the swap.
- The plots are "initial wiring" — the Density tab is a real interactive renderer;
  Embedding/Heatmap/Stats render real engine results with straightforward
  canvas/table visualizations.
