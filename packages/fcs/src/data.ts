import type { FcsHeader } from "./header.ts";
import type { FcsChannel, ParseOptions } from "./types.ts";

/**
 * Mask for integer data. The FCS standard stores values in `$PnB` bits but only
 * the low-order bits implied by `$PnR` are significant; vendors routinely leave
 * junk in the high bits. We mask to ceil(log2($PnR)) bits — this is the FlowIO
 * bugfix that makes values above $PnR parse correctly.
 */
export function rangeMask(range: number, bits: number): number {
  const maxBits = Math.min(32, bits);
  let b = maxBits;
  if (range > 0) b = Math.min(maxBits, Math.ceil(Math.log2(range)));
  return b >= 32 ? 0xffffffff : 2 ** b - 1;
}

export interface DataResult {
  eventCount: number;
  /** Column-major Float32: channel c at [c*eventCount, (c+1)*eventCount). */
  data: Float32Array;
  warnings: string[];
}

function resolveDataOffsets(
  header: FcsHeader,
  text: Map<string, string>,
  source: NonNullable<ParseOptions["offsetSource"]>,
  warnings: string[],
): [number, number] {
  const beginData = parseInt(text.get("$BEGINDATA") ?? "0", 10) || 0;
  const endData = parseInt(text.get("$ENDDATA") ?? "0", 10) || 0;
  const hHas = header.dataStart > 0 && header.dataEnd > 0;
  const tHas = beginData > 0 && endData > 0;

  if (source === "header" && hHas) return [header.dataStart, header.dataEnd];
  if (source === "text" && tHas) return [beginData, endData];

  // auto: header is the primary, TEXT wins when header is 0 (large-file rule)
  // or when only TEXT is present.
  if (hHas && tHas && (beginData !== header.dataStart || endData !== header.dataEnd)) {
    warnings.push(
      `HEADER/TEXT data offsets disagree (header ${header.dataStart}-${header.dataEnd}, text ${beginData}-${endData}); using HEADER`,
    );
    return [header.dataStart, header.dataEnd];
  }
  if (hHas) return [header.dataStart, header.dataEnd];
  if (tHas) return [beginData, endData];
  throw new Error("FCS: no valid DATA offsets in HEADER or TEXT");
}

export function parseData(
  bytes: Uint8Array,
  header: FcsHeader,
  text: Map<string, string>,
  channels: FcsChannel[],
  opts: ParseOptions,
): DataResult {
  const warnings: string[] = [];
  const datatype = (text.get("$DATATYPE") ?? "F").toUpperCase();
  const mode = (text.get("$MODE") ?? "L").toUpperCase();
  if (mode !== "L") {
    throw new Error(`FCS: unsupported $MODE "${mode}" (only list mode L)`);
  }
  if (datatype === "A") {
    throw new Error("FCS: ASCII ($DATATYPE A) data not yet supported");
  }

  const byteord = (text.get("$BYTEORD") ?? "1,2,3,4").trim();
  const little = byteord.split(",")[0].trim() === "1";

  const par = channels.length;
  let tot = parseInt(text.get("$TOT") ?? "0", 10) || 0;
  if (opts.maxEvents && opts.maxEvents < tot) tot = opts.maxEvents;

  const [dataStart, dataEnd] = resolveDataOffsets(
    header,
    text,
    opts.offsetSource ?? "auto",
    warnings,
  );

  const dv = new DataView(
    bytes.buffer,
    bytes.byteOffset + dataStart,
    dataEnd - dataStart + 1,
  );

  // Per-channel byte width and intra-event offset (supports mixed widths).
  const bytesPer = channels.map((c) => c.bits / 8);
  const channelOffset: number[] = [];
  let stride = 0;
  for (const w of bytesPer) {
    channelOffset.push(stride);
    stride += w;
  }

  const masks =
    datatype === "I" ? channels.map((c) => rangeMask(c.range, c.bits)) : [];
  if (datatype === "I" && channels.some((c) => c.bits > 24)) {
    warnings.push(
      "integer channel wider than 24 bits: values above 2^24 lose precision in Float32 storage",
    );
  }

  const data = new Float32Array(tot * par);

  for (let e = 0; e < tot; e++) {
    const base = e * stride;
    for (let p = 0; p < par; p++) {
      const off = base + channelOffset[p];
      let v: number;
      switch (datatype) {
        case "I": {
          const w = bytesPer[p];
          if (w === 2) v = dv.getUint16(off, little);
          else if (w === 4) v = dv.getUint32(off, little);
          else if (w === 1) v = dv.getUint8(off);
          else throw new Error(`FCS: unsupported integer width ${channels[p].bits} bits`);
          v = (v & masks[p]) >>> 0;
          break;
        }
        case "F":
          v = dv.getFloat32(off, little);
          break;
        case "D":
          v = dv.getFloat64(off, little);
          break;
        default:
          throw new Error(`FCS: unsupported $DATATYPE "${datatype}"`);
      }
      data[p * tot + e] = v; // transpose row-major source -> column-major store
    }
  }

  return { eventCount: tot, data, warnings };
}
