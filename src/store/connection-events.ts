// D27: sign-out's connection-layer clear (session-connection.ts) reaches
// every store it can import directly (prompts.ts, clarify.ts, sessions.ts).
// react-query's QueryClient — the Tasks tab's cache (app/(main)/tasks) — is
// the one piece of "cached list data" it can't reach that way: the
// QueryClient is created in app/_layout.tsx's own component state, and
// session-connection.ts is a plain module with no React tree to call into.
// This is the same "nanostore tick a React subscriber reacts to" shape as
// store/sessions.ts's $sessionListRefreshRequests, for the one cache that
// genuinely needs a React-side listener instead of a direct store import.

import { atom } from 'nanostores'

export const $signedOutTick = atom(0)

export function notifySignedOut(): void {
  $signedOutTick.set($signedOutTick.get() + 1)
}
