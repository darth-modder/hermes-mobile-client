import { beforeEach, describe, expect, it, vi } from 'vitest'

// react-native-mmkv wraps a native binding that doesn't exist under vitest
// (Node). Mock it with a plain in-memory Map so storage.ts's own logic —
// everything above the native get/set/delete calls — gets real coverage.
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

const storage = await import('./storage')

describe('storage', () => {
  beforeEach(() => {
    backing.clear()
  })

  it('round-trips a raw string', () => {
    expect(storage.readKey('k')).toBeNull()
    storage.writeKey('k', 'v')
    expect(storage.readKey('k')).toBe('v')
    storage.writeKey('k', null)
    expect(storage.readKey('k')).toBeNull()
  })

  it('round-trips JSON, and returns null for malformed JSON', () => {
    storage.writeJson('obj', { a: 1 })
    expect(storage.readJson<{ a: number }>('obj')).toEqual({ a: 1 })

    storage.writeKey('bad', '{not json')
    expect(storage.readJson('bad')).toBeNull()

    storage.writeJson('cleared', { a: 1 })
    storage.writeJson('cleared', null)
    expect(storage.readKey('cleared')).toBeNull()
  })

  it('storedBoolean / persistBoolean round-trip with a fallback', () => {
    expect(storage.storedBoolean('flag', true)).toBe(true)
    storage.persistBoolean('flag', false)
    expect(storage.storedBoolean('flag', true)).toBe(false)
  })

  it('storedStringArray drops non-string/empty entries and malformed JSON', () => {
    expect(storage.storedStringArray('missing')).toEqual([])

    storage.persistStringArray('arr', ['a', 'b'])
    expect(storage.storedStringArray('arr')).toEqual(['a', 'b'])

    storage.writeKey('arr2', JSON.stringify(['a', '', 1, null, 'b']))
    expect(storage.storedStringArray('arr2')).toEqual(['a', 'b'])

    storage.writeKey('arr3', 'not json')
    expect(storage.storedStringArray('arr3')).toEqual([])

    storage.persistStringArray('arr', [])
    expect(storage.readKey('arr')).toBeNull()
  })

  it('storedStringRecord drops non-string values and rejects arrays/malformed JSON', () => {
    expect(storage.storedStringRecord('missing')).toEqual({})

    storage.persistStringRecord('rec', { a: '1', b: '2' })
    expect(storage.storedStringRecord('rec')).toEqual({ a: '1', b: '2' })

    storage.writeKey('rec2', JSON.stringify({ a: '1', b: 2 }))
    expect(storage.storedStringRecord('rec2')).toEqual({ a: '1' })

    storage.writeKey('rec3', JSON.stringify(['a', 'b']))
    expect(storage.storedStringRecord('rec3')).toEqual({})
  })

  it('emits a persistence event for every read/write/remove', () => {
    const events: unknown[] = []
    const stop = storage.onPersistenceEvent(event => events.push(event))

    storage.writeKey('ev', 'x')
    storage.readKey('ev')
    storage.writeKey('ev', null)
    stop()
    storage.writeKey('ev', 'after-stop')

    expect(events).toEqual([
      { key: 'ev', op: 'write', value: 'x' },
      { key: 'ev', op: 'read', value: 'x' },
      { key: 'ev', op: 'remove', value: null }
    ])
  })

  it('arraysEqual compares order-sensitively', () => {
    expect(storage.arraysEqual(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(storage.arraysEqual(['a', 'b'], ['b', 'a'])).toBe(false)
    expect(storage.arraysEqual(['a'], ['a', 'b'])).toBe(false)
  })

  it('insertUniqueId moves an existing id and clamps the index', () => {
    expect(storage.insertUniqueId(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
    expect(storage.insertUniqueId(['a', 'b'], 'z', 99)).toEqual(['a', 'b', 'z'])
    expect(storage.insertUniqueId(['a', 'b'], 'z', -5)).toEqual(['z', 'a', 'b'])
  })
})
