/**
 * M07's AppState/network half of "the app survives backgrounding, doze, and
 * network switches" — the WS-protocol half (both `session.reclaimed`
 * outcomes, `gateway.ready` replay-epoch cold start, `replay.truncated`
 * hydration) already lives in session-stream/lifecycle.ts and
 * session-connection.ts; this module owns only WHEN to close/redial, not
 * WHAT happens on reconnect (fetchReplay() and the reducer's own handling
 * cover that automatically once the socket is back up).
 *
 * Deliberately decoupled from `MobileGateway`/`session-connection.ts`'s
 * concrete shape — callers pass plain callbacks (`closeConnection`,
 * `reconnectAndProbe`) so this class needs no RN/Expo module and no real
 * socket to unit-test. The real wiring (a hook mounted once near the app
 * root) supplies `() => gateway?.close()` and
 * `() => ensureGatewayConnection().then(g => g.request('ping', {}, 5000))`.
 *
 * `close_on_disconnect` is never sent (grep confirms no caller anywhere in
 * this app sets it) — nothing here needs to opt out of it either.
 */

export type AppLifecycleStatus = 'active' | 'background' | 'inactive'
export type NetworkLifecycleState = 'closed' | 'open'

export const BACKGROUND_GRACE_MS = 20_000

export interface AppLifecycleOptions {
  /** `AppState`'s own default export shape (active/background/inactive) —
   *  `background` and `inactive` are treated identically: anything that
   *  isn't `active` starts the grace timer. */
  backgroundGraceMs?: number
  /** Close the live gateway socket — called once the grace elapses. */
  closeConnection: () => void
  /** Injectable timer, for tests. Defaults to the global setTimeout/clearTimeout. */
  clearTimeout?: (handle: number) => void
  setTimeout?: (callback: () => void, ms: number) => number
  /** Redial (a no-op if already connected — `ensureGatewayConnection`'s own
   *  contract) and send a bounded `ping` as a half-open probe: a socket that
   *  LOOKS open (no close event fired yet) but whose peer vanished without a
   *  clean close — a stale Wi-Fi AP, a NAT timeout — won't error until
   *  something tries to use it. `reconnectAndProbe` rejecting means "redial,
   *  or the probe itself" failed; the caller's own reconnect-backoff/retry
   *  (already built for the ordinary socket-close path) handles it the same
   *  way, so this module doesn't need its own retry loop. */
  reconnectAndProbe: () => Promise<void>
}

/**
 * Owns exactly the background-grace-then-close timer and the
 * foreground/network-restore reconnect-and-probe trigger. Framework-specific
 * listener wiring (AppState.addEventListener, expo-network's event) is the
 * caller's job — see useAppLifecycle below for the real one.
 */
export class AppLifecycle {
  private readonly backgroundGraceMs: number
  private readonly closeConnectionFn: () => void
  private readonly clearTimeoutFn: (handle: number) => void
  private readonly setTimeoutFn: (callback: () => void, ms: number) => number
  private readonly reconnectAndProbeFn: () => Promise<void>

  private graceTimerHandle: null | number = null

  constructor(options: AppLifecycleOptions) {
    this.backgroundGraceMs = options.backgroundGraceMs ?? BACKGROUND_GRACE_MS
    this.closeConnectionFn = options.closeConnection
    this.reconnectAndProbeFn = options.reconnectAndProbe
    this.setTimeoutFn = options.setTimeout ?? ((callback, ms) => setTimeout(callback, ms) as unknown as number)
    this.clearTimeoutFn =
      options.clearTimeout ?? (handle => clearTimeout(handle as unknown as ReturnType<typeof setTimeout>))
  }

  /** `AppState`'s `change` event. */
  handleAppStateChange(status: AppLifecycleStatus): void {
    if (status === 'active') {
      this.cancelGrace()
      void this.reconnectAndProbeFn()

      return
    }

    this.scheduleGrace()
  }

  /** `expo-network`'s connectivity-change event, collapsed to "reachable at
   *  all" — this module doesn't distinguish Wi-Fi from cellular (M07's task
   *  line: "if closed, reset backoff and redial; if open, ping probe"). A
   *  `closed -> open` transition (network came back, or switched) redials +
   *  probes exactly like returning to the foreground; `open -> closed` has
   *  nothing productive to do until the network is back, so it's a no-op —
   *  the socket's own close/error handling (already built) reacts if the
   *  transport actually notices the network is gone. */
  handleNetworkChange(state: NetworkLifecycleState, previous: NetworkLifecycleState): void {
    if (state === 'open' && previous === 'closed') {
      void this.reconnectAndProbeFn()
    }
  }

  private scheduleGrace(): void {
    if (this.graceTimerHandle !== null) {
      return
    }

    this.graceTimerHandle = this.setTimeoutFn(() => {
      this.graceTimerHandle = null
      this.closeConnectionFn()
    }, this.backgroundGraceMs)
  }

  private cancelGrace(): void {
    if (this.graceTimerHandle !== null) {
      this.clearTimeoutFn(this.graceTimerHandle)
      this.graceTimerHandle = null
    }
  }

  /** Teardown (app unmount — never happens in practice, but tests want it). */
  dispose(): void {
    this.cancelGrace()
  }
}
