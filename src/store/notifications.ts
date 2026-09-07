// Toast/notice queue fed by the reducer's `notify` effect (any family
// handler — see message-stream.ts's billing wall, status.ts's gateway error).

import { atom } from 'nanostores'

import type { Effect } from '../gateway/session-stream-reducer'

export type NotifyEffect = Extract<Effect, { type: 'notify' }>

export const $notifications = atom<NotifyEffect[]>([])

/** Push a notice, replacing any existing one with the same `id` (matches the
 *  desktop's notify(): a stable id collapses a repeat notice in place instead
 *  of stacking a duplicate toast). */
export function notify(effect: NotifyEffect): void {
  const current = $notifications.get()
  const index = current.findIndex(existing => existing.id === effect.id)

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
