import type { ChannelMeta } from "@joeee/cytometry-core";

/**
 * Serializable descriptions of transforms and gates. These cross the Worker
 * boundary as plain data (structured-clone safe), so the controller and the
 * engine agree on intent without sharing class instances. Factories in
 * factories.ts turn these specs into live @joeee/cytometry-core objects inside
 * the engine.
 */
export type TransformSpec =
  | { kind: "logicle"; T?: number; W?: number; M?: number; A?: number }
  | { kind: "hyperlog"; T?: number; W?: number; M?: number; A?: number }
  | { kind: "asinh"; T?: number; M?: number; A?: number }
  | { kind: "asinh-cofactor"; cofactor?: number }
  | { kind: "log"; T?: number; M?: number }
  | { kind: "linear"; T?: number; A?: number };

export type GateSpec =
  | {
      kind: "rectangle";
      xChannel: string;
      yChannel: string;
      xMin: number;
      xMax: number;
      yMin: number;
      yMax: number;
    }
  | {
      kind: "polygon";
      xChannel: string;
      yChannel: string;
      vertices: [number, number][];
    }
  | {
      kind: "ellipse";
      xChannel: string;
      yChannel: string;
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      angle?: number;
    }
  | { kind: "range"; channel: string; min: number; max: number };

export interface Viewport {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface SampleInfo {
  id: string;
  name: string;
  eventCount: number;
  channels: ChannelMeta[];
  warnings?: string[];
  /** A $SPILLOVER/$COMP matrix was found in the FCS and can be applied. */
  hasSpillover?: boolean;
  /** Compensation has been applied to this sample's columns. */
  compensated?: boolean;
}

/** A spillover matrix, structured-clone-safe for the worker boundary. */
export interface SpilloverSpec {
  channels: string[];
  /** Row-major n*n values. */
  values: number[];
}

/** A node in the gate tree. Holds geometry + identity, NOT the population bits. */
export interface GateNode {
  id: string;
  name: string;
  spec: GateSpec;
  parentId: string | null;
  populationId: string;
  count: number;
  color?: string;
}

/**
 * The view state a UI renders. Deliberately small: sample/channel METADATA,
 * gate geometry, axis selections, and computed numbers — never the event
 * matrices or population bitsets. Those live in the engine/worker. This is the
 * rule that keeps interactivity alive at millions of events.
 */
/** A reusable gate (geometry) saveable and applicable across samples/axes. */
export interface GateTemplate {
  id: string;
  name: string;
  spec: GateSpec;
}

export interface WorkspaceState {
  samples: Record<string, SampleInfo>;
  activeSampleId: string | null;
  axes: { x: string; y: string };
  transform: TransformSpec;
  gates: GateNode[];
  templates: GateTemplate[];
  /** Computed stats keyed by `${populationId}:${channel}`. */
  stats: Record<string, ChannelStatsResult>;
  status: "idle" | "loading" | "computing";
}

export interface ChannelStatsResult {
  count: number;
  median: number;
  mean: number;
  geometricMean: number;
  cv: number;
  ofParent?: number;
  ofTotal?: number;
}

// --- request payloads (controller -> engine) ---
export interface Bin2DRequest {
  sampleId: string;
  xChannel: string;
  yChannel: string;
  transform: TransformSpec;
  viewport: Viewport;
  binsX: number;
  binsY: number;
  parentPopId?: string;
}

export interface EvaluateGateRequest {
  sampleId: string;
  gate: GateSpec;
  transform: TransformSpec;
  parentPopId?: string;
  populationId?: string;
}

export interface StatsRequest {
  sampleId: string;
  populationId: string;
  channel: string;
  transform?: TransformSpec;
  parentPopId?: string;
}
