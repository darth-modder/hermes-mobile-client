// The message-composer's own draft state, per session — independent of the
// gateway-event reducer (nothing on the wire drives it; the user's typing
// does). Persisted to MMKV (M06's per-session draft persistence task) so a
// half-typed message survives the app being backgrounded/killed, exactly
// like the desktop's own per-session composer draft.

import { atom } from 'nanostores'

import { readJson, writeJson } from '../lib/storage'

export interface ComposerAttachment {
  ref: string
  label: string
}

export interface ComposerDraft {
  text: string
  attachments: ComposerAttachment[]
}

const EMPTY_DRAFT: ComposerDraft = { text: '', attachments: [] }
const STORAGE_KEY = 'composer.drafts'

function loadPersistedDrafts(): Record<string, ComposerDraft> {
  return readJson<Record<string, ComposerDraft>>(STORAGE_KEY) ?? {}
}

function persistDrafts(drafts: Record<string, ComposerDraft>): void {
  writeJson(STORAGE_KEY, Object.keys(drafts).length > 0 ? drafts : null)
}

export const $composerDrafts = atom<Record<string, ComposerDraft>>(loadPersistedDrafts())

export function composerDraft(storedSessionId: string): ComposerDraft {
  return $composerDrafts.get()[storedSessionId] ?? EMPTY_DRAFT
}

export function setComposerDraft(storedSessionId: string, draft: ComposerDraft): void {
  const next = { ...$composerDrafts.get(), [storedSessionId]: draft }

  $composerDrafts.set(next)
  persistDrafts(next)
}

export function clearComposerDraft(storedSessionId: string): void {
  const current = $composerDrafts.get()

  if (!(storedSessionId in current)) {
    return
  }

  const next = { ...current }

  delete next[storedSessionId]
  $composerDrafts.set(next)
  persistDrafts(next)
}
