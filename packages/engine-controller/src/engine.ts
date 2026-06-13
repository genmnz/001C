import {
  EventMatrix,
  Population,
  compensation,
  defaultKernels,
  density,
  evaluate1D,
  evaluate2D,
  stats as coreStats,
  type ChannelMeta,
  type Kernels,
} from "@joeee/cytometry-core";
import { parseFcs } from "@joeee/fcs";
import {
  isGate1D,
  makeGate1D,
  makeGate2D,
  makeTransform,
  transformKey,
} from "./factories.ts";
import type {
  Bin2DRequest,
  EvaluateGateRequest,
  SampleInfo,
  SpilloverSpec,
  StatsRequest,
} from "./protocol.ts";

/**
 * The headless engine: the only place that holds EventMatrices and Populations.
 * In production this runs inside a Web Worker (see worker/engine.worker.ts); in
 * tests it runs in-process. Either way the controller talks to it through the
 * EngineApi, so the orchestration logic here is fully unit-testable under Bun.
 *
 * Display columns (raw values run through a scale transform) are cached per
 * (sample, channel, transform): gating and binning both consume them, and on a
 * gate drag only the gate re-evaluates — the transformed columns are reused.
 */
export class Engine {
  private samples = new Map<string, EventMatrix>();
  private populations = new Map<string, Population>();
  private displayCache = new Map<string, Float32Array>();
  private spillovers = new Map<string, SpilloverSpec>();
  private popCounter = 0;

  /**
   * @param kernels hot-loop backend. Defaults to pure TS; pass WasmKernels
   * (built from joeee-cytometry-wasm) for the SIMD path — nothing else changes.
   */
  constructor(private readonly kernels: Kernels = defaultKernels()) {}

  addColumns(
    name: string,
    channels: ChannelMeta[],
    columns: ArrayLike<number>[],
  ): SampleInfo {
    const eventCount = columns[0]?.length ?? 0;
    const m = EventMatrix.allocate(eventCount, channels);
    for (let c = 0; c < channels.length; c++) m.column(c).set(columns[c]);
    this.samples.set(name, m);
    return { id: name, name, eventCount, channels };
  }

  loadFcs(name: string, buffer: ArrayBuffer | Uint8Array): SampleInfo {
    const f = parseFcs(buffer);
    const channels: ChannelMeta[] = f.channels.map((c) => ({
      name: c.name,
      label: c.label,
      range: c.range,
    }));
    // f.data is already column-major Float32 in EventMatrix's exact layout.
    const m = EventMatrix.fromBuffer(f.eventCount, channels, f.data.buffer);
    this.samples.set(name, m);
    if (f.spillover) {
      this.spillovers.set(name, {
        channels: f.spillover.channels,
        values: Array.from(f.spillover.values),
      });
    }
    return {
      id: name,
      name,
      eventCount: f.eventCount,
      channels,
      warnings: f.warnings,
      hasSpillover: f.spillover != null,
    };
  }

  /**
   * Apply compensation to a sample's columns in place. Uses the provided
   * spillover or the one parsed from the sample's FCS ($SPILLOVER). Invalidates
   * cached display columns for the sample so subsequent binning/gating see the
   * compensated values.
   */
  compensate(sampleId: string, spill?: SpilloverSpec): void {
    const matrix = this.must(sampleId);
    const s = spill ?? this.spillovers.get(sampleId);
    if (!s) throw new Error(`engine: no spillover for sample "${sampleId}"`);
    compensation.applyCompensation(matrix, {
      channels: s.channels,
      values: Float64Array.from(s.values),
    });
    // Drop stale display columns for this sample.
    for (const key of [...this.displayCache.keys()]) {
      if (key.startsWith(`${sampleId}|`)) this.displayCache.delete(key);
    }
  }

  private must(sampleId: string): EventMatrix {
    const m = this.samples.get(sampleId);
    if (!m) throw new Error(`engine: unknown sample "${sampleId}"`);
    return m;
  }

  private displayColumn(
    sampleId: string,
    channel: string,
    transform: Parameters<typeof makeTransform>[0],
  ): Float32Array {
    const key = `${sampleId}|${channel}|${transformKey(transform)}`;
    const cached = this.displayCache.get(key);
    if (cached) return cached;
    const raw = this.must(sampleId).columnByName(channel);
    const col = new Float32Array(raw); // copy raw values, then transform in place
    if (transform.kind === "logicle") {
      // Hot path: routed through the kernel backend (TS or WASM SIMD).
      this.kernels.logicleScaleInto(
        col,
        transform.T ?? 262144,
        transform.W ?? 0.5,
        transform.M ?? 4.5,
        transform.A ?? 0,
      );
    } else {
      const t = makeTransform(transform);
      for (let i = 0; i < col.length; i++) col[i] = t.scale(col[i]);
    }
    this.displayCache.set(key, col);
    return col;
  }

  bin2d(req: Bin2DRequest): density.Bins2D {
    const xs = this.displayColumn(req.sampleId, req.xChannel, req.transform);
    const ys = this.displayColumn(req.sampleId, req.yChannel, req.transform);
    const parent = req.parentPopId
      ? this.populations.get(req.parentPopId)
      : undefined;
    return density.histogram2d(xs, ys, {
      binsX: req.binsX,
      binsY: req.binsY,
      xMin: req.viewport.xMin,
      xMax: req.viewport.xMax,
      yMin: req.viewport.yMin,
      yMax: req.viewport.yMax,
      parent,
    });
  }

  evaluateGate(req: EvaluateGateRequest): { populationId: string; count: number } {
    const parent = req.parentPopId
      ? this.populations.get(req.parentPopId)
      : undefined;
    let pop: Population;
    if (isGate1D(req.gate)) {
      const xs = this.displayColumn(req.sampleId, req.gate.channel, req.transform);
      pop = evaluate1D(makeGate1D(req.gate), xs, parent);
    } else if (req.gate.kind === "polygon") {
      // Hot path: point-in-polygon via the kernel backend (TS or WASM SIMD).
      const g = req.gate;
      const xs = this.displayColumn(req.sampleId, g.xChannel, req.transform);
      const ys = this.displayColumn(req.sampleId, g.yChannel, req.transform);
      const polyX = Float64Array.from(g.vertices, (v) => v[0]);
      const polyY = Float64Array.from(g.vertices, (v) => v[1]);
      const mask = this.kernels.polygonMask(xs, ys, polyX, polyY);
      pop = new Population(xs.length);
      if (parent) parent.forEach((i) => mask[i] && pop.set(i));
      else for (let i = 0; i < mask.length; i++) if (mask[i]) pop.set(i);
    } else {
      const xs = this.displayColumn(req.sampleId, req.gate.xChannel, req.transform);
      const ys = this.displayColumn(req.sampleId, req.gate.yChannel, req.transform);
      pop = evaluate2D(makeGate2D(req.gate), xs, ys, parent);
    }
    const id = req.populationId ?? `pop_${++this.popCounter}`;
    this.populations.set(id, pop);
    return { populationId: id, count: pop.count() };
  }

  stats(req: StatsRequest): coreStats.ChannelStats & coreStats.Frequency {
    const m = this.must(req.sampleId);
    const pop =
      this.populations.get(req.populationId) ?? Population.all(m.eventCount);
    const column = req.transform
      ? this.displayColumn(req.sampleId, req.channel, req.transform)
      : m.columnByName(req.channel);
    const cs = coreStats.channelStats(pop, column);
    const parent = req.parentPopId
      ? (this.populations.get(req.parentPopId) ?? null)
      : null;
    const fr = coreStats.frequency(pop, parent, m.eventCount);
    return { ...cs, ...fr };
  }
}
