/**
 * The wrong-address guard for the connect flow (M15 D).
 *
 * `docs/mobile-prototypes/connect.html` makes this a `Field:` in its own
 * right (:17-19) — "the wrong-address guard stated with its reason". The
 * point is not to block a typo; it is that typing your computer's *loopback*
 * address into a phone is a category error that otherwise fails slowly, as a
 * connection timeout, with nothing on screen explaining why.
 *
 * **Layers searched for an existing guard** (M14 Deviation 13's rule):
 * 1. `src/upstream/` — nothing. `src/upstream/i18n/en.ts` mentions loopback
 *    only to *recommend* it (`:862` `localDesc`, "Start a private Hermes
 *    backend on localhost") and ships `http://127.0.0.1:8080` as a
 *    placeholder (`:1901`). The desktop has no such guard because on the
 *    desktop loopback is correct — it IS the host.
 * 2. `src/` — no existing check. `src/net/auth/loopback-listener.ts:3` and
 *    `src/net/auth/native-login.ts:164` do use `127.0.0.1`, but for the
 *    opposite purpose: the RFC 8252 native-login redirect, where the phone
 *    listening on itself is exactly right. This guard is about *dialling
 *    out* and must never be applied there.
 * 3. `node_modules/` — no `ip`/`is-loopback-addr` style dependency.
 *
 * Pure: no React, no network, no platform calls, so it is unit-testable and
 * can run on every keystroke (the prototype's Behaviour block requires
 * exactly that).
 */

/** Which of the three wrong-address families the host fell into. The caller
 *  maps this to copy; this module deliberately holds no strings. */
export type GatewayUrlRejection = 'emulator-host' | 'loopback' | 'unspecified'

/**
 * Which entry path the user is on. The two differ on **one** address, and
 * the prototype is explicit about why (connect.html:40-43): on the Tailscale
 * path `10.0.2.2` is rejected "the same way (M15 exit criterion)"; on the
 * "Enter a URL" path "it is allowed, because on an emulator it IS the
 * computer". That second path's own card offers "a LAN address, a reverse
 * proxy, or an emulator host" (`:start` view), so rejecting it there would
 * contradict the screen's own description.
 */
export type GatewayUrlMode = 'tailscale' | 'url'

export interface GatewayUrlVerdict {
  /** The parsed lowercase hostname, when one could be read at all. */
  host: null | string
  ok: boolean
  rejection?: GatewayUrlRejection
}

/**
 * Hostname out of something a person typed. Deliberately lenient about the
 * scheme — the guard has to answer while the field is half-written, and
 * "127.0.0.1:9119" with no scheme is the most likely way to type the thing
 * we most want to catch. IPv6 literals keep their brackets stripped so `::1`
 * compares equal whether or not it was bracketed.
 */
export function parseGatewayHost(raw: string): null | string {
  const trimmed = raw.trim()

  if (!trimmed) {
    return null
  }

  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`

  let host: string

  try {
    host = new URL(withScheme).hostname
  } catch {
    return null
  }

  // `URL` keeps IPv6 literals bracketed (`[::1]`); compare the address itself.
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1)
  }

  return host.toLowerCase() || null
}

/**
 * Every IPv4 address in `127.0.0.0/8`, not just `127.0.0.1`.
 *
 * RFC 1122 §3.2.1.3 assigns the whole `/8` as loopback, and the kernel
 * honours it — `127.0.0.2` reaches the phone exactly as `127.0.0.1` does, so
 * guarding only the famous one would leave a working way to make the same
 * mistake. Checked numerically rather than by prefix string so `127.0.0.1`
 * and `127.1` (which `URL` normalises) both land here, and so something like
 * `1270.0.0.1` does not.
 */
function isIpv4Loopback(host: string): boolean {
  const parts = host.split('.')

  if (parts.length !== 4 || !parts.every(p => /^\d{1,3}$/.test(p))) {
    return false
  }

  const octets = parts.map(Number)

  return octets.every(n => n <= 255) && octets[0] === 127
}

/**
 * IPv6 loopback, `::1` in any of its spellings. `URL` normalises
 * `0:0:0:0:0:0:0:1` to `::1`, but the un-normalised form can still arrive
 * when the string never parsed as a URL, so both are matched.
 */
function isIpv6Loopback(host: string): boolean {
  return host === '::1' || host === '0:0:0:0:0:0:0:1'
}

/**
 * The "unspecified" addresses, `0.0.0.0` and `::`.
 *
 * These are *bind* addresses meaning "every interface", not destinations —
 * which is exactly why they turn up here: `hermes serve --host 0.0.0.0` is a
 * real and correct command, and it is an easy thing to then copy into the
 * phone. Dialled as a destination, Linux and Android route `0.0.0.0` to the
 * local host, so it fails the same way loopback does and deserves the same
 * explanation rather than a timeout.
 */
function isUnspecified(host: string): boolean {
  return host === '0.0.0.0' || host === '::' || host === '0:0:0:0:0:0:0:0'
}

/**
 * `localhost` and anything under it. RFC 6761 §6.3 reserves the name and
 * requires resolvers to map it — and names under it — to loopback, so
 * `foo.localhost` is the same mistake as `localhost`.
 */
function isLocalhostName(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost')
}

/** The Android emulator's alias for the machine running it (QEMU user-mode
 *  networking maps `10.0.2.2` to the host's loopback). Real hardware has no
 *  such address, so on a phone it is simply wrong; on an emulator it is the
 *  developer's host, which is why `mode` decides. */
function isEmulatorHost(host: string): boolean {
  return host === '10.0.2.2'
}

/**
 * The guard. Returns `ok: true` for anything it has no specific objection to
 * — it is a blocklist of addresses that provably point back at this device,
 * never an allowlist of shapes, so an unusual-but-real hostname is never
 * blocked.
 */
export function checkGatewayUrl(raw: string, mode: GatewayUrlMode): GatewayUrlVerdict {
  const host = parseGatewayHost(raw)

  if (!host) {
    return { host: null, ok: true }
  }

  if (isIpv4Loopback(host) || isIpv6Loopback(host) || isLocalhostName(host)) {
    return { host, ok: false, rejection: 'loopback' }
  }

  if (isUnspecified(host)) {
    return { host, ok: false, rejection: 'unspecified' }
  }

  if (isEmulatorHost(host) && mode === 'tailscale') {
    return { host, ok: false, rejection: 'emulator-host' }
  }

  return { host, ok: true }
}
