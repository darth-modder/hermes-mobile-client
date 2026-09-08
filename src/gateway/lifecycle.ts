/**
 * M07's AppState/network half of "the app survives backgrounding, doze, and
 * network switches" — the WS-protocol half (both `session.reclaimed`
 * outcomes, `gateway.ready` replay-epoch cold start, `replay.truncated`
 * hydration) already lives in session-stream/lifecycle.ts and
 * session-connection.ts; this module owns only WHEN to redial, not WHAT
 * happens on reconnect (fetchReplay() and the reducer's own handling cover
 * that automatically once the socket is back up).
 *
 * `active -> background` is deliberately a no-op here (D10, 2026-09-08):
 * D2's original client-side 20s grace-then-close cannot be implemented as a
 * JS timer on Android (the RN JS thread is suspended for the whole
 * background window, so the timer fires late, on resume, racing the very
 * reconnect it was meant to precede — see
 * M07-sessions-and-lifecycle.md's Deviations #3/#7 and the "D2 re-examined"
 * section). The socket is left to the OS (observed to survive well past 90s
 * backgrounded untouched) and the server's own independent orphan reap
 * (`ws_orphan_reap_grace_s`, D2); the client only ever decides what to do on
 * *return* to foreground/network.
 *
 * Deliberately decoupled from `MobileGateway`/`session-connection.ts`'s
 * concrete shape — the caller passes a plain `reconnectAndProbe` callback so
 * this class needs no RN/Expo module and no real socket to unit-test. The
 * real wiring (a hook mounted once near the app root) supplies
 * `() => ensureGatewayConnection().then(g => g.request('ping', {}, 5000))`.
 *
 * `close_on_disconnect` is never sent (grep confirms no caller anywhere in
 * this app sets it) — nothing here needs to opt out of it either.
 */

export type AppLifecycleStatus = 'active' | 'background' | 'inactive'
export type NetworkLifecycleState = 'closed' | 'open'

export interface AppLifecycleOptions {
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
 * Owns exactly the foreground/network-restore reconnect-and-probe trigger.
 * `active -> background` is a no-op — see the file doc comment. Framework-
 * specific listener wiring (AppState.addEventListener, expo-network's event)
 * is the caller's job — see useAppLifecycle below for the real one.
 */
export class AppLifecycle {
  private readonly reconnectAndProbeFn: () => Promise<void>

  constructor(options: AppLifecycleOptions) {
    this.reconnectAndProbeFn = options.reconnectAndProbe
  }

  /** `AppState`'s `change` event. `background`/`inactive` are no-ops — see
   *  the file doc comment for why. */
  handleAppStateChange(status: AppLifecycleStatus): void {
    if (status === 'active') {
      void this.reconnectAndProbeFn()
    }
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

  /** Teardown (app unmount). No-op today — kept as the symmetric half of
   *  construction for `useAppLifecycle`'s effect cleanup, since this class
   *  is a per-mount instance and any future per-instance state would need
   *  the same hook. */
  dispose(): void {}
}
