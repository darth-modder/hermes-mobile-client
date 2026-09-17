// models.ts's setSessionModel/setSessionReasoningEffort call straight through
// session-connection.ts's `gatewayRequest` (a live WS RPC, not `fetch`) — same
// fake-gateway injection pattern projects.test.ts and session-connection.test.ts
// already established. Fixtures for the `config.set` response envelope are
// recorded from a throwaway gateway (see this milestone's verification log),
// not invented — shape confirmed directly against
// `tui_gateway/methods_config_set.py`'s `_kv`/`_cfgset_model_ok`.

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

const { bindSession } = await import('../gateway/session-stream/session-keys')
const { createReducerState } = await import('../gateway/session-stream/types')

const { resetSessionConnectionForTests, setGatewayForTests, setReducerStateForTests } =
  await import('../gateway/session-connection')

const { setSessionModel, setSessionReasoningEffort } = await import('./models')

class FakeGateway {
  connectionState = 'open'
  request = vi.fn()
  close = vi.fn()
}

// Recorded from a throwaway gateway: GET-side config.set('model', ...) reply
// for an immediate (not mid-turn) switch.
const MODEL_SWITCH_FIXTURE = {
  confirm_message: '',
  confirm_required: false,
  key: 'model',
  scope: 'session',
  value: 'deepseek-v4-flash',
  warning: ''
}

// Recorded mid-turn: the gateway stashes the pick for the next turn start
// (methods_config_set.py's _stash_pending_model_switch) instead of applying
// it live.
const MODEL_SWITCH_DEFERRED_FIXTURE = {
  confirm_message: '',
  confirm_required: false,
  deferred: true,
  key: 'model',
  scope: 'session',
  value: 'deepseek-v4-flash',
  warning: ''
}

const REASONING_SWITCH_FIXTURE = {
  key: 'reasoning',
  value: 'high'
}

describe('src/api/models: session-scoped config.set', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)

    let state = createReducerState()

    state = bindSession(state, 'runtime-a', 'stored-a', { makeActive: false })
    state = bindSession(state, 'runtime-b', 'stored-b', { makeActive: false })
    setReducerStateForTests(state)
  })

  it('setSessionModel resolves the stored id to its runtime id and always appends --session', async () => {
    fake.request.mockResolvedValue(MODEL_SWITCH_FIXTURE)

    const result = await setSessionModel('stored-a', 'deepseek-v4-flash', 'opencode-go')

    expect(fake.request).toHaveBeenCalledWith(
      'config.set',
      {
        key: 'model',
        session_id: 'runtime-a',
        value: 'deepseek-v4-flash --provider opencode-go --session'
      },
      undefined
    )
    expect(result).toEqual(MODEL_SWITCH_FIXTURE)
  })

  it('addresses a different stored session with its own runtime id', async () => {
    fake.request.mockResolvedValue(MODEL_SWITCH_FIXTURE)

    await setSessionModel('stored-b', 'mimo-v2.5', 'opencode-go')

    expect(fake.request).toHaveBeenCalledWith(
      'config.set',
      {
        key: 'model',
        session_id: 'runtime-b',
        value: 'mimo-v2.5 --provider opencode-go --session'
      },
      undefined
    )
  })

  it('falls through to the stored id unchanged when nothing has bound a runtime id yet', async () => {
    fake.request.mockResolvedValue(MODEL_SWITCH_FIXTURE)

    await setSessionModel('stored-unbound', 'mimo-v2.5', 'opencode-go')

    expect(fake.request).toHaveBeenCalledWith(
      'config.set',
      expect.objectContaining({ session_id: 'stored-unbound' }),
      undefined
    )
  })

  it('passes confirm_expensive_model only when the caller re-submits after a guard', async () => {
    fake.request.mockResolvedValue(MODEL_SWITCH_FIXTURE)

    await setSessionModel('stored-a', 'expensive-model', 'opencode-go')
    await setSessionModel('stored-a', 'expensive-model', 'opencode-go', true)

    expect(fake.request).toHaveBeenNthCalledWith(
      1,
      'config.set',
      expect.not.objectContaining({ confirm_expensive_model: expect.anything() }),
      undefined
    )
    expect(fake.request).toHaveBeenNthCalledWith(
      2,
      'config.set',
      expect.objectContaining({ confirm_expensive_model: true }),
      undefined
    )
  })

  it('surfaces a mid-turn deferred switch in the return value instead of throwing', async () => {
    fake.request.mockResolvedValue(MODEL_SWITCH_DEFERRED_FIXTURE)

    const result = await setSessionModel('stored-a', 'deepseek-v4-flash', 'opencode-go')

    expect(result.deferred).toBe(true)
  })

  it('setSessionReasoningEffort sends key "reasoning", not "reasoning_effort", with no scope param', async () => {
    fake.request.mockResolvedValue(REASONING_SWITCH_FIXTURE)

    const result = await setSessionReasoningEffort('stored-b', 'high')

    expect(fake.request).toHaveBeenCalledWith(
      'config.set',
      { key: 'reasoning', session_id: 'runtime-b', value: 'high' },
      undefined
    )
    expect(result).toEqual(REASONING_SWITCH_FIXTURE)
  })
})
