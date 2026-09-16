// Not a screen — a redirect. M15 round 11 replaced this cron list with
// `app/(main)/tasks/index.tsx` (the Tasks tab, M15 C). The route is kept
// rather than deleted so an existing deep link (`hermes-android://(main)/
// cron`) still lands somewhere real instead of on a blank route; the drawer
// no longer points here. Listed in `route-replicates.test.ts`'s NOT_A_SCREEN
// for the same reason `app/index.tsx` is: it renders no UI of its own and so
// has nothing to replicate.
//
// Recorded as a Deviation in the M15 doc (the decision was redirect, not
// remove).
import { Redirect } from 'expo-router'

export default function CronRedirect() {
  return <Redirect href="/(main)/tasks" />
}
