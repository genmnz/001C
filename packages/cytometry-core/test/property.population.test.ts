import { describe, expect, test } from "bun:test";
import { Population } from "../src/population.ts";
import { mulberry32 } from "./helpers.ts";

/** A reference population built on a JS Set, to cross-check the bitset. */
function fromSet(capacity: number, s: Set<number>): Population {
  const p = new Population(capacity);
  for (const i of s) p.set(i);
  return p;
}

describe("Population bitset vs Set reference (fuzz)", () => {
  const r = mulberry32(123);
  const cap = 257; // spans 9 words with a partial tail

  for (let trial = 0; trial < 60; trial++) {
    const sa = new Set<number>();
    const sb = new Set<number>();
    for (let k = 0; k < 200; k++) {
      sa.add(Math.floor(r() * cap));
      sb.add(Math.floor(r() * cap));
    }
    const a = fromSet(cap, sa);
    const b = fromSet(cap, sb);

    test(`trial ${trial}: counts, ordering, boolean algebra`, () => {
      expect(a.count()).toBe(sa.size);
      // forEach yields set bits in increasing order.
      const got: number[] = [];
      a.forEach((i) => got.push(i));
      expect(got).toEqual([...sa].sort((x, y) => x - y));

      const inter = new Set([...sa].filter((x) => sb.has(x)));
      const uni = new Set([...sa, ...sb]);
      const diff = new Set([...sa].filter((x) => !sb.has(x)));
      const sym = new Set(
        [...uni].filter((x) => sa.has(x) !== sb.has(x)),
      );
      expect(a.and(b).count()).toBe(inter.size);
      expect(a.or(b).count()).toBe(uni.size);
      expect(a.andNot(b).count()).toBe(diff.size);
      expect(a.xor(b).count()).toBe(sym.size);
      expect(a.not().count()).toBe(cap - sa.size);

      // Laws: De Morgan, complement, idempotence, XOR identity.
      expect(a.or(b).not().count()).toBe(a.not().and(b.not()).count());
      expect(a.and(a.not()).count()).toBe(0);
      expect(a.or(a.not()).count()).toBe(cap);
      expect(a.and(a).count()).toBe(sa.size);
      expect(a.xor(b).count()).toBe(a.or(b).andNot(a.and(b)).count());
    });
  }

  test("tail bits stay clean across word boundary (not/count)", () => {
    for (const cap2 of [1, 31, 32, 33, 63, 64, 65, 1000]) {
      const all = Population.all(cap2);
      expect(all.count()).toBe(cap2);
      expect(all.not().count()).toBe(0);
    }
  });

  test("large capacity (1,000,000 bits)", () => {
    const cap2 = 1_000_000;
    const p = new Population(cap2);
    let expected = 0;
    for (let i = 0; i < cap2; i += 7) {
      p.set(i);
      expected++;
    }
    expect(p.count()).toBe(expected);
    expect(p.not().count()).toBe(cap2 - expected);
    // toMask round-trips a sample of indices.
    const mask = p.toMask();
    expect(mask[0]).toBe(1);
    expect(mask[1]).toBe(0);
    expect(mask[7]).toBe(1);
  });
});
