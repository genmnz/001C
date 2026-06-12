/**
 * @joeee/fcs — defensive FCS parser. Zero runtime dependencies.
 *
 * Non-conformance is the norm, not the exception: Bras & van der Velden
 * (Cytometry A 2020, doi:10.1002/cyto.a.24187) found only ~0.7% of 211,359
 * public FCS files fully conform. This parser is defensive by default and
 * collects `warnings` rather than throwing on recoverable issues.
 */
export { parseFcs } from "./parse.ts";
export { parseHeader } from "./header.ts";
export { parseText } from "./text.ts";
export { rangeMask } from "./data.ts";
export { parseSpillover } from "./spillover.ts";
export type {
  FcsChannel,
  FcsFile,
  ParseOptions,
  SpilloverMatrix,
} from "./types.ts";
