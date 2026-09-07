/**
 * The timing half of the desktop's delta-flush coalescing
 * (apps/desktop/src/app/session/hooks/use-message-stream/index.ts,
 * `scheduleDeltaFlush`, lines ~236-300) — ported as a small scheduler the
 * reducer does not own, so `session-stream-reducer.ts` stays synchronous
 * (M05). It owns exactly one thing: WHEN to call a flush callback. The
 * reducer owns WHAT a flush does (`flushSessionDeltas`).
 *
 * The desktop version measures flush cost through a `requestAnimationFrame`
 * callback, because on the web the cost that matters is the deferred
 * $messages publish + Streamdown re-parse a browser commit does after the
 * synchronous store write. There is no equivalent single "the commit
 * happened" signal this module can assume across Expo/React Native's own
 * render pipeline, so instead of guessing at one, the caller reports it:
 * `reportFlushCost(ms)` after it has actually measured (or estimated) what a
 * flush cost to render. Never calling it just means the adaptive floor never
 * stretches past the fixed 33ms one — the same behavior the desktop's own
 * "hidden renderer never fires rAF" fallback exercises.
 */

export const STREAM_DELTA_FLUSH_MS = 33
export const MAX_STREAM_FLUSH_GAP_MS = 250

export interface DeltaFlushSchedulerOptions {
  /** Called when a flush is due. Synchronous — do the actual
   *  `flushSessionDeltas` call (and whatever publishes its result) inside it. */
  flush: () => void
  /** Injectable clock, for tests. Defaults to `Date.now`. */
  now?: () => number
  /** Injectable timer, for tests. Defaults to the global `setTimeout`/`clearTimeout`. */
  setTimeout?: (callback: () => void, ms: number) => number
  clearTimeout?: (handle: number) => void
}

export class DeltaFlushScheduler {
  private readonly flushCallback: () => void
  private readonly now: () => number
  private readonly setTimeoutFn: (callback: () => void, ms: number) => number
  private readonly clearTimeoutFn: (handle: number) => void

  private timerHandle: null | number = null
  private lastFlushAt: number
  private lastFlushCost = 0

  constructor(options: DeltaFlushSchedulerOptions) {
    this.flushCallback = options.flush
    this.now = options.now ?? Date.now
    this.setTimeoutFn = options.setTimeout ?? ((callback, ms) => setTimeout(callback, ms) as unknown as number)
    this.clearTimeoutFn =
      options.clearTimeout ?? (handle => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>))
    // The desktop measures elapsed-since-last-flush with `performance.now()`,
    // which starts near 0 at page load, so its `lastFlushAtRef.current = 0`
    // initial value costs nothing on the very first flush. `Date.now()` (this
    // module's default clock, since there's no RN equivalent of navigation
    // start to zero against) is a large absolute epoch, so a literal 0 here
    // would make "elapsed since last flush" read as a huge number and skip
    // the floor entirely on the first call. Seeding it to the current clock
    // time instead makes "nothing has flushed yet" read as 0ms elapsed, same
    // as the desktop's behavior.
    this.lastFlushAt = this.now()
  }

  /** Arm a flush, respecting the adaptive floor. A no-op while one is already
   *  pending — exactly like the desktop's `flushHandleRef.current !== null` guard. */
  schedule(): void {
    if (this.timerHandle !== null) {
      return
    }

    const sinceLast = this.now() - this.lastFlushAt

    // Fixed 33ms floor, stretching to 3x the last measured flush cost under
    // heavy multi-stream load, capped at 250ms so streaming text never stalls
    // for more than a quarter second even under load. See STREAM_DELTA_FLUSH_MS
    // / MAX_STREAM_FLUSH_GAP_MS docs above and the desktop's identical formula.
    const adaptiveFloor = Math.min(Math.max(STREAM_DELTA_FLUSH_MS, this.lastFlushCost * 3), MAX_STREAM_FLUSH_GAP_MS)

    this.timerHandle = this.setTimeoutFn(
      () => {
        this.timerHandle = null
        this.lastFlushAt = this.now()
        this.flushCallback()
      },
      Math.max(0, adaptiveFloor - sinceLast)
    )
  }

  /** Report how long the last flush actually cost to render, so the next
   *  gap can adapt. Stale reports (an older flush's measurement arriving
   *  after a newer one already started) should simply not be reported —
   *  there is no timestamp to compare against here, so that ordering
   *  discipline is the caller's responsibility (mirrors the desktop's own
   *  `lastFlushAtRef.current !== startedAt` staleness guard). */
  reportFlushCost(ms: number): void {
    this.lastFlushCost = Math.max(0, ms)
  }

  /** Flush immediately and cancel any pending timer — the RN-lifecycle
   *  equivalent of the desktop's unmount/focus/visibility-change flush. */
  flushNow(): void {
    if (this.timerHandle !== null) {
      this.clearTimeoutFn(this.timerHandle)
      this.timerHandle = null
    }

    this.lastFlushAt = this.now()
    this.flushCallback()
  }

  /** Cancel any pending timer without flushing (teardown). */
  dispose(): void {
    if (this.timerHandle !== null) {
      this.clearTimeoutFn(this.timerHandle)
      this.timerHandle = null
    }
  }
}
