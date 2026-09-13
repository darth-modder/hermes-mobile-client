// Toast/notice queue fed by the reducer's `notify` effect (any family
// handler — see message-stream.ts's billing wall, status.ts's gateway error).

import { atom } from 'nanostores'

import type { Effect } from '../gateway/session-stream-reducer'
import { hapticError } from '../lib/haptics'

export type NotifyEffect = Extract<Effect, { type: 'notify' }>

export const $notifications = atom<NotifyEffect[]>([])

/** Push a notice, replacing any existing one with the same `id` (matches the
 *  desktop's notify(): a stable id collapses a repeat notice in place instead
 *  of stacking a duplicate toast). Every error notice gets a haptic here —
 *  the one choke point every `notify({ kind: 'error', ... })` call site
 *  already goes through, rather than wiring each site individually. */
export function notify(effect: NotifyEffect): void {
  const current = $notifications.get()
  const index = current.findIndex(existing => existing.id === effect.id)

  if (effect.kind === 'error') {
    hapticError()
  }

  if (index === -1) {
    $notifications.set([...current, effect])

    return
  }

  const next = [...current]
  next[index] = effect
  $notifications.set(next)
}

export function dismissNotification(id: string): void {
  $notifications.set($notifications.get().filter(existing => existing.id !== id))
}
