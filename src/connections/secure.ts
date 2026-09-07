// Secrets only — session tokens, OAuth tokens, proxy header values (AGENTS.md
// "Credentials and reauth"). Connection metadata (label, baseUrl, authMode,
// ...) lives in MMKV instead — see registry.ts. Never logged.

import * as SecureStore from 'expo-secure-store'

function tokenKey(connectionId: string): string {
  return `conn.${connectionId}.token`
}

function oauthKey(connectionId: string): string {
  return `conn.${connectionId}.oauth`
}

function headerKey(connectionId: string, headerName: string): string {
  return `conn.${connectionId}.header.${headerName}`
}

export async function setConnectionToken(connectionId: string, token: string): Promise<void> {
  await SecureStore.setItemAsync(tokenKey(connectionId), token)
}

export async function getConnectionToken(connectionId: string): Promise<null | string> {
  return SecureStore.getItemAsync(tokenKey(connectionId))
}

export async function deleteConnectionToken(connectionId: string): Promise<void> {
  await SecureStore.deleteItemAsync(tokenKey(connectionId))
}

export interface StoredOAuthSession {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
}

export async function setConnectionOAuth(connectionId: string, session: StoredOAuthSession): Promise<void> {
  await SecureStore.setItemAsync(oauthKey(connectionId), JSON.stringify(session))
}

export async function getConnectionOAuth(connectionId: string): Promise<null | StoredOAuthSession> {
  const raw = await SecureStore.getItemAsync(oauthKey(connectionId))

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as StoredOAuthSession
  } catch {
    return null
  }
}

export async function deleteConnectionOAuth(connectionId: string): Promise<void> {
  await SecureStore.deleteItemAsync(oauthKey(connectionId))
}

export async function setConnectionHeader(connectionId: string, headerName: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(headerKey(connectionId, headerName), value)
}

export async function getConnectionHeader(connectionId: string, headerName: string): Promise<null | string> {
  return SecureStore.getItemAsync(headerKey(connectionId, headerName))
}

export async function deleteConnectionHeader(connectionId: string, headerName: string): Promise<void> {
  await SecureStore.deleteItemAsync(headerKey(connectionId, headerName))
}

/** Resolve every extra proxy header this connection sends, by name. Best-effort:
 *  a header whose value went missing from secure storage is simply omitted
 *  rather than failing the whole request. */
export async function getConnectionHeaders(
  connectionId: string,
  headerNames: string[]
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    headerNames.map(async name => [name, await getConnectionHeader(connectionId, name)] as const)
  )

  return Object.fromEntries(entries.filter((entry): entry is [string, string] => entry[1] !== null))
}

/** Remove every secret this connection owns — call when a connection is deleted. */
export async function deleteAllConnectionSecrets(connectionId: string, headerNames: string[] = []): Promise<void> {
  await deleteConnectionToken(connectionId)
  await deleteConnectionOAuth(connectionId)
  await Promise.all(headerNames.map(name => deleteConnectionHeader(connectionId, name)))
}
