// projects.ts calls straight through session-connection.ts's `gatewayRequest`
// (a live WS RPC, not `fetch`) — same fake-gateway injection pattern
// session-connection.test.ts already established for submitPrompt etc.

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
const { setActiveProfile } = await import('../store/profile')

const {
  addProjectFolder,
  archiveProject,
  createProject,
  deleteProject,
  listProjects,
  removeProjectFolder,
  setActiveProject,
  setPrimaryProjectFolder,
  updateProject
} = await import('./projects')

class FakeGateway {
  connectionState = 'open'
  request = vi.fn()
  close = vi.fn()
}

describe('src/api/projects', () => {
  let fake: FakeGateway

  beforeEach(() => {
    resetSessionConnectionForTests()
    fake = new FakeGateway()
    setGatewayForTests(fake as never)
    setActiveProfile('')
  })

  it('projects.list carries no profile param when none is active', async () => {
    fake.request.mockResolvedValue({ active_id: null, projects: [] })

    await listProjects()

    expect(fake.request).toHaveBeenCalledWith('projects.list', {}, undefined)
  })

  it('scopes every call to the active profile atom when one is set', async () => {
    setActiveProfile('work')
    fake.request.mockResolvedValue({ active_id: null, projects: [] })

    await listProjects()

    expect(fake.request).toHaveBeenCalledWith('projects.list', { profile: 'work' }, undefined)
  })

  it('an explicit profile argument overrides the active profile atom', async () => {
    setActiveProfile('work')
    fake.request.mockResolvedValue({ active_id: null, projects: [] })

    await listProjects('other')

    expect(fake.request).toHaveBeenCalledWith('projects.list', { profile: 'other' }, undefined)
  })

  it('projects.create sends at least one folder and the primary path', async () => {
    fake.request.mockResolvedValue({ project: null })

    await createProject({ folders: ['/srv/repo'], name: 'Demo', primaryPath: '/srv/repo', use: true })

    expect(fake.request).toHaveBeenCalledWith(
      'projects.create',
      expect.objectContaining({ folders: ['/srv/repo'], name: 'Demo', primary_path: '/srv/repo', use: true }),
      undefined
    )
  })

  it('projects.update patches the given fields under the project id', async () => {
    fake.request.mockResolvedValue({ project: {} })

    // Not a UI colour (M13's no-hardcoded-hex-color rule targets those): a
    // user-picked rail colour on the project record itself, sent verbatim.
    // eslint-disable-next-line local/no-hardcoded-hex-color
    await updateProject('p_1', { color: '#fff', name: 'Renamed' })

    expect(fake.request).toHaveBeenCalledWith(
      'projects.update',
      // eslint-disable-next-line local/no-hardcoded-hex-color
      { color: '#fff', id: 'p_1', name: 'Renamed' },
      undefined
    )
  })

  it('projects.add_folder / remove_folder / set_primary address the project id and path', async () => {
    fake.request.mockResolvedValue({ project: {} })

    await addProjectFolder('p_1', '/srv/extra', { isPrimary: true, label: 'Extra' })
    await removeProjectFolder('p_1', '/srv/extra')
    await setPrimaryProjectFolder('p_1', '/srv/extra')

    expect(fake.request).toHaveBeenNthCalledWith(
      1,
      'projects.add_folder',
      { id: 'p_1', is_primary: true, label: 'Extra', path: '/srv/extra' },
      undefined
    )
    expect(fake.request).toHaveBeenNthCalledWith(
      2,
      'projects.remove_folder',
      { id: 'p_1', path: '/srv/extra' },
      undefined
    )
    expect(fake.request).toHaveBeenNthCalledWith(
      3,
      'projects.set_primary',
      { id: 'p_1', path: '/srv/extra' },
      undefined
    )
  })

  it('projects.archive passes restore through unchanged (default false)', async () => {
    fake.request.mockResolvedValue({ active_id: null, projects: [] })

    await archiveProject('p_1')
    await archiveProject('p_1', true)

    expect(fake.request).toHaveBeenNthCalledWith(1, 'projects.archive', { id: 'p_1', restore: false }, undefined)
    expect(fake.request).toHaveBeenNthCalledWith(2, 'projects.archive', { id: 'p_1', restore: true }, undefined)
  })

  it('projects.delete and projects.set_active address by id', async () => {
    fake.request.mockResolvedValue({ active_id: null })

    await deleteProject('p_1')
    await setActiveProject('p_1')
    await setActiveProject(null)

    expect(fake.request).toHaveBeenNthCalledWith(2, 'projects.set_active', { id: 'p_1' }, undefined)
    expect(fake.request).toHaveBeenNthCalledWith(3, 'projects.set_active', { id: null }, undefined)
  })
})
