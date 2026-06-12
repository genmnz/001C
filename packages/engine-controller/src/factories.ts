import {
  AsinhTransform,
  CofactorAsinhTransform,
  EllipseGate,
  LinearTransform,
  LogTransform,
  LogicleTransform,
  PolygonGate,
  RangeGate,
  RectangleGate,
  type Gate1D,
  type Gate2D,
  type Transform,
} from "@joeee/cytometry-core";
import type { GateSpec, TransformSpec } from "./protocol.ts";

export function makeTransform(spec: TransformSpec): Transform {
  switch (spec.kind) {
    case "logicle":
      return new LogicleTransform(spec.T, spec.W, spec.M, spec.A);
    case "asinh":
      return new AsinhTransform(spec.T, spec.M, spec.A);
    case "asinh-cofactor":
      return new CofactorAsinhTransform(spec.cofactor);
    case "log":
      return new LogTransform(spec.T, spec.M);
    case "linear":
      return new LinearTransform(spec.T, spec.A);
  }
}

export function isGate1D(spec: GateSpec): spec is Extract<GateSpec, { kind: "range" }> {
  return spec.kind === "range";
}

export function makeGate1D(spec: Extract<GateSpec, { kind: "range" }>): Gate1D {
  return new RangeGate(spec.channel, spec.min, spec.max);
}

export function makeGate2D(spec: Exclude<GateSpec, { kind: "range" }>): Gate2D {
  switch (spec.kind) {
    case "rectangle":
      return new RectangleGate(
        spec.xChannel,
        spec.yChannel,
        spec.xMin,
        spec.xMax,
        spec.yMin,
        spec.yMax,
      );
    case "polygon":
      return new PolygonGate(spec.xChannel, spec.yChannel, spec.vertices);
    case "ellipse":
      return new EllipseGate(
        spec.xChannel,
        spec.yChannel,
        spec.cx,
        spec.cy,
        spec.rx,
        spec.ry,
        spec.angle,
      );
  }
}

/** A stable cache key for a (channel, transform) display column. */
export function transformKey(spec: TransformSpec): string {
  return JSON.stringify(spec);
}
