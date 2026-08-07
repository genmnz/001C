/**
 * Minimal but spec-correct FCS writer used only by tests, so the parser suite is
 * self-contained (write -> parse -> assert) and we don't commit binary fixtures.
 * Supports FCS 3.1, list mode, datatypes I/F/D, both byte orders, and can force
 * HEADER data offsets to 0 to exercise the $BEGINDATA/$ENDDATA fallback path.
 */
export interface SynthChannel {
  name: string;
  label?: string;
  bits: number; // 16/32 for I, 32 for F, 64 for D
  range: number;
}

export interface SynthInput {
  version?: string;
  channels: SynthChannel[];
  /** Per-channel raw value arrays (all the same length = event count). */
  columns: number[][];
  datatype: "I" | "F" | "D" | "A";
  /** For $DATATYPE A: pack values fixed-width ($PnB chars) instead of space-delimited. */
  asciiFixedWidth?: boolean;
  littleEndian?: boolean;
  delimiter?: string;
  /** Write 0 for the HEADER data offsets, forcing use of $BEGINDATA/$ENDDATA. */
  headerDataOffsetsZero?: boolean;
  /** Override $BEGINDATA/$ENDDATA to mismatch the HEADER (tests reconciliation). */
  textDataOffsetDelta?: number;
  /** Emit a $SPILLOVER keyword. `channels` are $PnN names; `values` row-major. */
  spillover?: { channels: string[]; values: number[] };
}

const FIELD = 12; // fixed width for $BEGINDATA/$ENDDATA so TEXT length is stable

function strBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

export function writeFcs(input: SynthInput): Uint8Array {
  const version = input.version ?? "FCS3.1";
  const little = input.littleEndian ?? true;
  const delim = input.delimiter ?? "|";
  const { channels, columns, datatype } = input;
  const par = channels.length;
  const eventCount = columns[0]?.length ?? 0;

  const bytesPer = channels.map((c) => c.bits / 8);
  const stride = bytesPer.reduce((a, b) => a + b, 0);

  // ASCII payload, built up-front so $BEGINDATA/$ENDDATA account for its length.
  let asciiText = "";
  if (datatype === "A") {
    const parts: string[] = [];
    for (let e = 0; e < eventCount; e++)
      for (let p = 0; p < par; p++) {
        const s = String(columns[p][e]);
        // Zero-pad (no whitespace) so fixed-width fields pack with no delimiter,
        // exercising the parser's fixed-width fallback rather than token-splitting.
        parts.push(input.asciiFixedWidth ? s.padStart(channels[p].bits, "0") : s);
      }
    asciiText = input.asciiFixedWidth ? parts.join("") : parts.join(" ");
  }
  const dataLen = datatype === "A" ? strBytes(asciiText).length : eventCount * stride;

  const byteord = little
    ? datatype === "D"
      ? "1,2,3,4,5,6,7,8"
      : "1,2,3,4"
    : datatype === "D"
      ? "8,7,6,5,4,3,2,1"
      : "4,3,2,1";

  const buildText = (dataStart: number, dataEnd: number): string => {
    const pairs: [string, string][] = [
      ["$BEGINANALYSIS", "0"],
      ["$ENDANALYSIS", "0"],
      ["$BEGINSTEXT", "0"],
      ["$ENDSTEXT", "0"],
      ["$BEGINDATA", String(dataStart).padStart(FIELD, "0")],
      ["$ENDDATA", String(dataEnd).padStart(FIELD, "0")],
      ["$BYTEORD", byteord],
      ["$DATATYPE", datatype],
      ["$MODE", "L"],
      ["$NEXTDATA", "0"],
      ["$PAR", String(par)],
      ["$TOT", String(eventCount)],
    ];
    for (let i = 0; i < par; i++) {
      const c = channels[i];
      const n = i + 1;
      pairs.push([`$P${n}B`, String(c.bits)]);
      pairs.push([`$P${n}E`, "0,0"]);
      pairs.push([`$P${n}N`, c.name]);
      pairs.push([`$P${n}R`, String(c.range)]);
      if (c.label) pairs.push([`$P${n}S`, c.label]);
    }
    if (input.spillover) {
      const { channels: sc, values } = input.spillover;
      pairs.push([
        "$SPILLOVER",
        [sc.length, ...sc, ...values].join(","),
      ]);
    }
    return (
      delim + pairs.map(([k, v]) => k + delim + v).join(delim) + delim
    );
  };

  const textStart = 58;
  const textLen = strBytes(buildText(0, 0)).length;
  const textEnd = textStart + textLen - 1;
  const dataStart = textEnd + 1;
  const dataEnd = dataStart + dataLen - 1;

  const delta = input.textDataOffsetDelta ?? 0;
  const textStr = buildText(dataStart + delta, dataEnd + delta);
  const textBytes = strBytes(textStr);

  // HEADER (58 bytes).
  const f8 = (n: number) => String(n).padStart(8, " ");
  const hStart = input.headerDataOffsetsZero ? 0 : dataStart;
  const hEnd = input.headerDataOffsetsZero ? 0 : dataEnd;
  const header =
    version.padEnd(6, " ").slice(0, 6) +
    "    " +
    f8(textStart) +
    f8(textEnd) +
    f8(hStart) +
    f8(hEnd) +
    f8(0) +
    f8(0);
  const headerBytes = strBytes(header);

  // DATA.
  let dataBytes: Uint8Array;
  if (datatype === "A") {
    dataBytes = strBytes(asciiText);
  } else {
    const dataBuf = new ArrayBuffer(dataLen);
    const dv = new DataView(dataBuf);
    let off = 0;
    for (let e = 0; e < eventCount; e++) {
      for (let p = 0; p < par; p++) {
        const v = columns[p][e];
        if (datatype === "I") {
          if (bytesPer[p] === 2) dv.setUint16(off, v & 0xffff, little);
          else dv.setUint32(off, v >>> 0, little);
        } else if (datatype === "F") {
          dv.setFloat32(off, v, little);
        } else {
          dv.setFloat64(off, v, little);
        }
        off += bytesPer[p];
      }
    }
    dataBytes = new Uint8Array(dataBuf);
  }

  const out = new Uint8Array(58 + textBytes.length + dataBytes.length);
  out.set(headerBytes, 0);
  out.set(textBytes, textStart);
  out.set(dataBytes, dataStart);
  return out;
}
