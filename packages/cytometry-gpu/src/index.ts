/**
 * @joeee/cytometry-gpu — the rendering layer. WebGPU-first (the fast path), with
 * a Canvas2D fallback for compatibility and headless thumbnails. The pure parts
 * (colormap, densityToImage) are shared with the GPU shaders and unit-tested;
 * the WebGPU device code is feature-detected and degrades gracefully.
 */
export type {
  ColorMode,
  Renderer,
  ScatterFrame,
  Viewport,
} from "./renderer.ts";
export { sampleColormap, colormapNames } from "./colormap.ts";
export { densityToImage } from "./density-image.ts";
export type { DensityImage, DensityImageOptions } from "./density-image.ts";
export { axisTicks } from "./axis/ticks.ts";
export type { AxisOptions, Tick } from "./axis/ticks.ts";
export {
  displayToScreen,
  panViewport,
  screenToDisplay,
  zoomViewport,
} from "./interaction/viewport.ts";
export type { Pt } from "./interaction/viewport.ts";
export {
  movePolygonVertex,
  polygonFromScreen,
  rectFromDrag,
} from "./interaction/gates.ts";
export type { RectGeometry } from "./interaction/gates.ts";
export {
  detectWebGPU,
  initWebGPU,
  isCrossOriginIsolated,
} from "./webgpu/device.ts";
export type { GpuHandles } from "./webgpu/device.ts";
export { WebGPUDensityRenderer } from "./webgpu/density.ts";
export { Canvas2DRenderer } from "./canvas2d/fallback.ts";
