# Plots & view modes

The catalog of plot types and workspace view modes, and the rendering stack that
produces them. Curated from the UX spec into MVP-now vs later, because the spec
is a north star, not a sprint (see `docs/DERISKING.md`).

## Rendering stack (what we agreed on)

| Layer | Choice | Why |
|---|---|---|
| Event cloud (scatter/density) | **own WebGPU** (`@joeee/cytometry-gpu`) | millions of points at 60fps; GPU 2D-histogram density; compute→render buffer sharing. deck.gl/regl are WebGL-era and do too much CPU-side for this. |
| Density bins / stats | **`@joeee/cytometry-core`** (CPU, source of truth) | headless, testable; the WebGPU compute pass mirrors it bin-for-bin. |
| Compatibility / thumbnails | **Canvas2D fallback** | small-N, Firefox-Linux/old-iOS, server-side figures. |
| Axes, ticks, scales | **own logicle-aware `axisTicks`** + d3-scale/d3-axis for linear/categorical | no library places logicle ticks correctly (linear through ±W, log beyond); we own that, lean on D3 for the rest. |
| Contours | **`d3-contour`** over engine density bins | marching-squares on our histogram; D3 as a toolkit, not a renderer. |
| Gate handles / overlays | **SVG (or Canvas2D) layer above the GL canvas** | crisp, hit-testable vector handles; the cloud stays on the GPU. |
| Color | **own colormap** (viridis/inferno), shared CPU+WGSL | identical density coloring across backends. |

**Not used:** deck.gl, regl, Plotly, Chart.js as the cloud renderer — all WebGL/
DOM-era and CPU-bound at this scale. They may appear later for non-cloud panels
(bar/box) where convenience beats raw throughput.

## Plot types

Each maps to an engine primitive (the data) and a renderer (the pixels). ✅ = MVP
scaffolded, ◑ = data path exists/needs renderer wiring, ○ = later.

| Plot | Engine primitive | Renderer | Status |
|---|---|---|---|
| Dot / scatter | display columns | WebGPU instanced points | ◑ (renderer present) |
| **Density / pseudocolor scatter** | `density.histogram2d` | WebGPU compute + colormap / Canvas2D | ✅ |
| Hexbin scatter | hex binning (variant of histogram2d) | WebGPU | ○ |
| Contour scatter | `histogram2d` → `d3-contour` | SVG/Canvas2D over GL | ◑ |
| Backgated scatter | parent `Population` mask + columns | WebGPU (dim background, highlight gated) | ◑ |
| **Histogram (1D)** | `density.histogram1d` | Canvas2D / WebGPU bars | ◑ |
| Overlay / stacked / ridgeline histogram | multiple `histogram1d` | Canvas2D | ○ |
| 2D KDE / filled contour | `histogram2d` + smoothing | `d3-contour` | ○ |
| Gate overlay + stats | `Gate*` geometry + `frequency` | SVG handles + text | ◑ |
| Quadrant plot | `gating.quadrant` (4 populations) | WebGPU + SVG crosshair | ◑ |
| t-SNE / UMAP / PCA embedding | deferred compute → 2 columns | WebGPU scatter (reuses cloud) | ○ |
| Cluster scatter (colored by cluster) | deferred clustering → label column | WebGPU scatter + categorical color | ○ |
| Marker/cluster expression heatmap | `channelStats` per population×marker | Canvas2D / SVG grid | ○ |
| Violin / box / swarm / bar | `percentile`/`channelStats` per group | SVG (d3) | ○ |
| QC plots (event-length, time-drift, doublets) | columns vs time / FSC-A·H | WebGPU scatter / Canvas2D | ○ |

Anything marked ◑/○ needs UI wiring, not new engine math — the primitives
(`histogram1d/2d`, `Population`, `channelStats`, `frequency`, `quadrant`,
`axisTicks`) already exist and are tested.

## View modes (workspace presets)

The UX spec lists ten; the honest MVP is the first three. Each mode is just a
saved layout of plots + panels reading the same controller store.

| Mode | Purpose | MVP? |
|---|---|---|
| **Gating** | scatter/density + gate tree + live stats; draw gates | ✅ target |
| **QC** | small-multiples of QC plots, pass/warn/fail | next |
| **Exploration** | one big embedding (UMAP/t-SNE) + marker coloring | later |
| Clustering | embedding colored by cluster + per-cluster expression | later |
| Statistics | comparison tables + violin/box across groups | later |
| Figure builder | drag plots onto a canvas, publication export | later |
| Reporting | WYSIWYG report from pipeline metadata | later |
| (Collaboration / ML / Batch / Pipeline) | — | post-MVP |

## How a plot gets drawn (the wiring)

1. UI picks axes + transform on the controller (`setAxes`, `setTransform`).
2. UI asks the controller for render data: `controller.density(viewport, w, h)`
   (or, later, scatter positions / a 1D histogram).
3. Renderer draws it: `WebGPUDensityRenderer.render(...)` or
   `Canvas2DRenderer.drawDensity(bins)`.
4. Axis layer: `axisTicks(transform, { dataMin, dataMax, pxStart, pxEnd })` →
   draw ticks/labels in the SVG overlay.
5. Gates: SVG overlay emits a `GateSpec` (rectangle drawing wired today;
   `rectFromDrag`/`polygonFromScreen`/`movePolygonVertex` are pure + fuzz-tested);
   `controller.addGate(spec)` evaluates it and the gate tree + stats update from
   the store. Pan/zoom (`panViewport`/`zoomViewport`) transform the viewport the
   density query uses.

The big arrays never touch the UI — only viewport/axis/gate *intent* goes in, and
bins/positions/counts come back out.
