import { beforeEach, describe, expect, it, vi } from 'vitest'

const backing = new Map<string, string>()

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => backing.get(key),
    set: (key: string, value: string) => {
      backing.set(key, value)
    },
    remove: (key: string) => backing.delete(key)
  })
}))

const registry = await import('./registry')
const { clearActiveConnection, getActiveConnection, setActiveConnection, updateActiveConnection } = registry

const CONNECTION = {
  id: 'conn-1',
  kind: 'remote' as const,
  label: 'Test',
  baseUrl: 'http://127.0.0.1:9119',
  authMode: 'token' as const
}

describe('connections/registry', () => {
  beforeEach(() => {
    backing.clear()
  })

  it('returns null when no connection is active', () => {
    expect(getActiveConnection()).toBeNull()
  })

  it('round-trips a connection through set/get', () => {
    setActiveConnection(CONNECTION)
    expect(getActiveConnection()).toEqual(CONNECTION)
  })

  it('clearActiveConnection removes it', () => {
    setActiveConnection(CONNECTION)
    clearActiveConnection()
    expect(getActiveConnection()).toBeNull()
  })

  it('updateActiveConnection is a no-op returning null when nothing is active', () => {
    const updater = vi.fn(c => c)
    expect(updateActiveConnection(updater)).toBeNull()
    expect(updater).not.toHaveBeenCalled()
  })

  it('updateActiveConnection applies the updater and persists the result', () => {
    setActiveConnection(CONNECTION)
    const updated = updateActiveConnection(c => ({ ...c, needsLogin: true }))

    expect(updated).toEqual({ ...CONNECTION, needsLogin: true })
    expect(getActiveConnection()).toEqual({ ...CONNECTION, needsLogin: true })
  })
})
