// Date.now() alone can collide when two synthetic ids are minted in the same
// millisecond (an interim seal and the next segment's first delta, e.g.) — a
// counter suffix (ported from apps/desktop .../use-message-stream/index.ts)
// keeps every id this reducer mints unique regardless of clock resolution.
let seq = 0

export function nextStreamMessageId(prefix: string): string {
  seq += 1

  return `${prefix}-${Date.now()}-${seq}`
}
