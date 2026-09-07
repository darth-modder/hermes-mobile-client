// The message-composer's own draft state, per session — independent of the
// gateway-event reducer (nothing on the wire drives it; the user's typing
// does). Declared here per M05's atom list so M06's chat screen has
// somewhere to put it; the composer UI itself is M06's job.

import { atom } from 'nanostores'

export interface ComposerAttachment {
  ref: string
  label: string
}

export interface ComposerDraft {
  text: string
  attachments: ComposerAttachment[]
}

const EMPTY_DRAFT: ComposerDraft = { text: '', attachments: [] }

export const $composerDrafts = atom<Record<string, ComposerDraft>>({})

export function composerDraft(storedSessionId: string): ComposerDraft {
  return $composerDrafts.get()[storedSessionId] ?? EMPTY_DRAFT
}

export function setComposerDraft(storedSessionId: string, draft: ComposerDraft): void {
  $composerDrafts.set({ ...$composerDrafts.get(), [storedSessionId]: draft })
}

export function clearComposerDraft(storedSessionId: string): void {
  const current = $composerDrafts.get()

  if (!(storedSessionId in current)) {
    return
  }

  const next = { ...current }

  delete next[storedSessionId]
  $composerDrafts.set(next)
}
