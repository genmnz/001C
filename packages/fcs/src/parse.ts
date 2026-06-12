import { parseHeader } from "./header.ts";
import { parseText } from "./text.ts";
import { parseData } from "./data.ts";
import { parseSpillover } from "./spillover.ts";
import type { FcsChannel, FcsFile, ParseOptions } from "./types.ts";

function buildChannels(
  text: Map<string, string>,
  warnings: string[],
): FcsChannel[] {
  const par = parseInt(text.get("$PAR") ?? "0", 10) || 0;
  const channels: FcsChannel[] = [];
  for (let n = 1; n <= par; n++) {
    const name = text.get(`$P${n}N`) ?? `P${n}`;
    const label = text.get(`$P${n}S`);
    const bits = parseInt(text.get(`$P${n}B`) ?? "0", 10) || 0;
    const range = parseInt(text.get(`$P${n}R`) ?? "0", 10) || 0;
    let amplification: [number, number] | undefined;
    const pe = text.get(`$P${n}E`);
    if (pe) {
      const [d, o] = pe.split(",").map(Number);
      if (Number.isFinite(d) && Number.isFinite(o)) amplification = [d, o];
    }
    if (bits === 0) warnings.push(`channel ${n} (${name}) has no $P${n}B bit width`);
    channels.push({ index: n, name, label, bits, range, amplification });
  }
  return channels;
}

/**
 * Parse one FCS dataset. Handles FCS 2.0/3.0/3.1, integer/float/double list-mode
 * data, the integer bit-mask, endianness, HEADER/TEXT offset reconciliation, and
 * the spillover matrix. Multi-dataset files ($NEXTDATA > 0) parse the first set;
 * follow $NEXTDATA to read the rest.
 *
 * Designed so the heavy work (the data loop) can move into a Web Worker and write
 * straight into a SharedArrayBuffer-backed EventMatrix — see
 * @joeee/engine-controller.
 */
export function parseFcs(
  input: ArrayBuffer | Uint8Array,
  opts: ParseOptions = {},
): FcsFile {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const warnings: string[] = [];

  const header = parseHeader(bytes);
  if (!header.version.startsWith("FCS")) {
    throw new Error(`not an FCS file (version field: "${header.version}")`);
  }

  const text = parseText(bytes, header.textStart, header.textEnd);
  const channels = buildChannels(text, warnings);
  const { eventCount, data, warnings: dataWarnings } = parseData(
    bytes,
    header,
    text,
    channels,
    opts,
  );
  const spillover = parseSpillover(text);

  return {
    version: header.version.trim(),
    text,
    channels,
    eventCount,
    data,
    spillover,
    warnings: [...warnings, ...dataWarnings],
  };
}
