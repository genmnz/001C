const latin1 = new TextDecoder("latin1");

export interface FcsHeader {
  version: string;
  textStart: number;
  textEnd: number;
  dataStart: number;
  dataEnd: number;
  analysisStart: number;
  analysisEnd: number;
}

/**
 * The fixed 58-byte FCS HEADER: a 6-char version ("FCS3.1"), 4 spaces, then six
 * 8-byte ASCII, right-justified offsets. For files larger than 99,999,999 bytes
 * the data offsets here are written as 0 and the real ones live in TEXT
 * ($BEGINDATA/$ENDDATA) — the parser reconciles the two.
 */
export function parseHeader(bytes: Uint8Array): FcsHeader {
  const version = latin1.decode(bytes.subarray(0, 6));
  const field = (start: number, end: number): number => {
    const s = latin1.decode(bytes.subarray(start, end)).trim();
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    version,
    textStart: field(10, 18),
    textEnd: field(18, 26),
    dataStart: field(26, 34),
    dataEnd: field(34, 42),
    analysisStart: field(42, 50),
    analysisEnd: field(50, 58),
  };
}
