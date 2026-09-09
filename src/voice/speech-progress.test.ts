import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatMessage } from '../upstream/lib/chat-messages'

import { $lastSpokenId, speakUnspokenReply, unspokenReply } from './speech-progress'

function textMessage(
  id: string,
  role: ChatMessage['role'],
  text: string,
  extra: Partial<ChatMessage> = {}
): ChatMessage {
  return { id, parts: [{ type: 'text', text }], role, ...extra }
}

describe('voice/speech-progress', () => {
  beforeEach(() => {
    $lastSpokenId.set({})
  })

  describe('unspokenReply', () => {
    it('returns null with no assistant messages', () => {
      const messages = [textMessage('u1', 'user', 'hi')]

      expect(unspokenReply('sess-1', messages)).toBeNull()
    })

    it('returns the latest assistant reply when nothing has been spoken yet', () => {
      const messages = [textMessage('u1', 'user', 'hi'), textMessage('a1', 'assistant', 'hello there')]

      expect(unspokenReply('sess-1', messages)).toEqual({ id: 'a1', text: 'hello there' })
    })

    it('returns null while the reply is still streaming', () => {
      const messages = [textMessage('u1', 'user', 'hi'), textMessage('a1', 'assistant', 'hello', { pending: true })]

      expect(unspokenReply('sess-1', messages)).toBeNull()
    })

    it('returns null once that reply has already been marked spoken', () => {
      const messages = [textMessage('u1', 'user', 'hi'), textMessage('a1', 'assistant', 'hello there')]

      $lastSpokenId.set({ 'sess-1': 'a1' })
      expect(unspokenReply('sess-1', messages)).toBeNull()
    })

    it('tracks per-session state independently', () => {
      const messages = [textMessage('u1', 'user', 'hi'), textMessage('a1', 'assistant', 'hello there')]

      $lastSpokenId.set({ 'sess-2': 'a1' })
      expect(unspokenReply('sess-1', messages)).toEqual({ id: 'a1', text: 'hello there' })
    })
  })

  describe('speakUnspokenReply', () => {
    it('calls speak with the reply text and marks it spoken', async () => {
      const messages = [textMessage('u1', 'user', 'hi'), textMessage('a1', 'assistant', 'hello there')]
      const speak = vi.fn().mockResolvedValue(undefined)

      const spoke = await speakUnspokenReply('sess-1', messages, speak)

      expect(spoke).toBe(true)
      expect(speak).toHaveBeenCalledWith('hello there')
      expect($lastSpokenId.get()).toEqual({ 'sess-1': 'a1' })
    })

    it('returns false and never calls speak when there is nothing unspoken', async () => {
      const speak = vi.fn().mockResolvedValue(undefined)

      const spoke = await speakUnspokenReply('sess-1', [], speak)

      expect(spoke).toBe(false)
      expect(speak).not.toHaveBeenCalled()
    })

    it('does not mark the reply spoken when speak rejects', async () => {
      const messages = [textMessage('u1', 'user', 'hi'), textMessage('a1', 'assistant', 'hello there')]
      const speak = vi.fn().mockRejectedValue(new Error('network down'))

      await expect(speakUnspokenReply('sess-1', messages, speak)).rejects.toThrow('network down')
      expect($lastSpokenId.get()).toEqual({})
    })
  })
})
