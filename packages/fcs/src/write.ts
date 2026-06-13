/**
 * FCS writer — emits a valid FCS 3.1, list-mode, float32 ($DATATYPE F, little
 * endian) file. Lossless for joeee's Float32 event matrix and round-trips with
 * parseFcs (read-after-write equality). Reimplemented from the FCS 3.1 spec
 * (Spidlen et al. 2010, doi:10.1002/cyto.a.20825); FlowIO `create_fcs` was the
 * structural reference (BSD-3). I/O is infrequent, so this is pure TypeScript.
 */
export interface FcsWriteInput {
  version?: string;
  channels: { name: string; label?: string; range?: number }[];
  eventCount: number;
  /** Column-major: channel c occupies [c*eventCount, (c+1)*eventCount). */
  data: ArrayLike<number>;
  spillover?: { channels: string[]; values: ArrayLike<number> };
  /** Extra TEXT keywords (e.g. $CYT, $DATE). */
  extraKeywords?: Record<string, string>;
}

const FIELD = 12; // fixed width for offset keywords -> stable TEXT length

function strBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

export function writeFcs(input: FcsWriteInput): Uint8Array {
  const version = input.version ?? "FCS3.1";
  const delim = "|";
  const par = input.channels.length;
  const n = input.eventCount;
  const dataLen = n * par * 4;

  const buildText = (dataStart: number, dataEnd: number): string => {
    const pairs: [string, string][] = [
      ["$BEGINANALYSIS", "0"],
      ["$ENDANALYSIS", "0"],
      ["$BEGINSTEXT", "0"],
      ["$ENDSTEXT", "0"],
      ["$BEGINDATA", String(dataStart).padStart(FIELD, "0")],
      ["$ENDDATA", String(dataEnd).padStart(FIELD, "0")],
      ["$BYTEORD", "1,2,3,4"],
      ["$DATATYPE", "F"],
      ["$MODE", "L"],
      ["$NEXTDATA", "0"],
      ["$PAR", String(par)],
      ["$TOT", String(n)],
    ];
    for (let i = 0; i < par; i++) {
      const c = input.channels[i];
      const k = i + 1;
      pairs.push([`$P${k}B`, "32"]);
      pairs.push([`$P${k}E`, "0,0"]);
      pairs.push([`$P${k}N`, c.name]);
      pairs.push([`$P${k}R`, String(c.range ?? 262144)]);
      if (c.label) pairs.push([`$P${k}S`, c.label]);
    }
    if (input.spillover) {
      const sc = input.spillover.channels;
      const vals = Array.from(input.spillover.values);
      pairs.push(["$SPILLOVER", [sc.length, ...sc, ...vals].join(",")]);
    }
    for (const [k, v] of Object.entries(input.extraKeywords ?? {})) {
      pairs.push([k.toUpperCase(), v]);
    }
    return delim + pairs.map(([k, v]) => k + delim + v).join(delim) + delim;
  };

  const textStart = 58;
  const textLen = strBytes(buildText(0, 0)).length;
  const textEnd = textStart + textLen - 1;
  const dataStart = textEnd + 1;
  const dataEnd = dataStart + dataLen - 1;
  const textBytes = strBytes(buildText(dataStart, dataEnd));

  const f8 = (x: number) => String(x).padStart(8, " ");
  const header =
    version.padEnd(6, " ").slice(0, 6) +
    "    " +
    f8(textStart) +
    f8(textEnd) +
    f8(dataStart) +
    f8(dataEnd) +
    f8(0) +
    f8(0);

  const out = new Uint8Array(58 + textBytes.length + dataLen);
  out.set(strBytes(header), 0);
  out.set(textBytes, textStart);

  // DATA: row-major float32, transposing the column-major source.
  const dv = new DataView(out.buffer, dataStart, dataLen);
  let off = 0;
  for (let e = 0; e < n; e++) {
    for (let p = 0; p < par; p++) {
      dv.setFloat32(off, input.data[p * n + e], true);
      off += 4;
    }
  }
  return out;
}
