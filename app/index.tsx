import { Redirect } from 'expo-router'

import { getActiveConnection } from '../src/connections/registry'

/**
 * Routes onward: the session list if a connection is already configured
 * (M07 — replaces M06's Deviation #6 stopgap, which always minted a new
 * session here since no list screen existed yet), otherwise the connect flow.
 */
export default function HomeScreen() {
  const connection = getActiveConnection()

  return <Redirect href={connection ? '/session-list' : '/connect'} />
}
