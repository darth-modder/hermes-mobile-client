import { beforeEach, describe, expect, it, vi } from 'vitest'

const backing = new Map<string, string>()

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (key: string) => backing.get(key),
    remove: (key: string) => backing.delete(key),
    set: (key: string, value: string) => {
      backing.set(key, value)
    }
  })
}))

const { clearPushRegistration, needsReRegistration, pushProjectId, readPushRegistration, writePushRegistration } =
  await import('./register')

describe('push/register', () => {
  beforeEach(() => {
    backing.clear()
  })

  describe('pushProjectId', () => {
    it('returns null when extra is missing', () => {
      expect(pushProjectId(undefined)).toBeNull()
      expect(pushProjectId(null)).toBeNull()
    })

    it('returns null when extra.eas is missing', () => {
      expect(pushProjectId({})).toBeNull()
    })

    it('returns null when extra.eas.projectId is missing or empty', () => {
      expect(pushProjectId({ eas: {} })).toBeNull()
      expect(pushProjectId({ eas: { projectId: '' } })).toBeNull()
    })

    it('returns the project id when present', () => {
      expect(pushProjectId({ eas: { projectId: 'abc-123' } })).toBe('abc-123')
    })
  })

  describe('registration state', () => {
    it('defaults to empty when nothing is stored', () => {
      expect(readPushRegistration()).toEqual({ deviceId: null, token: null })
    })

    it('round-trips through write/read', () => {
      writePushRegistration({ deviceId: 'dev-1', token: 'tok-1' })
      expect(readPushRegistration()).toEqual({ deviceId: 'dev-1', token: 'tok-1' })
    })

    it('clearPushRegistration resets to empty', () => {
      writePushRegistration({ deviceId: 'dev-1', token: 'tok-1' })
      clearPushRegistration()
      expect(readPushRegistration()).toEqual({ deviceId: null, token: null })
    })
  })

  describe('needsReRegistration', () => {
    it('is true with no device id on file, even if the token matches', () => {
      expect(needsReRegistration({ deviceId: null, token: 'tok-1' }, 'tok-1')).toBe(true)
    })

    it('is true when the token rotated', () => {
      expect(needsReRegistration({ deviceId: 'dev-1', token: 'tok-1' }, 'tok-2')).toBe(true)
    })

    it('is false when the device id and token both already match', () => {
      expect(needsReRegistration({ deviceId: 'dev-1', token: 'tok-1' }, 'tok-1')).toBe(false)
    })
  })
})
