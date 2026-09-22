// D31 point 7: approval.respond/clarify.respond/sudo.respond/secret.respond
// are all success-shaped RPCs even when the request they're answering already
// died server-side before the answer arrived (expired, resolved by another
// client, or its turn ended) — the server never raises an error for this.
//
// approval has no server-pushed expire event at all (unlike the other three
// — see input-requests.ts's clarify.expire/sudo.expire/secret.expire
// handling, upstream's `_EXPIRING_REQUESTS` in tui_gateway/server.py, which
// does not include "approval.request"), so a stale approval card's only
// warning that it's already dead is this RPC response shape.
//
// Two different upstream success shapes, easy to confuse with "it worked":
//
//   approval.respond -> tools/approval.py:137-169 resolve_gateway_approval()
//     returns an int count of requests actually resolved. `if not targets:
//     return 0` for an unknown/expired request_id — no exception. Wrapped by
//     methods_prompt.py's `_approval_reply` (~1099-1105) as `_ok(rid,
//     {"resolved": <int>})`. Genuine success: resolved >= 1. Dead: resolved === 0.
//
//   clarify.respond / sudo.respond / secret.respond -> all three route
//     through the shared `_respond(rid, params, key, allow_expired=True)`
//     helper (methods_prompt.py ~1076-1094, ~1158-1172). A request id that's
//     no longer pending returns `_ok(rid, {"status": "expired"})` instead of
//     the raw 4009 `no pending {key} request` error it would otherwise raise
//     (server.py:3018's `_respond`: `if not entry: return _ok(rid, {"status":
//     "expired"}) if allow_expired and r else _err(...)`). Genuine success:
//     {"status": "ok"}. Dead: {"status": "expired"}.
//
// Pinned as separate functions (not one shared check) so the two shapes stay
// visibly distinct at every call site — collapsing them risks checking the
// wrong field for a kind and silently never detecting "dead" for it.

export interface ApprovalRespondResult {
  resolved?: number
}

export interface ClarifyRespondResult {
  status?: string
}

export interface SudoRespondResult {
  status?: string
}

export interface SecretRespondResult {
  status?: string
}

/** tools/approval.py:137-169. Genuine success: `resolved` >= 1. */
export function isApprovalRespondDead(result: ApprovalRespondResult | undefined): boolean {
  return result?.resolved === 0
}

/** methods_prompt.py's shared `_respond(..., allow_expired=True)`. Genuine success: `status === 'ok'`. */
export function isClarifyRespondDead(result: ClarifyRespondResult | undefined): boolean {
  return result?.status === 'expired'
}

/** Same `_respond(..., allow_expired=True)` helper as clarify, keyed to `sudo.respond`. */
export function isSudoRespondDead(result: SudoRespondResult | undefined): boolean {
  return result?.status === 'expired'
}

/** Same `_respond(..., allow_expired=True)` helper as clarify, keyed to `secret.respond`. */
export function isSecretRespondDead(result: SecretRespondResult | undefined): boolean {
  return result?.status === 'expired'
}
