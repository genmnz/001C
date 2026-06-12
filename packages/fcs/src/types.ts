export interface FcsChannel {
  /** 1-based parameter number `n` from `$PnN` etc. */
  index: number;
  /** `$PnN` short name (detector), e.g. "FSC-A", "FL1-A". */
  name: string;
  /** `$PnS` optional stain/marker label, e.g. "CD3". */
  label?: string;
  /** `$PnB` bits per value (8/16/32/64). */
  bits: number;
  /** `$PnR` range (max+1). Drives the integer bit-mask. */
  range: number;
  /** `$PnE` amplification (decades, offset) — [0,0] means linear. */
  amplification?: [number, number];
}

export interface SpilloverMatrix {
  channels: string[];
  /** Row-major n*n spillover values (f64). Structurally matches @joeee/cytometry-core. */
  values: Float64Array;
}

export interface FcsFile {
  version: string;
  /** All TEXT keywords, keys upper-cased. Includes non-standard vendor keys. */
  text: Map<string, string>;
  channels: FcsChannel[];
  eventCount: number;
  /**
   * Column-major Float32 event data: channel `c` occupies
   * [c*eventCount, (c+1)*eventCount). This is exactly EventMatrix's layout, so
   * the controller can wrap `data` with EventMatrix.fromBuffer with no transpose.
   */
  data: Float32Array;
  spillover: SpilloverMatrix | null;
  /** Non-fatal issues encountered (non-conformance is the norm — see DERISKING). */
  warnings: string[];
}

export interface ParseOptions {
  /**
   * When HEADER and TEXT ($BEGINDATA/$ENDDATA) disagree on data offsets, which
   * wins. Default "auto": use TEXT offsets when the HEADER offset is 0 (the
   * large-file convention) or when they disagree and TEXT looks valid.
   */
  offsetSource?: "auto" | "header" | "text";
  /** Cap events parsed (for previews / progressive loading). */
  maxEvents?: number;
}
