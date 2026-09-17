// Connection metadata (label, baseUrl, authMode, ...) — MMKV-backed via
// src/lib/storage.ts. Exactly one connection is *active* at a time (M04) —
// the one the gateway dials and REST calls target — but the phone can now
// (M09) know about more than one: `connections.list` is the full registry
// the connections settings screen manages (add/edit/test/delete, primary,
// last-used). Secrets never live here — see secure.ts.

import { readJson, writeJson } from '../lib/storage'

import type { MobileConnection } from './types'

const ACTIVE_CONNECTION_KEY = 'connections.active'
const CONNECTION_LIST_KEY = 'connections.list'

export function getActiveConnection(): MobileConnection | null {
  return readJson<MobileConnection>(ACTIVE_CONNECTION_KEY)
}

function readList(): MobileConnection[] {
  return readJson<MobileConnection[]>(CONNECTION_LIST_KEY) ?? []
}

function writeList(list: MobileConnection[]): void {
  writeJson(CONNECTION_LIST_KEY, list)
}

/** Upsert `connection` into the persisted list by id, without touching which
 *  connection is active. The first connection ever registered becomes
 *  primary automatically (there is otherwise no way to pick one). */
function registerConnection(connection: MobileConnection): void {
  const list = readList()
  const existing = list.find(c => c.id === connection.id)
  const next = { ...connection, primary: existing?.primary ?? list.length === 0 }
  const withoutThis = list.filter(c => c.id !== connection.id)

  writeList([...withoutThis, next])
}

/** Self-heals a gap the list-backed registry (M09) can't otherwise close on
 *  its own: a connection saved by pre-M09 code (or restored from an older
 *  MMKV snapshot) only ever wrote `connections.active` — there was no list
 *  to register into yet. Without this, the connections screen would show
 *  "no saved connections" while the app is actively dialing one. */
function withActiveBackfilled(list: MobileConnection[]): MobileConnection[] {
  const active = getActiveConnection()

  if (!active || list.some(c => c.id === active.id)) {
    return list
  }

  return [...list, { ...active, primary: list.length === 0 }]
}

/** Every known connection (add/edit/test/delete, primary, last-used — M09's
 *  connections settings screen). Order is insertion order; the screen sorts
 *  for display. */
export function listConnections(): MobileConnection[] {
  return withActiveBackfilled(readList())
}

export function getConnection(id: string): MobileConnection | null {
  return withActiveBackfilled(readList()).find(c => c.id === id) ?? null
}

/** Sets `connection` as the live one the gateway dials and REST calls
 *  target, AND upserts it into the persisted list (registerConnection) so it
 *  shows up in the connections screen — every existing caller (the token and
 *  password connect flows) is "add a connection and start using it now", so
 *  this single entry point covers both without those callers changing. */
export function setActiveConnection(connection: MobileConnection | null): void {
  writeJson(ACTIVE_CONNECTION_KEY, connection)

  if (connection) {
    registerConnection(connection)
  }

  logRegistryState()
}

/** Add or edit a connection's metadata in the registry without making it
 *  active — the connections screen's own add/edit forms. */
export function upsertConnection(connection: MobileConnection): void {
  registerConnection(connection)

  // Keep the active copy in sync if this IS the active connection, the same
  // way updateActiveConnection does below.
  const active = getActiveConnection()

  if (active && active.id === connection.id) {
    writeJson(ACTIVE_CONNECTION_KEY, connection)
  }
}

/** Remove a connection from the registry. If it was active, the active slot
 *  is cleared — callers (the connections screen) decide what happens next
 *  (e.g. switch to the primary connection, or send the user to `/connect`). */
export function deleteConnection(id: string): void {
  writeList(readList().filter(c => c.id !== id))

  const active = getActiveConnection()

  if (active && active.id === id) {
    writeJson(ACTIVE_CONNECTION_KEY, null)
  }

  logRegistryState()
}

/** Marks exactly one connection primary; every other list entry is
 *  unmarked. A no-op if `id` isn't in the registry. */
export function setPrimaryConnection(id: string): void {
  const list = readList()

  if (!list.some(c => c.id === id)) {
    return
  }

  writeList(list.map(c => ({ ...c, primary: c.id === id })))
  logRegistryState()
}

export function getPrimaryConnection(): MobileConnection | null {
  return withActiveBackfilled(readList()).find(c => c.primary) ?? null
}

/** Makes an existing registry entry the active connection (switching), and
 *  bumps its `lastUsedAt`. Returns null if `id` isn't in the registry. */
export function switchActiveConnection(id: string): MobileConnection | null {
  const connection = getConnection(id)

  if (!connection) {
    return null
  }

  const activated = { ...connection, lastUsedAt: Date.now() }

  writeJson(ACTIVE_CONNECTION_KEY, activated)
  registerConnection(activated)
  logRegistryState()

  return activated
}

/** Functional update of the active connection. A no-op (returns null) when
 *  there isn't one — callers that need one to exist should check first. */
export function updateActiveConnection(
  updater: (connection: MobileConnection) => MobileConnection
): MobileConnection | null {
  const current = getActiveConnection()

  if (!current) {
    return null
  }

  const next = updater(current)

  setActiveConnection(next)

  return next
}

export function clearActiveConnection(): void {
  setActiveConnection(null)
}

/** The exact text `logRegistryState` below would print, as an array of
 *  lines — split out so a test can assert on the content without depending
 *  on the `__DEV__` global (absent under plain Node/vitest; see the guard
 *  below). Only id/label/primary/needsLogin ever appear here — never
 *  `baseUrl`, `authMode` or `headerNames`, and never anything from
 *  secure.ts (this module never imports it), so there is no token, secret
 *  or header value this can leak. */
export function registryLogLines(): string[] {
  const active = getActiveConnection()
  const lines = [`active: ${active ? `${active.id} (${active.label})` : 'none'}`]

  for (const connection of listConnections()) {
    lines.push(
      `list: ${connection.id} (${connection.label}) primary=${Boolean(connection.primary)} needsLogin=${Boolean(connection.needsLogin)}`
    )
  }

  return lines
}

/** __DEV__-only readback of the registry's actual state, read through the
 *  same functions the app itself reads through — never a raw MMKV byte
 *  scan, which round 4 found returns stale bytes left behind by an earlier,
 *  larger write that a shorter overwrite doesn't zero out (see M15's
 *  Verification log, round 4 task 0). This is the storage readback to trust
 *  from here on. Call once at startup (`app/_layout.tsx`) and after every
 *  registry write. */
export function logRegistryState(): void {
  if (typeof __DEV__ === 'undefined' || !__DEV__) {
    return
  }

  for (const line of registryLogLines()) {
    console.log(`[registry] ${line}`)
  }
}
