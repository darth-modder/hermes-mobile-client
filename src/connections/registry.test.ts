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
const { readJson, writeJson } = await import('../lib/storage')

const {
  clearActiveConnection,
  deleteConnection,
  getActiveConnection,
  getConnection,
  getPrimaryConnection,
  listConnections,
  logRegistryState,
  registryLogLines,
  setActiveConnection,
  setPrimaryConnection,
  switchActiveConnection,
  updateActiveConnection,
  upsertConnection
} = registry

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

  const CONNECTION_2 = {
    id: 'conn-2',
    kind: 'remote' as const,
    label: 'Second',
    baseUrl: 'http://127.0.0.1:9120',
    authMode: 'password' as const
  }

  describe('the connections list (M09)', () => {
    it('starts empty', () => {
      expect(listConnections()).toEqual([])
      expect(getConnection('conn-1')).toBeNull()
      expect(getPrimaryConnection()).toBeNull()
    })

    it('setActiveConnection registers the connection into the list, primary by default', () => {
      setActiveConnection(CONNECTION)

      expect(listConnections()).toEqual([{ ...CONNECTION, primary: true }])
      expect(getPrimaryConnection()).toEqual({ ...CONNECTION, primary: true })
      // The active copy itself is unchanged — round-trip stays exact for
      // existing callers (session-connection.ts, push/api.ts, voice/api.ts).
      expect(getActiveConnection()).toEqual(CONNECTION)
    })

    it('a second connection is not primary; the first stays primary', () => {
      setActiveConnection(CONNECTION)
      setActiveConnection(CONNECTION_2)

      const list = listConnections()

      expect(list.find(c => c.id === 'conn-1')?.primary).toBe(true)
      expect(list.find(c => c.id === 'conn-2')?.primary).toBe(false)
      // Active tracks whichever was set last.
      expect(getActiveConnection()).toEqual(CONNECTION_2)
    })

    it('upsertConnection edits metadata without touching which connection is active', () => {
      setActiveConnection(CONNECTION)
      upsertConnection({ ...CONNECTION, label: 'Renamed' })

      expect(getConnection('conn-1')?.label).toBe('Renamed')
      expect(getActiveConnection()?.label).toBe('Renamed')
    })

    it('upsertConnection on a non-active connection leaves the active one alone', () => {
      setActiveConnection(CONNECTION)
      upsertConnection(CONNECTION_2)

      expect(getConnection('conn-2')).toEqual({ ...CONNECTION_2, primary: false })
      expect(getActiveConnection()).toEqual(CONNECTION)
    })

    it('setPrimaryConnection moves the flag; a no-op for an unknown id', () => {
      setActiveConnection(CONNECTION)
      setActiveConnection(CONNECTION_2)

      setPrimaryConnection('conn-2')

      expect(getConnection('conn-1')?.primary).toBe(false)
      expect(getConnection('conn-2')?.primary).toBe(true)

      setPrimaryConnection('does-not-exist')
      expect(getConnection('conn-2')?.primary).toBe(true)
    })

    it('switchActiveConnection activates a registered connection and bumps lastUsedAt', () => {
      setActiveConnection(CONNECTION)
      setActiveConnection(CONNECTION_2)

      const before = Date.now()
      const activated = switchActiveConnection('conn-1')

      expect(activated?.id).toBe('conn-1')
      expect(activated?.lastUsedAt).toBeGreaterThanOrEqual(before)
      expect(getActiveConnection()?.id).toBe('conn-1')
      expect(switchActiveConnection('does-not-exist')).toBeNull()
    })

    it('backfills a connection an OLDER build wrote straight to `connections.active` with no list entry', () => {
      // Regression: writing `connections.active` via MMKV directly, bypassing
      // setActiveConnection — reproduces state left behind by any code that
      // predates this file's list-registration (found live: a connection
      // set up before this change showed "no saved connections" here).
      writeJson('connections.active', CONNECTION)

      expect(listConnections()).toEqual([{ ...CONNECTION, primary: true }])
      expect(getConnection('conn-1')).toEqual({ ...CONNECTION, primary: true })
      expect(getPrimaryConnection()).toEqual({ ...CONNECTION, primary: true })
      // Backfill is a read-time view, not a write — nothing is persisted to
      // the list until an actual registry mutation happens.
      expect(readJson('connections.list')).toBeNull()
    })

    it('deleteConnection removes the entry and clears active only if it was active', () => {
      setActiveConnection(CONNECTION)
      setActiveConnection(CONNECTION_2)

      deleteConnection('conn-1')
      expect(listConnections().map(c => c.id)).toEqual(['conn-2'])
      // conn-1 was not active (conn-2 is), so active is untouched.
      expect(getActiveConnection()?.id).toBe('conn-2')

      deleteConnection('conn-2')
      expect(listConnections()).toEqual([])
      expect(getActiveConnection()).toBeNull()
    })
  })

  // M15 round 5 task 0: this is now the trusted storage readback (never a
  // raw MMKV byte scan — round 4 found that returns stale bytes). Asserts
  // the log text itself never carries anything secret-shaped.
  describe('the registry readback log', () => {
    it('registryLogLines carries only id/label/primary/needsLogin, never baseUrl, authMode or header names', () => {
      setActiveConnection({
        ...CONNECTION,
        headerNames: ['CF-Access-Client-Id'],
        needsLogin: true
      })
      setActiveConnection(CONNECTION_2)

      const text = registryLogLines().join('\n')

      expect(text).toContain('conn-1')
      expect(text).toContain('Test')
      expect(text).toContain('needsLogin=true')
      expect(text).not.toContain(CONNECTION.baseUrl)
      expect(text).not.toContain('token')
      expect(text).not.toContain('CF-Access-Client-Id')
      expect(text).not.toContain('headerNames')
      expect(text).not.toContain('secret')
    })

    it('logRegistryState prints nothing without __DEV__ (as under vitest/Node, where the global is absent)', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

      setActiveConnection(CONNECTION)
      logRegistryState()

      expect(logSpy).not.toHaveBeenCalled()
      logSpy.mockRestore()
    })
  })
})
