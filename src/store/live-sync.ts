/**
 * "Backend data changed" ticks for the management screens (M10). Mirrors
 * apps/desktop/src/store/live-sync.ts's pattern (a monotonic counter per
 * broadcast event, bumped by the gateway-event handler, watched by the
 * screens that used to poll) — trimmed to the three `*.changed` events M10's
 * screens actually consume. `tui_gateway/change_watcher.py`'s
 * `_broadcast_watched_changes` emits these as global JSON-RPC events (no
 * session_id) whenever their on-disk signature moves; every connected socket
 * gets them, so this is push, not poll.
 *
 * `sessions.changed`/`pet.changed`/`bot_relay.outbox.pending` are not wired
 * here — no M10 screen needs them (session list refresh already has its own
 * effect via src/store/sessions.ts, wired in M07).
 */

import { atom } from 'nanostores'

/** Bumped on `cron.changed` — the exit criterion's "list updates live". */
export const $cronChangeTick = atom(0)

/** Bumped on `platforms.changed` (messaging gateway connect/disconnect/health). */
export const $platformsChangeTick = atom(0)

/** Bumped on `pairing.changed` (a DM pairing request arrived, or was approved/revoked elsewhere). */
export const $pairingChangeTick = atom(0)

export function notifyCronChanged(): void {
  $cronChangeTick.set($cronChangeTick.get() + 1)
}

export function notifyPlatformsChanged(): void {
  $platformsChangeTick.set($platformsChangeTick.get() + 1)
}

export function notifyPairingChanged(): void {
  $pairingChangeTick.set($pairingChangeTick.get() + 1)
}
