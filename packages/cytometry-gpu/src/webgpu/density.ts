import type { GpuHandles } from "./device.ts";
import histogramWGSL from "./shaders/histogram.wgsl?raw";
import densityRenderWGSL from "./shaders/density_render.wgsl?raw";

/**
 * GPU density renderer — the interactive density path and the showcase of
 * compute->render buffer sharing. Events live in a STORAGE buffer; the compute
 * pass bins them into an atomic counter buffer; the render pass reads that SAME
 * buffer to colormap, with no CPU round-trip. On pan/zoom only the small Params
 * uniform changes, so re-binning is one dispatch.
 *
 * Loosely typed (`any` GPU handles) so the package builds without @webgpu/types;
 * the structure is production-faithful. Browser/WebGPU-only — not part of the
 * Bun test surface.
 */
export class WebGPUDensityRenderer {
  private device: any;
  private context: any;
  private format: string;
  private binCompute: any;
  private clearCompute: any;
  private renderPipeline: any;
  private eventsBuffer: any = null;
  private binsBuffer: any = null;
  private paramsBuffer: any;
  private renderParamsBuffer: any;
  private eventCount = 0;
  private binsX = 512;
  private binsY = 512;

  constructor(handles: GpuHandles) {
    this.device = handles.device;
    this.context = handles.context;
    this.format = handles.format;

    const histModule = this.device.createShaderModule({ code: histogramWGSL });
    const renderModule = this.device.createShaderModule({ code: densityRenderWGSL });

    this.clearCompute = this.device.createComputePipeline({
      layout: "auto",
      compute: { module: histModule, entryPoint: "clearBins" },
    });
    this.binCompute = this.device.createComputePipeline({
      layout: "auto",
      compute: { module: histModule, entryPoint: "binEvents" },
    });
    this.renderPipeline = this.device.createRenderPipeline({
      layout: "auto",
      vertex: { module: renderModule, entryPoint: "vs" },
      fragment: {
        module: renderModule,
        entryPoint: "fs",
        targets: [{ format: this.format }],
      },
      primitive: { topology: "triangle-list" },
    });

    this.paramsBuffer = this.device.createBuffer({
      size: 32, // 4 u32 + 4 f32
      usage: 0x40 | 0x8, // UNIFORM | COPY_DST
    });
    this.renderParamsBuffer = this.device.createBuffer({
      size: 16,
      usage: 0x40 | 0x8,
    });
  }

  /**
   * Upload event positions once (interleaved x,y display-space). Reuse across
   * frames; only re-upload when the underlying data or transform changes.
   */
  setEvents(positions: Float32Array): void {
    this.eventCount = positions.length / 2;
    if (this.eventsBuffer) this.eventsBuffer.destroy();
    this.eventsBuffer = this.device.createBuffer({
      size: positions.byteLength,
      usage: 0x80 | 0x8, // STORAGE | COPY_DST
    });
    this.device.queue.writeBuffer(this.eventsBuffer, 0, positions);
  }

  setBins(binsX: number, binsY: number): void {
    this.binsX = binsX;
    this.binsY = binsY;
    if (this.binsBuffer) this.binsBuffer.destroy();
    this.binsBuffer = this.device.createBuffer({
      size: binsX * binsY * 4,
      // STORAGE so both the compute and render passes bind it — the shared buffer.
      usage: 0x80 | 0x8,
    });
  }

  /** Bin + colormap for the current viewport. `maxCount` comes from a reduction
   *  or a prior CPU bin; for the scaffold it is supplied by the caller. */
  render(
    viewport: { xMin: number; xMax: number; yMin: number; yMax: number },
    maxCount: number,
  ): void {
    if (!this.eventsBuffer || !this.binsBuffer) return;
    const dev = this.device;

    const params = new ArrayBuffer(32);
    new Uint32Array(params, 0, 4).set([this.binsX, this.binsY, this.eventCount, 0]);
    new Float32Array(params, 16, 4).set([
      viewport.xMin,
      viewport.xMax,
      viewport.yMin,
      viewport.yMax,
    ]);
    dev.queue.writeBuffer(this.paramsBuffer, 0, params);

    const rparams = new Uint32Array([this.binsX, this.binsY, Math.max(1, maxCount), 0]);
    dev.queue.writeBuffer(this.renderParamsBuffer, 0, rparams);

    const computeBind = (pipeline: any) =>
      dev.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.paramsBuffer } },
          { binding: 1, resource: { buffer: this.eventsBuffer } },
          { binding: 2, resource: { buffer: this.binsBuffer } },
        ],
      });

    const encoder = dev.createCommandEncoder();

    const clearPass = encoder.beginComputePass();
    clearPass.setPipeline(this.clearCompute);
    clearPass.setBindGroup(0, computeBind(this.clearCompute));
    clearPass.dispatchWorkgroups(Math.ceil((this.binsX * this.binsY) / 256));
    clearPass.end();

    const binPass = encoder.beginComputePass();
    binPass.setPipeline(this.binCompute);
    binPass.setBindGroup(0, computeBind(this.binCompute));
    binPass.dispatchWorkgroups(Math.ceil(this.eventCount / 256));
    binPass.end();

    const view = this.context.getCurrentTexture().createView();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        { view, loadOp: "clear", storeOp: "store", clearValue: { r: 1, g: 1, b: 1, a: 1 } },
      ],
    });
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(
      0,
      dev.createBindGroup({
        layout: this.renderPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.renderParamsBuffer } },
          { binding: 1, resource: { buffer: this.binsBuffer } },
        ],
      }),
    );
    renderPass.draw(3);
    renderPass.end();

    dev.queue.submit([encoder.finish()]);
  }

  dispose(): void {
    this.eventsBuffer?.destroy();
    this.binsBuffer?.destroy();
  }
}
