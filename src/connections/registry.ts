// Connection metadata (label, baseUrl, authMode, ...) — MMKV-backed via
// src/lib/storage.ts. One active connection in v1 (M04). Secrets never live
// here — see secure.ts.

import { readJson, writeJson } from '../lib/storage'

import type { MobileConnection } from './types'

const ACTIVE_CONNECTION_KEY = 'connections.active'

export function getActiveConnection(): MobileConnection | null {
  return readJson<MobileConnection>(ACTIVE_CONNECTION_KEY)
}

export function setActiveConnection(connection: MobileConnection | null): void {
  writeJson(ACTIVE_CONNECTION_KEY, connection)
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
