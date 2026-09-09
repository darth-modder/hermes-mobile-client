/**
 * `projects.*` JSON-RPC helpers — ported from `apps/desktop/src/store/projects.ts`
 * onto `src/gateway/session-connection.ts`'s `gatewayRequest` (M10 task line:
 * "Projects via `projects.*` RPCs (upstream `tui_gateway/methods_projects.py`),
 * never local filesystem"). Unlike `src/api/*.ts`'s REST modules, these calls
 * ride the one live WebSocket gateway, not `fetch` — `projects.*` is a
 * gateway RPC family, not a `/api/*` route.
 *
 * `methods_projects.py` also serves `projects.tree` / `projects.project_sessions`
 * / `projects.discover_repos` / `projects.record_repos` — the sidebar's
 * repo-scan/worktree grouping the desktop uses to auto-promote git repos into
 * projects. None of that is ported: it depends on a local filesystem walk of
 * the *server's* disk that has no phone-side UI to drive it (no folder
 * picker, no worktree/git surface — AGENTS.md "Machine features don't exist
 * here" plus "never local filesystem" from the task line itself), and no M10
 * exit criterion needs it. What's here is the plain CRUD surface: list,
 * create, update, folder management, archive, delete, set-active — enough
 * for a project to be created, named, and switched to from the phone. A
 * project's folder is entered as a path (the *server's* path, since it's a
 * remote backend), not picked from a local directory browser.
 */

import { gatewayRequest } from '../gateway/session-connection'
import { getActiveProfile } from '../store/profile'
import type { ProjectInfo, ProjectsPayload } from '../upstream/types/hermes'

function withProfile(params: Record<string, unknown>, profile?: string): Record<string, unknown> {
  const scoped = profile ?? getActiveProfile()

  return scoped ? { ...params, profile: scoped } : params
}

/** `projects.list` — the full project list + the durable active-project pointer. */
export function listProjects(profile?: string): Promise<ProjectsPayload> {
  return gatewayRequest<ProjectsPayload>('projects.list', withProfile({}, profile))
}

export interface CreateProjectInput {
  name: string
  folders?: string[]
  primaryPath?: string
  slug?: string
  description?: string
  icon?: string
  color?: string
  use?: boolean
}

/** `projects.create` — at least one folder, since a project owns sessions by
 *  folder (cwd-prefix) membership; a folder-less project couldn't hold one. */
export function createProject(input: CreateProjectInput, profile?: string): Promise<{ project: ProjectInfo | null }> {
  return gatewayRequest<{ project: ProjectInfo | null }>(
    'projects.create',
    withProfile(
      {
        color: input.color,
        description: input.description,
        folders: input.folders ?? [],
        icon: input.icon,
        name: input.name,
        primary_path: input.primaryPath,
        slug: input.slug,
        use: input.use ?? false
      },
      profile
    )
  )
}

export interface UpdateProjectPatch {
  name?: string
  description?: string
  icon?: string
  color?: string
}

/** `projects.update` — patches top-level fields; returns the refreshed row. */
export function updateProject(
  id: string,
  patch: UpdateProjectPatch,
  profile?: string
): Promise<{ project: ProjectInfo }> {
  return gatewayRequest<{ project: ProjectInfo }>('projects.update', withProfile({ id, ...patch }, profile))
}

/** `projects.add_folder`. */
export function addProjectFolder(
  id: string,
  path: string,
  opts: { label?: string; isPrimary?: boolean } = {},
  profile?: string
): Promise<{ project: ProjectInfo }> {
  return gatewayRequest<{ project: ProjectInfo }>(
    'projects.add_folder',
    withProfile({ id, is_primary: opts.isPrimary ?? false, label: opts.label, path }, profile)
  )
}

/** `projects.remove_folder`. */
export function removeProjectFolder(id: string, path: string, profile?: string): Promise<{ project: ProjectInfo }> {
  return gatewayRequest<{ project: ProjectInfo }>('projects.remove_folder', withProfile({ id, path }, profile))
}

/** `projects.set_primary` — promote one of the project's existing folders. */
export function setPrimaryProjectFolder(id: string, path: string, profile?: string): Promise<{ project: ProjectInfo }> {
  return gatewayRequest<{ project: ProjectInfo }>('projects.set_primary', withProfile({ id, path }, profile))
}

/** `projects.archive` — `restore: true` un-archives instead. Returns the
 *  refreshed list + active pointer, same shape as `projects.list`. */
export function archiveProject(id: string, restore = false, profile?: string): Promise<ProjectsPayload> {
  return gatewayRequest<ProjectsPayload>('projects.archive', withProfile({ id, restore }, profile))
}

/** `projects.delete`. */
export function deleteProject(id: string, profile?: string): Promise<ProjectsPayload> {
  return gatewayRequest<ProjectsPayload>('projects.delete', withProfile({ id }, profile))
}

/** `projects.set_active` — `id: null` clears the durable active-project pointer. */
export function setActiveProject(id: null | string, profile?: string): Promise<{ active_id: null | string }> {
  return gatewayRequest<{ active_id: null | string }>('projects.set_active', withProfile({ id }, profile))
}
