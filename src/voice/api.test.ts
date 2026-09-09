import { describe, expect, it, vi } from 'vitest'

// api.ts imports connections/registry (react-native-mmkv) and connections/secure
// (expo-secure-store) transitively via its restAuth() branches — mocked the same way
// src/api/sessions.test.ts and src/connections/registry.test.ts do, so this file doesn't try
// to load the real native modules under plain vitest.
vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => undefined,
    remove: () => undefined,
    set: () => undefined
  })
}))

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn()
}))

const { audioSpeakRequestTimeoutMs, audioTranscribeRequestTimeoutMs } = await import('./api')

describe('voice/api timeout formulas', () => {
  describe('audioTranscribeRequestTimeoutMs', () => {
    it('floors short clips at the minimum (180s)', () => {
      expect(audioTranscribeRequestTimeoutMs('data:audio/m4a;base64,abc')).toBe(180_000)
    })

    it('scales with data-url length, ~0.1ms/char', () => {
      const dataUrl = `data:audio/m4a;base64,${'a'.repeat(2_000_000)}`

      expect(audioTranscribeRequestTimeoutMs(dataUrl)).toBe(Math.ceil(dataUrl.length * 0.1))
    })

    it('caps at the maximum (600s) for very large clips', () => {
      const dataUrl = `data:audio/m4a;base64,${'a'.repeat(10_000_000)}`

      expect(audioTranscribeRequestTimeoutMs(dataUrl)).toBe(600_000)
    })
  })

  describe('audioSpeakRequestTimeoutMs', () => {
    it('floors short replies at the minimum (180s)', () => {
      expect(audioSpeakRequestTimeoutMs('hello')).toBe(180_000)
    })

    it('scales with text length, 35ms/char', () => {
      expect(audioSpeakRequestTimeoutMs('a'.repeat(10_000))).toBe(350_000)
    })

    it('caps at the maximum (600s) for very long replies', () => {
      expect(audioSpeakRequestTimeoutMs('a'.repeat(100_000))).toBe(600_000)
    })
  })
})
