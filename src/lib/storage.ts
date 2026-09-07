// Pure port of apps/desktop/src/lib/storage.ts's synchronous readKey/writeKey
// contract, backed by react-native-mmkv instead of window.localStorage.
// Everything below readKey/writeKey (readJson, storedBoolean, ...) is ported
// unchanged — none of it ever touched `window` directly.
//
// MMKV is synchronous on the JS thread (unlike AsyncStorage), which is what
// makes this a faithful port at all: the desktop's whole persistence
// contract assumes readKey/writeKey never yield.

import { createMMKV, type MMKV } from 'react-native-mmkv'

export interface PersistenceEvent {
  key: string
  op: 'read' | 'remove' | 'write'
  value: null | string
}

type PersistenceListener = (event: PersistenceEvent) => void

const persistenceListeners = new Set<PersistenceListener>()

/** Observe every persisted get/set (e.g. pipe into telemetry/sync). */
export function onPersistenceEvent(listener: PersistenceListener): () => void {
  persistenceListeners.add(listener)

  return () => void persistenceListeners.delete(listener)
}

function emitPersistence(event: PersistenceEvent) {
  for (const listener of persistenceListeners) {
    listener(event)
  }
}

// Lazily constructed: importing this module must not touch the native MMKV
// binding until something actually reads or writes (keeps this module safe
// to import from a test file that mocks 'react-native-mmkv').
let storage: MMKV | null = null

function store(): MMKV {
  storage ??= createMMKV({ id: 'hermes-android' })

  return storage
}

/** Raw read. Returns null when absent or storage is unavailable. */
export function readKey(key: string): null | string {
  let value: null | string = null

  try {
    value = store().getString(key) ?? null
  } catch {
    // Restricted contexts read as absent.
  }

  emitPersistence({ key, op: 'read', value })

  return value
}

/** Raw write. A null value removes the key. Best-effort. */
export function writeKey(key: string, value: null | string) {
  try {
    if (value === null) {
      store().remove(key)
    } else {
      store().set(key, value)
    }
  } catch {
    // Storage is best-effort; never let a write error break the UI.
  }

  emitPersistence({ key, op: value === null ? 'remove' : 'write', value })
}

/** Parsed JSON read. Returns null on absence, unavailable storage, OR
 *  malformed JSON — callers layer their own shape validation on the result. */
export function readJson<T>(key: string): T | null {
  const raw = readKey(key)

  if (raw === null) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

/** JSON write; a null value removes the key. Best-effort (see writeKey). */
export function writeJson(key: string, value: unknown) {
  writeKey(key, value === null ? null : JSON.stringify(value))
}

export function storedBoolean(key: string, fallback: boolean): boolean {
  const value = readKey(key)

  return value === null ? fallback : value === 'true'
}

export function persistBoolean(key: string, value: boolean) {
  writeKey(key, String(value))
}

export function storedString(key: string): null | string {
  return readKey(key)
}

export function persistString(key: string, value: null | string) {
  writeKey(key, value)
}

export function storedStringArray(key: string): string[] {
  const value = readKey(key)

  if (!value) {
    return []
  }

  try {
    const parsed = JSON.parse(value)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
  } catch {
    return []
  }
}

export function persistStringArray(key: string, value: string[]) {
  writeKey(key, value.length === 0 ? null : JSON.stringify(value))
}

export function storedStringRecord(key: string): Record<string, string> {
  const value = readKey(key)

  if (!value) {
    return {}
  }

  try {
    const parsed = JSON.parse(value)

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    )
  } catch {
    return {}
  }
}

export function persistStringRecord(key: string, value: Record<string, string>) {
  writeKey(key, JSON.stringify(value))
}

export function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index])
}

export function insertUniqueId(ids: string[], id: string, index: number) {
  const next = ids.filter(item => item !== id)
  const boundedIndex = Math.min(Math.max(index, 0), next.length)
  next.splice(boundedIndex, 0, id)

  return next
}
