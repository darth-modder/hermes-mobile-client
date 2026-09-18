import { describe, expect, it } from 'vitest'

import { isPrimaryStartCard, SHOW_TAILSCALE_PAIRING, startCardIds } from './start-cards'

// `app/connect/index.tsx`'s `:start` view renders exactly `startCardIds()`,
// one JSX block per id, so what this list says is what that screen draws.
// It is asserted here rather than against a rendered tree because the repo's
// vitest setup aliases `react-native` to a stub that throws from every API
// (src/test/react-native-stub.ts) — there is no renderer to mount the screen
// in, by design.
describe('the connect start screen, with Tailscale pairing hidden', () => {
  it('is actually hidden — if this fails, every expectation below is moot', () => {
    expect(SHOW_TAILSCALE_PAIRING).toBe(false)
  })

  it('does not render the Tailscale card', () => {
    expect(startCardIds()).not.toContain('tailscale')
    expect(isPrimaryStartCard('tailscale')).toBe(false)
  })

  it('makes "Enter a URL" the primary action', () => {
    expect(startCardIds()[0]).toBe('url')
    expect(isPrimaryStartCard('url')).toBe(true)
  })

  it('still offers the guide, so the screen is one path plus the guide', () => {
    expect(startCardIds()).toEqual(['url', 'guide'])
    expect(isPrimaryStartCard('guide')).toBe(false)
  })
})
