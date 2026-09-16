/**
 * One place that answers "is this a development build?".
 *
 * `__DEV__` is a React Native global that the Metro/Hermes bundler defines;
 * it is absent under plain Node, which is where vitest runs, so every read
 * needs the `typeof` check or the reference itself throws. That guard was
 * written twice already — `src/connections/registry.ts:194` and
 * `src/voice/dev-transcript-seam.ts` — and M15 round 10 needed a third for
 * the `app/dev/` route gate, which is the point at which a shared helper
 * beats a third copy: a dev-only escape hatch that fails open in a shipped
 * build is exactly the bug this guard exists to prevent, so there should be
 * one implementation to get right.
 */

export function isDevBuild(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__
}

/**
 * Whether `app/dev/*` routes may render. Separate from `isDevBuild` by name
 * so the route gate reads as a policy decision at its call site
 * (`app/dev/_layout.tsx`) rather than an incidental environment check, and
 * so a future "dev routes on in an internal build" rule has somewhere to
 * live that is not every screen.
 */
export function devRoutesEnabled(): boolean {
  return isDevBuild()
}
