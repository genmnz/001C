import { describe, expect, test } from "bun:test";
import { writeFcs } from "../../fcs/test/synth.ts";
import {
  installEngineWorker,
  type WorkerScope,
} from "../src/worker/engine.worker.ts";

/**
 * The Worker host (engine.worker.ts) is normally browser-only, but because the
 * bootstrap is an injectable `installEngineWorker(scope)` we can drive the whole
 * RPC contract in-process against a mock scope — no DOM, no real Worker. This
 * exercises the path the app uses: a "ready" handshake reporting the active
 * kernel backend + isolation, then request/response round-trips. The wasm
 * artifact is absent under Bun, so the backend falls back to "ts".
 */
interface Reply {
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}
interface ReadyMsg {
  type: "ready";
  backend: string;
  crossOriginIsolated: boolean;
}

function harness(crossOriginIsolated = false) {
  const waiters = new Map<number, (r: Reply) => void>();
  let resolveReady!: (m: ReadyMsg) => void;
  const ready = new Promise<ReadyMsg>((r) => (resolveReady = r));

  const scope: WorkerScope = {
    onmessage: null,
    crossOriginIsolated,
    postMessage(message: unknown) {
      const m = message as Partial<Reply & ReadyMsg>;
      if (m.type === "ready") resolveReady(m as ReadyMsg);
      else if (typeof m.id === "number") {
        const w = waiters.get(m.id);
        if (w) {
          waiters.delete(m.id);
          w(m as Reply);
        }
      }
    },
  };
  installEngineWorker(scope);

  let seq = 0;
  function rpc<T = unknown>(method: string, args: unknown[]): Promise<T> {
    const id = ++seq;
    return new Promise<T>((resolve, reject) => {
      waiters.set(id, (r) =>
        r.ok ? resolve(r.result as T) : reject(new Error(r.error)),
      );
      // The handler is async (awaits engine boot); it replies via postMessage.
      scope.onmessage?.({ data: { id, method, args } } as MessageEvent);
    });
  }
  return { ready, rpc };
}

describe("engine worker RPC host", () => {
  test("boots and reports the kernel backend + isolation flag", async () => {
    const { ready } = harness(false);
    const r = await ready;
    expect(r.backend).toBe("ts"); // no wasm artifact -> graceful TS fallback
    expect(r.crossOriginIsolated).toBe(false);
  });

  test("addColumns -> stats round-trips over the worker boundary", async () => {
    const { rpc } = harness();
    const info = await rpc<{ eventCount: number }>("addColumns", [
      "s",
      [{ name: "FSC-A" }, { name: "CD3" }],
      [
        [1, 2, 3, 4],
        [10, 20, 30, 40],
      ],
    ]);
    expect(info.eventCount).toBe(4);

    const stats = await rpc<{ count: number; mean: number }>("stats", [
      { sampleId: "s", populationId: "all", channel: "CD3" },
    ]);
    expect(stats.count).toBe(4);
    expect(stats.mean).toBeCloseTo(25, 6);
  });

  test("loadFcs parses a synthetic FCS; bin2d conserves event counts", async () => {
    const { rpc } = harness();
    const buf = writeFcs({
      channels: [
        { name: "FSC-A", bits: 32, range: 262144 },
        { name: "CD3", bits: 32, range: 262144 },
      ],
      columns: [
        [10, 20, 30, 40, 50],
        [5, 15, 25, 35, 45],
      ],
      datatype: "F",
    });
    const info = await rpc<{ eventCount: number; channels: { name: string }[] }>(
      "loadFcs",
      ["sample.fcs", buf],
    );
    expect(info.eventCount).toBe(5);
    expect(info.channels.map((c) => c.name)).toEqual(["FSC-A", "CD3"]);

    const bins = await rpc<{ counts: Uint32Array }>("bin2d", [
      {
        sampleId: "sample.fcs",
        xChannel: "FSC-A",
        yChannel: "CD3",
        transform: { kind: "linear", T: 1, A: 0 }, // display == raw
        viewport: { xMin: 0, xMax: 60, yMin: 0, yMax: 60 },
        binsX: 8,
        binsY: 8,
      },
    ]);
    let total = 0;
    for (const c of bins.counts) total += c;
    expect(total).toBe(5); // every event lands in exactly one bin
  });

  test("unknown method rejects with a descriptive error", async () => {
    const { rpc } = harness();
    await expect(rpc("nope", [])).rejects.toThrow(/unknown method: nope/);
  });
});
