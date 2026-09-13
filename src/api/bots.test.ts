// bots.ts calls straight through session-connection.ts's `gatewayRequest` (a
// live WS RPC, not `fetch`) — same fake-gateway injection pattern
// projects.test.ts and models.test.ts already established. Fixtures below
// are recorded from this milestone's throwaway gateway (scratch HERMES_HOME,
// two seeded profiles researcher/coder, port 9130) — see this milestone's
// verification log for the paste.

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: () => undefined,
    remove: () => undefined,
    set: () => undefined
  })
}))

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn()
}))

const { resetSessionConnectionForTests, setGatewayForTests } = await import('../gateway/session-connection')

const {
  clearBotAvatarAsset,
  configureBot,
  describeBot,
  getBotAvatarAsset,
  listBots,
  resolveCanonicalChat,
  setBotAvatarAsset
} = await import('./bots')

class FakeGateway {
  connectionState = 'open'
  request = vi.fn()
  close = vi.fn()
}

// Recorded live: profiles.list against two seeded profiles (researcher,
// coder) plus the default profile, neither bot yet has a canonical chat.
const ROSTER_FIXTURE = {
  bot_mode_protocol: true,
  profiles: [
    {
      canonical_session: null,
      description: '',
      display_name: '',
      has_avatar: false,
      is_default: true,
      last_session: null,
      model: 'mimo-v2.5',
      name: 'default',
      path: 'C:\\Users\\COMPUT~1\\AppData\\Local\\Temp\\hermes-m15-home',
      provider: 'opencode-go',
      skill_count: 60,
      ui_meta_revisions: {},
      worker_session: null
    },
    {
      canonical_session: null,
      description: 'Code review bot',
      display_name: '',
      has_avatar: false,
      is_default: false,
      last_session: {
        id: '20260913_214154_d7c710',
        last_active: 1789317719.2739556,
        message_count: 2,
        preview: 'ok',
        started_at: 1789317714.7629838,
        title: 'Friendly greeting'
      },
      model: 'mimo-v2.5',
      name: 'coder',
      path: 'C:\\Users\\COMPUT~1\\AppData\\Local\\Temp\\hermes-m15-home\\profiles\\coder',
      provider: 'opencode-go',
      skill_count: 1,
      ui_meta_revisions: {},
      worker_session: null
    }
  ]
}

// Recorded live: profiles.describe(researcher), trimmed to the shape-relevant
// fields (the full soul text and toolset list are long and not what this
// test is checking).
const DESCRIBE_FIXTURE = {
  description: 'Deep research bot',
  mcp_servers: [],
  model: { default: 'mimo-v2.5', provider: 'opencode-go' },
  name: 'researcher',
  skills: [{ enabled: true, name: 'hermes-agent' }],
  soul: 'You are Hermes Agent, built by Nous Research.',
  toolsets: [
    {
      description: 'web_search, web_extract',
      enabled: true,
      label: '🔍 Web Search & Scraping',
      name: 'web',
      tool_count: 2
    }
  ],
  toolsets_pinned: false
}

const CONFIGURE_FIXTURE = { applied: { description: true, soul: true }, ok: true }

const GET_ASSET_NOT_FOUND_FIXTURE = { found: false }

// A tiny 1x1 red PNG, base64 — recorded live via profiles.set_asset then
// profiles.get_asset, byte-for-byte round trip confirmed.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

const GET_ASSET_FOUND_FIXTURE = { data: TINY_PNG, found: true, mime: 'image/png', size: 68 }
const SET_ASSET_FIXTURE = { asset: 'avatar', ok: true, size: 68 }
const CLEAR_ASSET_FIXTURE = { asset: 'avatar', ok: true, removed: 1, size: 0 }

describe('src/api/bots', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
  })

  it('listBots calls profiles.list with no params', async () => {
    fake.request.mockResolvedValue(ROSTER_FIXTURE)

    const result = await listBots()

    expect(fake.request).toHaveBeenCalledWith('profiles.list', {}, undefined)
    expect(result).toEqual(ROSTER_FIXTURE)
    expect(result.bot_mode_protocol).toBe(true)
  })

  it('describeBot addresses profiles.describe by name', async () => {
    fake.request.mockResolvedValue(DESCRIBE_FIXTURE)

    const result = await describeBot('researcher')

    expect(fake.request).toHaveBeenCalledWith('profiles.describe', { name: 'researcher' }, undefined)
    expect(result).toEqual(DESCRIBE_FIXTURE)
  })

  it('configureBot sends only the fields the caller set', async () => {
    fake.request.mockResolvedValue(CONFIGURE_FIXTURE)

    await configureBot('researcher', { description: 'Deep research bot v2', soul: 'Be meticulous.' })

    expect(fake.request).toHaveBeenCalledWith(
      'profiles.configure',
      { description: 'Deep research bot v2', name: 'researcher', soul: 'Be meticulous.' },
      undefined
    )
  })

  it('configureBot with a model patch sends both model and provider, never a bare pin', async () => {
    fake.request.mockResolvedValue({ applied: { model: true }, ok: true })

    await configureBot('researcher', { model: { model: 'deepseek-v4-flash', provider: 'opencode-go' } })

    expect(fake.request).toHaveBeenCalledWith(
      'profiles.configure',
      { model: 'deepseek-v4-flash', name: 'researcher', provider: 'opencode-go' },
      undefined
    )
  })

  it('configureBot omits model entirely for `model: null` — it cannot clear an existing pin (see bots.ts header)', async () => {
    fake.request.mockResolvedValue({ applied: {}, ok: true })

    await configureBot('researcher', { model: null })

    expect(fake.request).toHaveBeenCalledWith('profiles.configure', { name: 'researcher' }, undefined)
  })

  it('configureBot resends confirm_expensive_model only when the caller asks', async () => {
    fake.request.mockResolvedValue(CONFIGURE_FIXTURE)

    await configureBot('researcher', {
      confirmExpensiveModel: true,
      model: { model: 'expensive-model', provider: 'opencode-go' }
    })

    expect(fake.request).toHaveBeenCalledWith(
      'profiles.configure',
      {
        confirm_expensive_model: true,
        model: 'expensive-model',
        name: 'researcher',
        provider: 'opencode-go'
      },
      undefined
    )
  })

  it('getBotAvatarAsset reports found:false when none was ever set', async () => {
    fake.request.mockResolvedValue(GET_ASSET_NOT_FOUND_FIXTURE)

    const result = await getBotAvatarAsset('researcher')

    expect(fake.request).toHaveBeenCalledWith('profiles.get_asset', { asset: 'avatar', name: 'researcher' }, undefined)
    expect(result).toEqual({ found: false })
  })

  it('setBotAvatarAsset uploads the data URL and getBotAvatarAsset reads the same bytes back', async () => {
    fake.request.mockResolvedValueOnce(SET_ASSET_FIXTURE)
    const setResult = await setBotAvatarAsset('researcher', TINY_PNG)

    expect(fake.request).toHaveBeenNthCalledWith(
      1,
      'profiles.set_asset',
      { asset: 'avatar', data: TINY_PNG, name: 'researcher' },
      undefined
    )
    expect(setResult).toEqual(SET_ASSET_FIXTURE)

    fake.request.mockResolvedValueOnce(GET_ASSET_FOUND_FIXTURE)
    const getResult = await getBotAvatarAsset('researcher')

    expect(getResult).toEqual(GET_ASSET_FOUND_FIXTURE)
    expect(getResult.found && getResult.data).toBe(TINY_PNG)
  })

  it('clearBotAvatarAsset passes clear:true, not data', async () => {
    fake.request.mockResolvedValue(CLEAR_ASSET_FIXTURE)

    const result = await clearBotAvatarAsset('researcher')

    expect(fake.request).toHaveBeenCalledWith(
      'profiles.set_asset',
      { asset: 'avatar', clear: true, name: 'researcher' },
      undefined
    )
    expect(result).toEqual(CLEAR_ASSET_FIXTURE)
  })

  describe('resolveCanonicalChat', () => {
    it('adopts an existing "Bot Chat" row instead of creating', async () => {
      fake.request.mockResolvedValueOnce({
        sessions: [{ id: 'sess-existing', resolved_id: 'sess-existing-tip', title: 'Bot Chat' }]
      })

      const result = await resolveCanonicalChat('researcher')

      expect(fake.request).toHaveBeenCalledTimes(1)
      expect(fake.request).toHaveBeenCalledWith(
        'session.list',
        { include_hidden: true, limit: 200, profile: 'researcher', title: 'Bot Chat' },
        undefined
      )
      // resolved_id (the live compression-lineage tip) wins over the durable id.
      expect(result).toBe('sess-existing-tip')
    })

    it('a compacted chat matches by root_title even though its current title differs', async () => {
      fake.request.mockResolvedValueOnce({
        sessions: [
          { id: 'sess-root', resolved_id: 'sess-tip-after-compression', root_title: 'Bot Chat', title: 'continued' }
        ]
      })

      const result = await resolveCanonicalChat('researcher')

      expect(result).toBe('sess-tip-after-compression')
    })

    it('creates and eagerly titles when no canonical chat exists yet', async () => {
      fake.request
        .mockResolvedValueOnce({ sessions: [] }) // session.list: none found
        .mockResolvedValueOnce({ session_id: 'runtime-1', stored_session_id: 'stored-1' }) // session.create
        .mockResolvedValueOnce({}) // session.title

      const result = await resolveCanonicalChat('researcher')

      expect(fake.request).toHaveBeenNthCalledWith(
        2,
        'session.create',
        { follow_profile_config: true, hidden: true, profile: 'researcher', title: 'Bot Chat' },
        undefined
      )
      expect(fake.request).toHaveBeenNthCalledWith(
        3,
        'session.title',
        { session_id: 'runtime-1', title: 'Bot Chat' },
        undefined
      )
      expect(result).toBe('stored-1')
    })

    it('fails closed on an RPC error — never treats a failed lookup as "no chat exists"', async () => {
      fake.request.mockRejectedValueOnce(new Error('backend unreachable'))

      await expect(resolveCanonicalChat('researcher')).rejects.toThrow(/Could not check researcher's Bot Chat registry/)
      // No fallback session.create call after the failed lookup.
      expect(fake.request).toHaveBeenCalledTimes(1)
    })

    it('fails closed on an empty result when the roster already confirmed a canonical session exists', async () => {
      fake.request.mockResolvedValueOnce({ sessions: [] })

      await expect(resolveCanonicalChat('researcher', 'previously-seen-id')).rejects.toThrow(
        /Could not confirm researcher's Bot Chat registry/
      )
      expect(fake.request).toHaveBeenCalledTimes(1)
    })

    it('an empty result with no prior sighting is treated as "no chat yet" and creates one', async () => {
      fake.request
        .mockResolvedValueOnce({ sessions: [] })
        .mockResolvedValueOnce({ session_id: 'runtime-2', stored_session_id: 'stored-2' })
        .mockResolvedValueOnce({})

      const result = await resolveCanonicalChat('researcher', null)

      expect(result).toBe('stored-2')
    })
  })
})
