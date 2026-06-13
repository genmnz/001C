import type {
  GateSpec,
  SampleInfo,
  TransformSpec,
  WorkspaceState,
} from "./protocol.ts";

/**
 * Workspace serialization — a portable, JSON-safe document of the ANALYSIS (gate
 * tree, transform, axis selections, sample metadata), deliberately WITHOUT event
 * data (which is re-loaded from the FCS). This is the joeee analogue of a FlowJo
 * .wsp / CytoML document; round-trippable and the basis for save/load,
 * reproducibility, and (later) FlowJo/Cytobank import.
 */
export interface SerializedGate {
  id: string;
  name: string;
  spec: GateSpec;
  parentId: string | null;
  color?: string;
}

export interface WorkspaceDoc {
  version: 1;
  axes: { x: string; y: string };
  transform: TransformSpec;
  /** Sample metadata only (no events). */
  samples: SampleInfo[];
  gates: SerializedGate[];
}

export function serializeWorkspace(state: WorkspaceState): WorkspaceDoc {
  return {
    version: 1,
    axes: state.axes,
    transform: state.transform,
    samples: Object.values(state.samples),
    gates: state.gates.map((g) => ({
      id: g.id,
      name: g.name,
      spec: g.spec,
      parentId: g.parentId,
      color: g.color,
    })),
  };
}

/** Order gates so each parent precedes its children (stable topological sort). */
export function topoSortGates(gates: SerializedGate[]): SerializedGate[] {
  const out: SerializedGate[] = [];
  const emitted = new Set<string>();
  let remaining = [...gates];
  while (remaining.length > 0) {
    const ready = remaining.filter(
      (g) => g.parentId == null || emitted.has(g.parentId),
    );
    if (ready.length === 0) {
      // Cycle or dangling parent — emit the rest in given order to avoid hanging.
      out.push(...remaining);
      break;
    }
    for (const g of ready) {
      out.push(g);
      emitted.add(g.id);
    }
    remaining = remaining.filter((g) => !emitted.has(g.id));
  }
  return out;
}

export function deserializeWorkspace(doc: WorkspaceDoc): {
  axes: { x: string; y: string };
  transform: TransformSpec;
  gates: SerializedGate[];
} {
  return {
    axes: doc.axes,
    transform: doc.transform,
    gates: topoSortGates(doc.gates),
  };
}
