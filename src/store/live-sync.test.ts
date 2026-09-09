import { describe, expect, it } from 'vitest'

import {
  $cronChangeTick,
  $pairingChangeTick,
  $platformsChangeTick,
  notifyCronChanged,
  notifyPairingChanged,
  notifyPlatformsChanged
} from './live-sync'

describe('src/store/live-sync', () => {
  it('each notify* bumps only its own tick', () => {
    const before = {
      cron: $cronChangeTick.get(),
      pairing: $pairingChangeTick.get(),
      platforms: $platformsChangeTick.get()
    }

    notifyCronChanged()

    expect($cronChangeTick.get()).toBe(before.cron + 1)
    expect($platformsChangeTick.get()).toBe(before.platforms)
    expect($pairingChangeTick.get()).toBe(before.pairing)

    notifyPlatformsChanged()

    expect($platformsChangeTick.get()).toBe(before.platforms + 1)
    expect($pairingChangeTick.get()).toBe(before.pairing)

    notifyPairingChanged()

    expect($pairingChangeTick.get()).toBe(before.pairing + 1)
  })
})
