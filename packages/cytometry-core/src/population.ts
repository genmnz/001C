/**
 * A population is a membership bitset over event indices — the single primitive
 * that makes large samples tractable. Every gate produces one; boolean gates are
 * word-wise bit ops; statistics are reductions over the set bits; the GPU colors
 * points by membership. Packed 1-bit-per-event (Uint32 words) keeps 30M events
 * at ~3.75 MB and makes AND/OR/NOT/XOR 32 events at a time.
 */
function popcount32(v: number): number {
  v = v - ((v >>> 1) & 0x55555555);
  v = (v & 0x33333333) + ((v >>> 2) & 0x33333333);
  return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
}

export class Population {
  readonly capacity: number;
  readonly words: Uint32Array;
  /** Optional human label, e.g. "CD3+". */
  name?: string;

  constructor(capacity: number, words?: Uint32Array, name?: string) {
    this.capacity = capacity;
    this.words = words ?? new Uint32Array((capacity + 31) >>> 5);
    this.name = name;
  }

  /** A population containing every event. */
  static all(capacity: number, name = "All Events"): Population {
    const p = new Population(capacity, undefined, name);
    p.words.fill(0xffffffff);
    p.maskTail();
    return p;
  }

  /** Zero out bits past `capacity` in the final word (kept clean for count/not). */
  private maskTail(): void {
    const rem = this.capacity & 31;
    if (rem !== 0) this.words[this.words.length - 1] &= (1 << rem) - 1;
  }

  get(i: number): boolean {
    return ((this.words[i >>> 5] >>> (i & 31)) & 1) === 1;
  }
  set(i: number): void {
    this.words[i >>> 5] |= 1 << (i & 31);
  }
  unset(i: number): void {
    this.words[i >>> 5] &= ~(1 << (i & 31));
  }

  count(): number {
    let n = 0;
    const w = this.words;
    for (let i = 0; i < w.length; i++) n += popcount32(w[i]);
    return n;
  }

  // --- boolean algebra (returns new populations; operands must share capacity) ---
  and(other: Population): Population {
    return this.combine(other, (a, b) => a & b);
  }
  or(other: Population): Population {
    return this.combine(other, (a, b) => a | b);
  }
  xor(other: Population): Population {
    return this.combine(other, (a, b) => a ^ b);
  }
  andNot(other: Population): Population {
    return this.combine(other, (a, b) => a & ~b);
  }
  not(): Population {
    const out = new Population(this.capacity);
    for (let i = 0; i < this.words.length; i++) out.words[i] = ~this.words[i];
    out.maskTail();
    return out;
  }

  private combine(
    other: Population,
    op: (a: number, b: number) => number,
  ): Population {
    if (other.capacity !== this.capacity)
      throw new Error("population capacity mismatch");
    const out = new Population(this.capacity);
    const a = this.words;
    const b = other.words;
    const o = out.words;
    for (let i = 0; i < o.length; i++) o[i] = op(a[i], b[i]) >>> 0;
    out.maskTail();
    return out;
  }

  /** Iterate set-bit indices. Hot path for stats — scans words, skipping zeros. */
  forEach(cb: (index: number) => void): void {
    const w = this.words;
    for (let wi = 0; wi < w.length; wi++) {
      let bits = w[wi];
      if (bits === 0) continue;
      const base = wi << 5;
      while (bits !== 0) {
        const lsb = bits & -bits; // isolate lowest set bit
        const bit = 31 - Math.clz32(lsb);
        cb(base + bit);
        bits ^= lsb;
      }
    }
  }

  /** Expand to one byte per event (0/1) — convenient for GPU per-instance upload. */
  toMask(): Uint8Array {
    const mask = new Uint8Array(this.capacity);
    this.forEach((i) => {
      mask[i] = 1;
    });
    return mask;
  }
}
