/**
 * `/api/mcp/servers*` REST helpers — ported from `apps/desktop/src/api/mcp.ts`
 * onto `src/net/http.ts` (see `rest.ts`). Backs the "mcp" settings screen:
 * list / add / remove / enable toggle / test (exit criterion: "MCP server
 * add and test succeed"). The catalog browse (`getMcpCatalog`,
 * `installMcpCatalogEntry`) and per-server OAuth flow (`authMcpServer`,
 * `getMcpOAuthFlow`, `cancelMcpOAuthFlow`) are not ported — manual add
 * (name/command-or-url/env) covers the exit criterion without a second
 * browser-poll UI; noted in the milestone Deviations.
 */

import type { McpServerSummary } from '../upstream/types/hermes'

import { restRequest } from './rest'

export interface McpTestResult {
  error?: string
  ok: boolean
  /** Capability counts — absent on older backends / failed probes. */
  prompts?: number
  resources?: number
  tools: { description: string; name: string; schema_chars?: number }[]
}

export function listMcpServers(): Promise<{ servers: McpServerSummary[] }> {
  return restRequest<{ servers: McpServerSummary[] }>('/api/mcp/servers')
}

export interface AddMcpServerBody {
  args?: string[]
  auth?: string
  command?: string
  env?: Record<string, string>
  name: string
  url?: string
}

/** Add one server to `mcp_servers` (validated + name-collision-checked
 *  server-side). */
export function addMcpServer(body: AddMcpServerBody): Promise<McpServerSummary> {
  return restRequest<McpServerSummary>('/api/mcp/servers', { body, method: 'POST' })
}

export function removeMcpServer(name: string): Promise<{ ok: boolean }> {
  return restRequest<{ ok: boolean }>(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' })
}

export function setMcpServerEnabled(name: string, enabled: boolean): Promise<{ ok: boolean }> {
  return restRequest<{ ok: boolean }>(`/api/mcp/servers/${encodeURIComponent(name)}/enabled`, {
    body: { enabled },
    method: 'PUT'
  })
}

/** Connect to the server, list its tools, disconnect. Slow (spawns/handshakes
 *  for real) — well past `src/net/http.ts`'s 15s default. */
export function testMcpServer(name: string): Promise<McpTestResult> {
  return restRequest<McpTestResult>(`/api/mcp/servers/${encodeURIComponent(name)}/test`, {
    method: 'POST',
    timeoutMs: 60_000
  })
}
