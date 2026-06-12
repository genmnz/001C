/**
 * Columnar, channel-contiguous event store — the in-memory backbone for an FCS
 * sample. Layout is column-major: channel `c` occupies indices
 * [c*eventCount, (c+1)*eventCount) of a single backing buffer.
 *
 * KEY ARCHITECTURAL DECISION (see docs/DERISKING.md): the backing buffer is a
 * `SharedArrayBuffer` when the page is cross-origin isolated, so Web Workers,
 * the WASM kernels, and the main-thread GPU uploader all see the SAME bytes with
 * zero copies. It lives on the JS heap, NOT the WASM linear memory — that
 * sidesteps the wasm32 4 GB ceiling, which 30M events x 50 channels (~6 GB)
 * would otherwise blow (Memory64 is still absent from Safari as of 2026).
 *
 * Channel-major (not row-major) because every hot operation — transform a
 * channel, gate on two channels, compute stats for a channel — streams one or
 * two columns, and the GPU wants contiguous per-attribute arrays.
 */
export interface ChannelMeta {
  /** $PnN short name, e.g. "FL1-A" or "FSC-A". */
  name: string;
  /** $PnS stain/marker label, e.g. "CD3". */
  label?: string;
  /** $PnR range (max channel value), used for integer bit-masking on parse. */
  range?: number;
}

function allocBuffer(byteLength: number): ArrayBufferLike {
  // Prefer SharedArrayBuffer so the matrix can cross worker boundaries without
  // a structured-clone copy. Requires COOP/COEP (self.crossOriginIsolated).
  if (
    typeof SharedArrayBuffer !== "undefined" &&
    (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated !== false
  ) {
    try {
      return new SharedArrayBuffer(byteLength);
    } catch {
      // fall through to ArrayBuffer
    }
  }
  return new ArrayBuffer(byteLength);
}

export class EventMatrix {
  readonly eventCount: number;
  readonly channelCount: number;
  readonly channels: ReadonlyArray<ChannelMeta>;
  readonly buffer: ArrayBufferLike;
  /** Flat column-major view over `buffer`. */
  readonly data: Float32Array;
  private readonly nameIndex: Map<string, number>;

  private constructor(
    eventCount: number,
    channels: ReadonlyArray<ChannelMeta>,
    buffer: ArrayBufferLike,
  ) {
    this.eventCount = eventCount;
    this.channelCount = channels.length;
    this.channels = channels;
    this.buffer = buffer;
    this.data = new Float32Array(buffer);
    this.nameIndex = new Map(channels.map((c, i) => [c.name, i]));
  }

  /** Allocate an empty matrix (SAB-backed when possible). */
  static allocate(
    eventCount: number,
    channels: ReadonlyArray<ChannelMeta>,
  ): EventMatrix {
    const bytes = eventCount * channels.length * Float32Array.BYTES_PER_ELEMENT;
    return new EventMatrix(eventCount, channels, allocBuffer(bytes));
  }

  /** Wrap an existing buffer (e.g. one received from a worker). */
  static fromBuffer(
    eventCount: number,
    channels: ReadonlyArray<ChannelMeta>,
    buffer: ArrayBufferLike,
  ): EventMatrix {
    return new EventMatrix(eventCount, channels, buffer);
  }

  /** A zero-copy view of one channel's column. */
  column(channel: number): Float32Array {
    const start = channel * this.eventCount;
    return this.data.subarray(start, start + this.eventCount);
  }

  indexOf(name: string): number {
    const i = this.nameIndex.get(name);
    if (i === undefined) throw new Error(`unknown channel: ${name}`);
    return i;
  }

  columnByName(name: string): Float32Array {
    return this.column(this.indexOf(name));
  }

  value(event: number, channel: number): number {
    return this.data[channel * this.eventCount + event];
  }
}
