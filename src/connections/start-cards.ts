/**
 * Which cards `app/connect/index.tsx`'s `:start` view draws, and in what
 * order.
 *
 * Extracted from the screen so the one decision below is a value a test can
 * read. The repo's vitest setup deliberately cannot render React Native —
 * `src/test/react-native-stub.ts` throws from every API on purpose ("pure
 * logic under test must never need real react-native APIs") — so the screen
 * maps over this list rather than hard-coding three blocks, and a test of the
 * list is a test of what the screen renders.
 */

/**
 * Whether the connect screen offers "Pair over Tailscale" as an entry point.
 *
 * **Off for the first release only.** The flow itself is finished and was
 * verified on device at M15's close-out — the exit criterion is met, and none
 * of it is deleted: `:steps` still renders, `src/net/gateway-url-guard.ts`'s
 * `'tailscale'` mode and its tests are untouched, and flipping this back to
 * `true` restores the card with no other change. What is not finished is the
 * part around it — the guide the steps hand off to, and the story for a user
 * who has no tailnet yet — and a first screen that offers two paths where one
 * of them dead-ends is worse than a first screen that offers one.
 *
 * With it off, "Enter a URL" becomes the primary action, so the start screen
 * is one obvious path plus the host-side guide. Recorded as Deviation 21 in
 * project-planning/implementation-plan/M15-bots-and-mobile-ux.md.
 */
export const SHOW_TAILSCALE_PAIRING = false

export type StartCardId = 'guide' | 'tailscale' | 'url'

/**
 * The cards, in draw order. The first is the primary action and is styled as
 * such; `'guide'` is a link out to `docs/CONNECTING.md` and is never primary.
 */
export function startCardIds(): StartCardId[] {
  return SHOW_TAILSCALE_PAIRING ? ['tailscale', 'url', 'guide'] : ['url', 'guide']
}

/** True for the one card drawn as the filled, primary button. */
export function isPrimaryStartCard(id: StartCardId): boolean {
  return startCardIds()[0] === id
}
