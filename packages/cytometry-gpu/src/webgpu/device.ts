/**
 * WebGPU device acquisition with graceful feature detection. WebGPU requires a
 * secure context (HTTPS/localhost) and a recent browser. Per the de-risking doc
 * the app is WebGPU-first with NO WebGL2 fallback, so the contract here is:
 * detect, and if absent, the caller shows "please update your browser" or falls
 * back to the Canvas2D renderer for small samples.
 *
 * GPU handles are typed loosely (`any`) so this package builds without pulling in
 * @webgpu/types; production should add that dev dependency for full typing.
 */
export interface GpuHandles {
  device: any; // GPUDevice
  context: any; // GPUCanvasContext
  format: string; // GPUTextureFormat
}

export function detectWebGPU(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof (navigator as any).gpu !== "undefined"
  );
}

export function isCrossOriginIsolated(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    (globalThis as any).crossOriginIsolated === true
  );
}

export async function initWebGPU(
  canvas: HTMLCanvasElement,
): Promise<GpuHandles | null> {
  if (!detectWebGPU()) return null;
  const gpu = (navigator as any).gpu;
  const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  // Cast: the WebGPU context type needs @webgpu/types, which we leave to the app.
  const context = canvas.getContext("webgpu") as any;
  if (!context) return null;
  const format = gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "premultiplied" });
  return { device, context, format };
}
