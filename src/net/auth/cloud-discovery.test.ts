import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CloudDiscoveryError,
  discoverCloudAgents,
  resolvePortalBaseUrl,
  trimCloudAgents,
  trimCloudOrg
} from './cloud-discovery'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  } as Response
}

describe('resolvePortalBaseUrl', () => {
  it('defaults to the canonical Nous portal URL', () => {
    expect(resolvePortalBaseUrl()).toBe('https://portal.nousresearch.com')
  })

  it('trims a trailing slash from an override', () => {
    expect(resolvePortalBaseUrl('https://staging.portal.example.com/')).toBe('https://staging.portal.example.com')
  })
})

describe('trimCloudAgents', () => {
  it('projects agent rows and defaults missing fields', () => {
    expect(
      trimCloudAgents({
        agents: [
          { id: 'a1', name: 'Agent One', status: 'running', dashboardUrl: 'https://a1.agents.nousresearch.com' },
          { id: 'a2' }
        ]
      })
    ).toEqual([
      {
        dashboardGatewayState: 'unknown',
        dashboardUrl: 'https://a1.agents.nousresearch.com',
        id: 'a1',
        name: 'Agent One',
        status: 'running'
      },
      { dashboardGatewayState: 'unknown', dashboardUrl: null, id: 'a2', name: 'a2', status: 'unknown' }
    ])
  })

  it('drops malformed rows with no string id', () => {
    expect(trimCloudAgents({ agents: [{ name: 'no id' }, null, 'nope'] })).toEqual([])
  })

  it('returns an empty array for a malformed body', () => {
    expect(trimCloudAgents(null)).toEqual([])
    expect(trimCloudAgents({})).toEqual([])
  })
})

describe('trimCloudOrg', () => {
  it('projects a well-formed org', () => {
    expect(trimCloudOrg({ id: 'org1', slug: 'acme', name: 'Acme', isPersonal: false, role: 'ADMIN' })).toEqual({
      id: 'org1',
      isPersonal: false,
      name: 'Acme',
      role: 'ADMIN',
      slug: 'acme'
    })
  })

  it('returns null for a malformed org', () => {
    expect(trimCloudOrg(null)).toBeNull()
    expect(trimCloudOrg({ slug: 'no-id' })).toBeNull()
  })
})

describe('discoverCloudAgents', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('sends the access token as Bearer and returns { agents, org }', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { agents: [{ id: 'a1', name: 'Agent One' }], org: { id: 'org1', name: 'Acme' } })
    )

    global.fetch = fetchMock as unknown as typeof fetch

    const result = await discoverCloudAgents('https://portal.example.com', 'bearer-xyz')

    expect(result).toEqual({
      agents: [
        { dashboardGatewayState: 'unknown', dashboardUrl: null, id: 'a1', name: 'Agent One', status: 'unknown' }
      ],
      org: { id: 'org1', isPersonal: false, name: 'Acme', role: 'MEMBER', slug: null }
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer bearer-xyz')
  })

  it('scopes the request with ?org= when given', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { agents: [] }))

    global.fetch = fetchMock as unknown as typeof fetch

    await discoverCloudAgents('https://portal.example.com', 'bearer-xyz', 'my-org')

    const [url] = fetchMock.mock.calls[0] as unknown as [string]

    expect(url).toContain('org=my-org')
  })

  it('a 401 throws CloudDiscoveryError reason session-expired', async () => {
    global.fetch = vi.fn(async () => jsonResponse(401, { detail: 'unauthorized' })) as unknown as typeof fetch

    await expect(discoverCloudAgents('https://portal.example.com', 'bad-token')).rejects.toMatchObject({
      reason: 'session-expired'
    })
  })

  it('a 409 org_selection_required returns { needsOrgSelection, orgs } instead of throwing', async () => {
    global.fetch = vi.fn(async () =>
      jsonResponse(409, {
        error: 'org_selection_required',
        orgs: [
          { id: 'org1', name: 'Acme' },
          { id: 'org2', name: 'Widgets', isPersonal: true }
        ]
      })
    ) as unknown as typeof fetch

    const result = await discoverCloudAgents('https://portal.example.com', 'bearer-xyz')

    expect(result).toEqual({
      needsOrgSelection: true,
      orgs: [
        { id: 'org1', isPersonal: false, name: 'Acme', role: 'MEMBER', slug: null },
        { id: 'org2', isPersonal: true, name: 'Widgets', role: 'MEMBER', slug: null }
      ]
    })
  })

  it('a 503 (unreachable) throws CloudDiscoveryError reason unreachable, never session-expired', async () => {
    global.fetch = vi.fn(async () => jsonResponse(503, { detail: 'down' })) as unknown as typeof fetch

    await expect(discoverCloudAgents('https://portal.example.com', 'bearer-xyz')).rejects.toBeInstanceOf(
      CloudDiscoveryError
    )
    await expect(discoverCloudAgents('https://portal.example.com', 'bearer-xyz')).rejects.toMatchObject({
      reason: 'unreachable'
    })
  })
})
