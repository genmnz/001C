import type { ChannelMeta, density, stats } from "@joeee/cytometry-core";
import { Engine } from "./engine.ts";
import type {
  Bin2DRequest,
  ClusterRequest,
  ClusterResult,
  EmbedRequest,
  EmbedResult,
  EvaluateGateRequest,
  SampleInfo,
  SpilloverSpec,
  StatsRequest,
} from "./protocol.ts";

/**
 * The contract between the controller and the engine. The controller is written
 * against this interface only, so the same controller drives either an
 * in-process engine (tests, SSR thumbnails) or a Worker-hosted engine (the app)
 * with no code change. This IS the headless/UI separation boundary.
 */
export interface EngineApi {
  loadFcs(name: string, buffer: ArrayBuffer | Uint8Array): Promise<SampleInfo>;
  addColumns(
    name: string,
    channels: ChannelMeta[],
    columns: ArrayLike<number>[],
  ): Promise<SampleInfo>;
  bin2d(req: Bin2DRequest): Promise<density.Bins2D>;
  evaluateGate(
    req: EvaluateGateRequest,
  ): Promise<{ populationId: string; count: number }>;
  stats(req: StatsRequest): Promise<stats.ChannelStats & stats.Frequency>;
  compensate(sampleId: string, spill?: SpilloverSpec): Promise<void>;
  cluster(req: ClusterRequest): Promise<ClusterResult>;
  embed(req: EmbedRequest): Promise<EmbedResult>;
}

/** Runs the engine synchronously in the current thread. */
export function createInProcessBackend(engine = new Engine()): EngineApi {
  return {
    loadFcs: async (name, buffer) => engine.loadFcs(name, buffer),
    addColumns: async (name, channels, columns) =>
      engine.addColumns(name, channels, columns),
    bin2d: async (req) => engine.bin2d(req),
    evaluateGate: async (req) => engine.evaluateGate(req),
    stats: async (req) => engine.stats(req),
    compensate: async (sampleId, spill) => engine.compensate(sampleId, spill),
    cluster: async (req) => engine.cluster(req),
    embed: async (req) => engine.embed(req),
  };
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
}

/**
 * Drives an engine hosted in a Web Worker via RPC. Construct the worker in the
 * app (so the bundler wires the module URL) and hand it here:
 *
 *   const worker = new Worker(new URL("@joeee/engine-controller/worker", import.meta.url), { type: "module" });
 *   const api = createWorkerBackend(worker);
 */
export function createWorkerBackend(worker: Worker): EngineApi {
  let seq = 0;
  const pending = new Map<number, Pending>();
  worker.onmessage = (ev: MessageEvent) => {
    const { id, ok, result, error } = ev.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (ok) p.resolve(result);
    else p.reject(new Error(error));
  };
  const call = <T>(method: string, args: unknown[]): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ id, method, args });
    });
  return {
    loadFcs: (name, buffer) => call("loadFcs", [name, buffer]),
    addColumns: (name, channels, columns) =>
      call("addColumns", [name, channels, columns]),
    bin2d: (req) => call("bin2d", [req]),
    evaluateGate: (req) => call("evaluateGate", [req]),
    stats: (req) => call("stats", [req]),
    compensate: (sampleId, spill) => call("compensate", [sampleId, spill]),
    cluster: (req) => call("cluster", [req]),
    embed: (req) => call("embed", [req]),
  };
}
