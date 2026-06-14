import type { ChannelMeta, density } from "@joeee/cytometry-core";
import type { EngineApi } from "./backend.ts";
import { Store } from "./store.ts";
import { parseGatingML } from "./interop/gatingml.ts";
import {
  deserializeWorkspace,
  serializeWorkspace,
  topoSortGates,
  type SerializedGate,
  type WorkspaceDoc,
} from "./workspace.ts";
import type {
  GateNode,
  GateSpec,
  SampleInfo,
  SpilloverSpec,
  TransformSpec,
  Viewport,
  WorkspaceState,
} from "./protocol.ts";

function initialState(): WorkspaceState {
  return {
    samples: {},
    activeSampleId: null,
    axes: { x: "", y: "" },
    transform: { kind: "logicle" },
    gates: [],
    stats: {},
    status: "idle",
  };
}

let gateCounter = 0;

/**
 * The single object a UI interacts with. Commands go in (loadSample, setAxes,
 * addGate, ...); the UI reads `controller.store` and re-renders on change.
 *
 * Density/bin results are RETURNED to the caller (the renderer), never stored in
 * view state — they are render payloads, not UI state. This keeps the same
 * "big data stays out of the framework" discipline even for derived data.
 */
export class EngineController {
  readonly store = new Store<WorkspaceState>(initialState());

  // Undo/redo history of (serializable) view-state snapshots.
  private past: WorkspaceState[] = [];
  private future: WorkspaceState[] = [];
  private suppressHistory = false;
  private readonly historyLimit = 100;

  constructor(private readonly api: EngineApi) {}

  /** Snapshot current view-state before a mutating command. */
  private record(): void {
    if (this.suppressHistory) return;
    this.past.push(this.store.get());
    if (this.past.length > this.historyLimit) this.past.shift();
    this.future = [];
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }
  canRedo(): boolean {
    return this.future.length > 0;
  }
  /** Restore the previous view-state. Returns false if nothing to undo. */
  undo(): boolean {
    const prev = this.past.pop();
    if (!prev) return false;
    this.future.push(this.store.get());
    this.store.set(prev); // full key set -> full replace
    return true;
  }
  redo(): boolean {
    const next = this.future.pop();
    if (!next) return false;
    this.past.push(this.store.get());
    this.store.set(next);
    return true;
  }

  async loadSample(
    name: string,
    buffer: ArrayBuffer | Uint8Array,
  ): Promise<SampleInfo> {
    this.record();
    this.store.set({ status: "loading" });
    const info = await this.api.loadFcs(name, buffer);
    this.adoptSample(info);
    return info;
  }

  async addSampleFromColumns(
    name: string,
    channels: ChannelMeta[],
    columns: ArrayLike<number>[],
  ): Promise<SampleInfo> {
    this.record();
    this.store.set({ status: "loading" });
    const info = await this.api.addColumns(name, channels, columns);
    this.adoptSample(info);
    return info;
  }

  private adoptSample(info: SampleInfo): void {
    this.store.set((s) => {
      const firstTwo = info.channels.slice(0, 2).map((c) => c.name);
      const axes =
        s.axes.x === "" && firstTwo.length === 2
          ? { x: firstTwo[0], y: firstTwo[1] }
          : s.axes;
      return {
        samples: { ...s.samples, [info.id]: info },
        activeSampleId: info.id,
        axes,
        status: "idle",
      };
    });
  }

  setAxes(x: string, y: string): void {
    this.record();
    this.store.set({ axes: { x, y } });
  }

  /**
   * Apply compensation to the active sample (using the given spillover or the
   * one parsed from its FCS). Compensate BEFORE gating — existing gates are not
   * re-evaluated. Marks the sample compensated in view state.
   */
  async compensate(spill?: SpilloverSpec): Promise<void> {
    const { activeSampleId } = this.store.get();
    if (!activeSampleId) throw new Error("no active sample");
    this.record();
    this.store.set({ status: "computing" });
    await this.api.compensate(activeSampleId, spill);
    this.store.set((s) => ({
      samples: {
        ...s.samples,
        [activeSampleId]: { ...s.samples[activeSampleId], compensated: true },
      },
      status: "idle",
    }));
  }

  setTransform(transform: TransformSpec): void {
    this.record();
    this.store.set({ transform });
  }

  /** Compute the 2D density histogram for the current axes/viewport — for the renderer. */
  async density(
    viewport: Viewport,
    binsX = 512,
    binsY = 512,
    parentPopId?: string,
  ): Promise<density.Bins2D> {
    const { activeSampleId, axes, transform } = this.store.get();
    if (!activeSampleId) throw new Error("no active sample");
    return this.api.bin2d({
      sampleId: activeSampleId,
      xChannel: axes.x,
      yChannel: axes.y,
      transform,
      viewport,
      binsX,
      binsY,
      parentPopId,
    });
  }

  /** Create a gate, evaluate it in the engine, and record it in the gate tree. */
  async addGate(
    spec: GateSpec,
    opts: { name?: string; parentId?: string | null; color?: string } = {},
  ): Promise<GateNode> {
    this.record();
    this.store.set({ status: "computing" });
    const { activeSampleId, transform, gates } = this.store.get();
    if (!activeSampleId) throw new Error("no active sample");
    const parentId = opts.parentId ?? null;
    const parentPopId = parentId
      ? gates.find((g) => g.id === parentId)?.populationId
      : undefined;
    const { populationId, count } = await this.api.evaluateGate({
      sampleId: activeSampleId,
      gate: spec,
      transform,
      parentPopId,
    });
    const node: GateNode = {
      id: `gate_${++gateCounter}`,
      name: opts.name ?? `Gate ${gateCounter}`,
      spec,
      parentId,
      populationId,
      count,
      color: opts.color,
    };
    this.store.set((s) => ({ gates: [...s.gates, node], status: "idle" }));
    return node;
  }

  /** Recompute stats for a gate's population on a channel and cache in view state. */
  async refreshStats(
    gateId: string,
    channel: string,
    transform?: TransformSpec,
  ): Promise<void> {
    const { activeSampleId, gates } = this.store.get();
    if (!activeSampleId) throw new Error("no active sample");
    const node = gates.find((g) => g.id === gateId);
    if (!node) throw new Error(`unknown gate ${gateId}`);
    const r = await this.api.stats({
      sampleId: activeSampleId,
      populationId: node.populationId,
      channel,
      transform,
      parentPopId: node.parentId
        ? gates.find((g) => g.id === node.parentId)?.populationId
        : undefined,
    });
    this.store.set((s) => ({
      stats: {
        ...s.stats,
        [`${node.populationId}:${channel}`]: {
          count: r.count,
          median: r.median,
          mean: r.mean,
          geometricMean: r.geometricMean,
          cv: r.cv,
          ofParent: r.ofParent,
          ofTotal: r.ofTotal,
        },
      },
    }));
  }

  /** Serialize the analysis (gates, transform, axes, sample metadata) to a doc. */
  exportWorkspace(): WorkspaceDoc {
    return serializeWorkspace(this.store.get());
  }

  /**
   * Restore an analysis onto the currently-loaded sample: sets axes/transform,
   * then re-evaluates every gate (parents first) so populations are rebuilt.
   * The sample(s) must already be loaded (event data is not part of the doc).
   */
  async importWorkspace(doc: WorkspaceDoc): Promise<void> {
    this.record();
    const { axes, transform, gates } = deserializeWorkspace(doc);
    this.store.set({ axes, transform, gates: [] });
    await this.rebuildGates(gates);
  }

  /**
   * Import a Gating-ML 2.0 document and evaluate its gates against the active
   * sample under the current transform (does not change axes/transform). Returns
   * the number of gates created. See interop/gatingml.ts for supported gates.
   */
  async importGatingML(xml: string): Promise<number> {
    this.record();
    const gates = topoSortGates(parseGatingML(xml));
    await this.rebuildGates(gates);
    return gates.length;
  }

  /** Re-evaluate serialized gates (parents first) as a single history unit. */
  private async rebuildGates(gates: SerializedGate[]): Promise<void> {
    const wasSuppressed = this.suppressHistory;
    this.suppressHistory = true;
    try {
      const oldToNew = new Map<string, string>();
      for (const sg of gates) {
        const parentId = sg.parentId ? (oldToNew.get(sg.parentId) ?? null) : null;
        const node = await this.addGate(sg.spec, {
          name: sg.name,
          parentId,
          color: sg.color,
        });
        oldToNew.set(sg.id, node.id);
      }
    } finally {
      this.suppressHistory = wasSuppressed;
    }
  }
}
