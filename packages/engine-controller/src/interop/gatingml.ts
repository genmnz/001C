import type { GateSpec } from "../protocol.ts";
import type { SerializedGate } from "../workspace.ts";
import { attrLocal, childrenLocal, localName, parseXml } from "./xml.ts";

/**
 * Gating-ML 2.0 import — reimplemented from the ISAC spec (and FlowKit's BSD-3
 * parser as the behavioral reference); does NOT touch AGPL CytoML/flowWorkspace.
 * Supports RectangleGate (2D → rectangle, 1D → range), PolygonGate, and 2D
 * EllipsoidGate (mean + covariance + distanceSquare → center/axes/angle). Gates
 * are produced in the dimensions' own coordinate space; the engine's active
 * transform is applied when they are evaluated (per-dimension Gating-ML
 * transforms are a documented future addition).
 */
function num(v: string | undefined, fallback: number): number {
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function dimName(dim: { name: string; attrs: Record<string, string>; children: any[]; text: string }): string {
  const fcs = childrenLocal(dim as any, "fcs-dimension")[0];
  return (fcs && attrLocal(fcs, "name")) ?? attrLocal(dim as any, "name") ?? "?";
}

/** Closed-form eigen of a symmetric 2×2 [[a,b],[b,c]] -> sorted desc. */
function eig2(a: number, b: number, c: number): {
  l1: number;
  l2: number;
  angle: number;
} {
  const tr = (a + c) / 2;
  const disc = Math.sqrt(((a - c) / 2) ** 2 + b * b);
  const l1 = tr + disc; // larger
  const l2 = tr - disc;
  let angle: number;
  if (Math.abs(b) > 1e-12) angle = Math.atan2(l1 - a, b);
  else angle = a >= c ? 0 : Math.PI / 2;
  return { l1, l2, angle };
}

export function parseGatingML(xml: string): SerializedGate[] {
  const root = parseXml(xml);
  // The Gating-ML element may be the root child or root itself.
  let container = root;
  for (const c of root.children) {
    if (localName(c.name).toLowerCase().includes("gating")) container = c;
  }
  const gates: SerializedGate[] = [];

  for (const node of container.children) {
    const kind = localName(node.name);
    const id = attrLocal(node, "id") ?? `gate_${gates.length + 1}`;
    const parentId = attrLocal(node, "parent_id") ?? null;
    const dims = childrenLocal(node, "dimension");
    let spec: GateSpec | null = null;

    if (kind === "RectangleGate") {
      if (dims.length === 1) {
        spec = {
          kind: "range",
          channel: dimName(dims[0]),
          min: num(attrLocal(dims[0], "min"), -Infinity),
          max: num(attrLocal(dims[0], "max"), Infinity),
        };
      } else if (dims.length >= 2) {
        spec = {
          kind: "rectangle",
          xChannel: dimName(dims[0]),
          yChannel: dimName(dims[1]),
          xMin: num(attrLocal(dims[0], "min"), -Infinity),
          xMax: num(attrLocal(dims[0], "max"), Infinity),
          yMin: num(attrLocal(dims[1], "min"), -Infinity),
          yMax: num(attrLocal(dims[1], "max"), Infinity),
        };
      }
    } else if (kind === "PolygonGate") {
      const verts = childrenLocal(node, "vertex").map((v) => {
        const coords = childrenLocal(v, "coordinate");
        return [num(attrLocal(coords[0], "value"), 0), num(attrLocal(coords[1], "value"), 0)] as [
          number,
          number,
        ];
      });
      if (dims.length >= 2 && verts.length >= 3) {
        spec = {
          kind: "polygon",
          xChannel: dimName(dims[0]),
          yChannel: dimName(dims[1]),
          vertices: verts,
        };
      }
    } else if (kind === "EllipsoidGate" && dims.length >= 2) {
      const meanNode = childrenLocal(node, "mean")[0];
      const meanCoords = meanNode ? childrenLocal(meanNode, "coordinate") : [];
      const cx = num(attrLocal(meanCoords[0], "value"), 0);
      const cy = num(attrLocal(meanCoords[1], "value"), 0);
      const ds = num(attrLocal(childrenLocal(node, "distanceSquare")[0], "value"), 1);
      const covNode = childrenLocal(node, "covarianceMatrix")[0];
      const rows = covNode ? childrenLocal(covNode, "row") : [];
      const entry = (r: number, c: number) =>
        num(attrLocal(childrenLocal(rows[r], "entry")[c], "value"), 0);
      const a = entry(0, 0);
      const b = entry(0, 1);
      const cc = entry(1, 1);
      const { l1, l2, angle } = eig2(a, b, cc);
      spec = {
        kind: "ellipse",
        xChannel: dimName(dims[0]),
        yChannel: dimName(dims[1]),
        cx,
        cy,
        rx: Math.sqrt(Math.max(0, l1 * ds)),
        ry: Math.sqrt(Math.max(0, l2 * ds)),
        angle,
      };
    }

    if (spec) gates.push({ id, name: id, spec, parentId });
  }
  return gates;
}
