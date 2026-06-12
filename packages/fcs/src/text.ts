/**
 * Parse the TEXT segment into a keyword map. Format:
 *   <delim> KEY <delim> VALUE <delim> KEY <delim> VALUE ... <delim>
 * The delimiter is the first byte of the segment. A literal delimiter inside a
 * key or value is escaped by doubling it. Keys are upper-cased for lookup (FCS
 * keywords are case-insensitive); values are preserved verbatim.
 */
export function parseText(
  bytes: Uint8Array,
  start: number,
  end: number,
): Map<string, string> {
  const map = new Map<string, string>();
  if (end <= start) return map;
  // HEADER offsets are inclusive of the last byte.
  const seg = bytes.subarray(start, end + 1);
  const delim = seg[0];

  const tokens: string[] = [];
  let cur = "";
  let i = 1; // skip the leading delimiter
  while (i < seg.length) {
    const ch = seg[i];
    if (ch === delim) {
      if (seg[i + 1] === delim) {
        // doubled delimiter -> literal delimiter character
        cur += String.fromCharCode(delim);
        i += 2;
        continue;
      }
      tokens.push(cur);
      cur = "";
      i++;
    } else {
      cur += String.fromCharCode(ch);
      i++;
    }
  }
  if (cur.length > 0) tokens.push(cur);

  for (let k = 0; k + 1 < tokens.length; k += 2) {
    const key = tokens[k].trim().toUpperCase();
    if (key.length === 0) continue;
    map.set(key, tokens[k + 1]);
  }
  return map;
}
