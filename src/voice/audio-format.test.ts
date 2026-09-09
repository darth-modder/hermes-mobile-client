import { describe, expect, it } from 'vitest'

import { base64FromDataUrl, extensionForMime } from './audio-format'

describe('voice/audio-format', () => {
  describe('extensionForMime', () => {
    it('maps known TTS mime types to their extension', () => {
      expect(extensionForMime('audio/mpeg')).toBe('mp3')
      expect(extensionForMime('audio/ogg')).toBe('ogg')
      expect(extensionForMime('audio/wav')).toBe('wav')
      expect(extensionForMime('audio/flac')).toBe('flac')
    })

    it('falls back to mp3 for an unrecognized mime type', () => {
      expect(extensionForMime('audio/x-mystery')).toBe('mp3')
    })
  })

  describe('base64FromDataUrl', () => {
    it('strips the data-url header', () => {
      expect(base64FromDataUrl('data:audio/mpeg;base64,SGVsbG8=')).toBe('SGVsbG8=')
    })

    it('returns the input unchanged when there is no comma', () => {
      expect(base64FromDataUrl('SGVsbG8=')).toBe('SGVsbG8=')
    })
  })
})
