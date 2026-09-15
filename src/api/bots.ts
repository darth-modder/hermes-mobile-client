/**
 * Bots tab data layer (M15 A, per D17.4): a bot is a profile. Roster from
 * `profiles.list` (RPC 5061); soul, description, model pin, toolsets and
 * skills per profile from `profiles.describe`/`profiles.configure` (RPC
 * 5063/5064, gateway JSON-RPC, not REST — `tui_gateway/methods_profiles.py`);
 * avatar asset from `profiles.set_asset`/`profiles.get_asset` (RPC
 * 5065/5066). All five RPC shapes below were read directly off their
 * handlers, not inferred from `src/api/profiles.ts`'s REST wrapper — that
 * module wraps a DIFFERENT endpoint (`/api/profiles`, `_profile_to_dict` in
 * `hermes_cli/web_routers/profiles.py:73-88`: `has_env`, `gateway_running`,
 * `distribution_*`, no `canonical_session`/`ui_meta`/`has_avatar`) with a
 * genuinely different shape, confirmed by reading both handlers; the two
 * are not interchangeable and this file does not reuse `ProfileInfo`.
 *
 * `resolveCanonicalChat` ports (not vendors — see its own header)
 * `apps/desktop/src/plugins/hermes-bots/canonical-chat.ts`'s identity
 * lookup: the profile's session titled exactly "Bot Chat".
 *
 * Round-1 correction (M15 Deviation 3): `profiles.configure`'s model section
 * (`methods_profiles.py:482-501`, `_configure_model`) genuinely cannot clear
 * a pin — `if not (model and provider): return None` no-ops whenever either
 * is missing — but round 1 stopped one layer too early and reported that as
 * "no RPC-level way to unpin at all". The desktop clears a pin through a
 * DIFFERENT RPC: `cli.exec` running `hermes --profile <name> config unset
 * model` (`apps/desktop/src/plugins/hermes-bots/profile-config.tsx:566-575`).
 * Checked both gates directly: `cli.exec`'s own registration
 * (`tui_gateway/methods_tools.py:434`, `@method("cli.exec")`) carries no
 * source restriction, and the headless-argv blocklist
 * (`tui_gateway/server.py:3163-3168`, `_CLI_EXEC_BLOCKED`) only names
 * `setup`, `gateway`, `sessions browse` and `config edit` — `config unset`
 * isn't in it. `clearBotModelPin` below is that same call, ported.
 */

import { gatewayRequest } from '../gateway/session-connection'
import { blobShapeString } from '../lib/bot-avatar'

export interface BotSessionPreview {
  id: string
  last_active?: number
  preview?: string
  started_at?: number
  message_count?: number
  title?: string
}

/** `methods_profiles.py:138-172`'s `_canonical_session_row` — the profile's
 *  "Bot Chat" registry row, resolved server-side on every `profiles.list`
 *  call. `id` is the durable registry row; `resolved_id` is the live
 *  compression-lineage tip (open THIS one; the registry row stays the
 *  identity — canonical-chat.ts:496-506 makes the same distinction). */
export interface BotCanonicalSession {
  id: string
  resolved_id?: string
  root_title?: string
  title?: string
  preview?: string
  started_at?: number
  last_active?: number
  message_count?: number
}

/** One `profiles.list` roster row (`methods_profiles.py:237-254`). */
export interface BotProfile {
  name: string
  path: string
  is_default: boolean
  model: string
  provider: string
  description: string
  display_name: string
  skill_count: number
  last_session?: BotSessionPreview | null
  worker_session?: BotSessionPreview | null
  canonical_session?: BotCanonicalSession | null
  ui_meta?: Record<string, unknown>
  ui_meta_revisions?: Record<string, number>
  has_avatar: boolean
}

export interface BotRosterResponse {
  profiles: BotProfile[]
  /** Always true: the backend injects the Bot Mode teammate-messaging
   *  protocol into every session, so a soul editor must NOT append it to
   *  `SOUL.md` itself (`methods_profiles.py:252-253`'s own comment). */
  bot_mode_protocol: boolean
}

/** `profiles.list` — the Bots tab roster. */
export function listBots(): Promise<BotRosterResponse> {
  return gatewayRequest<BotRosterResponse>('profiles.list', {})
}

export interface CreateBotParams {
  name: string
  description?: string
  model?: { model: string; provider: string }
  /** Locks the blobatar seed via `ui_meta['hermes-bots'].shape`
   *  (`src/lib/bot-avatar.ts`'s `blobShapeString`) when it differs from
   *  `name` — the default (no seed override) already renders from the name,
   *  so nothing is written in that case. */
  avatarSeed?: string
}

export interface CreateBotResult {
  ok: boolean
  name: string
  path: string
}

/**
 * `profiles.create` (`methods_profiles.py:337-374`) — the New bot sheet's
 * submit action. This app's `src/api/profiles.ts` wraps the narrower REST
 * `/api/profiles` body (`ProfileCreatePayload`, the desktop's own vendored
 * type — checked directly, it has no `description`/`model`/`provider` at
 * all, though the REST Pydantic model behind it does,
 * `hermes_cli/web_models.py:400-408` — a gap in the desktop's own TS type,
 * not something to route around here). The desktop's create dialog itself
 * calls the RPC, not that REST route
 * (`apps/desktop/src/plugins/hermes-bots/create-dialog.tsx`'s
 * `requestForTarget`/`host.request` calls), so this does too.
 *
 * `profiles.create` has no `ui_meta` param (checked its own params list),
 * so a custom avatar seed is a second `profiles.configure` call after a
 * successful create — the same RPC `configureBot` uses, called directly here
 * since `ui_meta` isn't part of `ConfigureBotPatch` (no settings-sheet caller
 * needs it yet).
 */
export async function createBot(params: CreateBotParams): Promise<CreateBotResult> {
  const rpcParams: Record<string, unknown> = { name: params.name }

  if (params.description !== undefined) {
    rpcParams.description = params.description
  }

  if (params.model) {
    rpcParams.model = params.model.model
    rpcParams.provider = params.model.provider
  }

  const result = await gatewayRequest<CreateBotResult>('profiles.create', rpcParams)

  if (result.ok && params.avatarSeed && params.avatarSeed !== params.name) {
    await gatewayRequest('profiles.configure', {
      name: params.name,
      ui_meta: { 'hermes-bots': { shape: blobShapeString(params.avatarSeed, '') } }
    })
  }

  return result
}

export interface BotSkill {
  name: string
  enabled: boolean
}

export interface BotToolset {
  name: string
  label: string
  description: string
  tool_count: number
  enabled: boolean
}

export interface BotMcpServer {
  name: string
  enabled: boolean
  transport: string
}

/** `profiles.describe` (RPC 5063) result — the bot-settings editor snapshot. */
export interface BotProfileDetail {
  name: string
  description: string
  soul: string
  model: { provider: string; default: string }
  skills: BotSkill[]
  toolsets: BotToolset[]
  /** True when `tools.enabled_toolsets` is explicitly pinned in config.yaml
   *  (vs. the platform-default set) — `methods_profiles.py:377-397`. */
  toolsets_pinned: boolean
  mcp_servers: BotMcpServer[]
}

/** `profiles.describe` — the bot-settings sheet's data source. */
export function describeBot(name: string): Promise<BotProfileDetail> {
  return gatewayRequest<BotProfileDetail>('profiles.describe', { name })
}

/**
 * Given the skill names a `CapabilitiesSheet` save attempted to disable and
 * a fresh, post-save `profiles.describe` skills list, returns the subset the
 * server kept enabled anyway. An essential skill (e.g. `hermes-agent`) is
 * silently dropped from the persisted `disabled` set — never actually
 * disabled — by `save_disabled_skills` (`hermes_cli/skills_config.py:43-54`,
 * `agent/skill_utils.py:268-270`'s `ESSENTIAL_SKILLS`); `profiles.configure`'s
 * own response only says the `disabled_skills` section was applied, not
 * which names survived, so the caller must re-read `profiles.describe` and
 * diff it against what it asked for. Pure so this is testable without
 * rendering `CapabilitiesSheet.tsx`; never hard-codes a skill name.
 */
export function skillsServerKeptEnabled(attemptedToDisable: ReadonlySet<string>, freshSkills: BotSkill[]): string[] {
  return freshSkills.filter(skill => attemptedToDisable.has(skill.name) && skill.enabled).map(skill => skill.name)
}

export interface ConfigureBotPatch {
  soul?: string
  description?: string
  /** `null`/absent leaves any existing pin unchanged — see this file's
   *  header for why it cannot express "clear the pin". */
  model?: { model: string; provider: string } | null
  confirmExpensiveModel?: boolean
  disabledSkills?: string[]
  enabledToolsets?: string[]
  enabledMcpServers?: string[]
}

/** `profiles.configure`'s response — sections are independent, `applied`
 *  reports each; `confirm_required`/`confirm_message` is the SAME
 *  handshake `config.set`'s model switch uses (`src/api/models.ts`'s
 *  `SessionConfigSwitchResult`), for the one guarded case: an expensive
 *  model pin needs `confirmExpensiveModel: true` on a resend. */
export interface ConfigureBotResult {
  ok: boolean
  applied: Record<string, boolean>
  confirm_required?: boolean
  confirm_message?: string
}

/** `profiles.configure` (RPC 5064). Sends only the fields the caller set —
 *  `methods_profiles.py:563-586` treats each section independently, so
 *  omitting a field leaves it untouched server-side (not cleared to empty). */
export function configureBot(name: string, patch: ConfigureBotPatch): Promise<ConfigureBotResult> {
  const params: Record<string, unknown> = { name }

  if (patch.soul !== undefined) {
    params.soul = patch.soul
  }

  if (patch.description !== undefined) {
    params.description = patch.description
  }

  if (patch.model) {
    params.model = patch.model.model
    params.provider = patch.model.provider
  }

  if (patch.confirmExpensiveModel) {
    params.confirm_expensive_model = true
  }

  if (patch.disabledSkills !== undefined) {
    params.disabled_skills = patch.disabledSkills
  }

  if (patch.enabledToolsets !== undefined) {
    params.enabled_toolsets = patch.enabledToolsets
  }

  if (patch.enabledMcpServers !== undefined) {
    params.enabled_mcp_servers = patch.enabledMcpServers
  }

  return gatewayRequest<ConfigureBotResult>('profiles.configure', params)
}

export interface ClearBotModelPinResult {
  ok: boolean
  code: number
  output: string
}

/**
 * Clears a bot's model pin back to "inherit the host default" — the one
 * thing `profiles.configure` cannot do (this file's header). Ports
 * `apps/desktop/src/plugins/hermes-bots/profile-config.tsx:566-575`
 * verbatim: `cli.exec` running `hermes --profile <name> config unset model`.
 * argv is a fixed array, never an interpolated string, so `name` cannot
 * inject an extra flag or subcommand; `name` is additionally checked against
 * the current roster first (`listBots()`) so a stale or mistyped name fails
 * before it ever reaches the gateway, rather than running `config unset`
 * against whatever `get_profile_dir` happens to resolve it to.
 *
 * Result treated the way the desktop does
 * (`profile-config.tsx:572`): `applied.model = result?.blocked !== true &&
 * result?.code === 0`.
 */
export async function clearBotModelPin(name: string): Promise<ClearBotModelPinResult> {
  const roster = await listBots()

  if (!roster.profiles.some(p => p.name === name)) {
    throw new Error(`Unknown bot profile: ${name}`)
  }

  const result = await gatewayRequest<{ blocked?: boolean; code?: number; hint?: string; output?: string }>(
    'cli.exec',
    { argv: ['--profile', name, 'config', 'unset', 'model'] }
  )

  return {
    code: result?.code ?? -1,
    ok: result?.blocked !== true && result?.code === 0,
    output: result?.output ?? ''
  }
}

export type BotAvatarAsset = { found: false } | { found: true; mime: string; size: number; data: string }

/** `profiles.get_asset` (RPC 5066) — the profile's uploaded avatar image
 *  (distinct from the generated blobatar face in `src/lib/bot-avatar.ts`:
 *  this is a user-picked photo, `found: false` when none was ever set). */
export function getBotAvatarAsset(name: string): Promise<BotAvatarAsset> {
  return gatewayRequest<BotAvatarAsset>('profiles.get_asset', { asset: 'avatar', name })
}

export interface SetBotAvatarResult {
  ok: boolean
  asset: string
  size: number
  removed?: number
}

/** `profiles.set_asset` (RPC 5065). `data` is a data URL or bare base64
 *  (PNG/JPEG/WebP, sniffed server-side, ≤2MB) — pass `clear: true` instead
 *  to delete the stored asset. */
export function setBotAvatarAsset(name: string, data: string): Promise<SetBotAvatarResult> {
  return gatewayRequest<SetBotAvatarResult>('profiles.set_asset', { asset: 'avatar', data, name })
}

export function clearBotAvatarAsset(name: string): Promise<SetBotAvatarResult> {
  return gatewayRequest<SetBotAvatarResult>('profiles.set_asset', { asset: 'avatar', clear: true, name })
}

// ── canonical chat resolution ────────────────────────────────────────────
//
// Ported (not vendored) from apps/desktop/src/plugins/hermes-bots/
// canonical-chat.ts: that file imports `@hermes/plugin-sdk` and `host`
// (Electron plugin-host tile/workspace orchestration — `host.openSession`,
// `workspaceMode`, tab focus), none of which has a mobile equivalent, so the
// whole file is not pure and cannot go through the sync script even if
// `apps/desktop/src/plugins/**` were on its allow-list (it isn't). What's
// ported below is the identity lookup and fail-closed contract alone, with
// the desktop's own line numbers cited — the click-path navigation, kickoff
// intro and tile staleness probing are UI/screen concerns for a later round.

/** canonical-chat.ts:48. */
export const CANONICAL_CHAT_TITLE = 'Bot Chat'

/** canonical-chat.ts:42. */
const PROFILE_SESSION_LIST_LIMIT = 200

interface CanonicalChatListRow {
  id: string
  resolved_id?: string
  root_title?: string
  title?: string
}

/** canonical-chat.ts:144-152: the durable-lineage-root title is authoritative
 *  when a gateway reports it; plain `title` covers windowed listings that
 *  don't. */
function isCanonicalBotChatRow(row: CanonicalChatListRow): boolean {
  const rootTitle = String(row.root_title || '').trim()
  const title = String(row.title || '').trim()

  return rootTitle === CANONICAL_CHAT_TITLE || (!rootTitle && title === CANONICAL_CHAT_TITLE)
}

/**
 * canonical-chat.ts:184-235's `findExistingCanonicalChat`, ported. Consults
 * `session.list` with the exact title (an indexed lookup, not a recency
 * window) rather than trusting `profiles.list`'s own `canonical_session`
 * (which can be a few seconds stale against the 5s roster poll —
 * `methods_profiles.py:207-210`'s own comment) — that field is used here
 * ONLY as the fail-closed signal canonical-chat.ts:230-232 describes: a
 * confirmed prior sighting turns an unconfirmed empty result into a thrown
 * error instead of "safe to create", the one guard against forking a bot's
 * forever chat that this port keeps.
 */
async function findExistingCanonicalChat(
  profileName: string,
  knownCanonicalSessionId?: null | string
): Promise<CanonicalChatListRow | null> {
  let rows: CanonicalChatListRow[]

  try {
    const res = await gatewayRequest<{ sessions?: CanonicalChatListRow[] }>('session.list', {
      include_hidden: true,
      limit: PROFILE_SESSION_LIST_LIMIT,
      profile: profileName,
      title: CANONICAL_CHAT_TITLE
    })

    rows = res?.sessions ?? []
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    throw new Error(`Could not check ${profileName}'s Bot Chat registry (${message}) — not starting a new chat`)
  }

  const match = rows.find(isCanonicalBotChatRow)

  if (match) {
    return match
  }

  if (knownCanonicalSessionId) {
    throw new Error(`Could not confirm ${profileName}'s Bot Chat registry — not starting a new chat`)
  }

  return null
}

/**
 * canonical-chat.ts:259-475's `createCanonicalChat`, narrowed to identity
 * resolution: creates the profile's ONE forever chat when none exists yet
 * (`session.create` with `hidden: true, follow_profile_config: true` —
 * canonical-chat.ts:348-363's exact params) and eagerly titles it
 * (canonical-chat.ts:378-413's reasoning: `session.create` is lazy, so an
 * untitled row loses a race with a second concurrent open). Does not submit
 * a kickoff intro turn (canonical-chat.ts:429-462) — that's New Agent
 * creation UI, a later round's concern — and does not adopt-on-title-
 * conflict (canonical-chat.ts:387-412): a title-uniqueness rejection here is
 * surfaced as a plain error rather than silently re-resolving, since this
 * function has no UI staleness probe to decide whether re-navigating is
 * still wanted.
 */
async function createCanonicalChat(profileName: string): Promise<string> {
  const created = await gatewayRequest<{ session_id?: string; stored_session_id?: string }>('session.create', {
    follow_profile_config: true,
    hidden: true,
    profile: profileName,
    title: CANONICAL_CHAT_TITLE
  })

  const runtimeId = created?.session_id
  const storedId = created?.stored_session_id

  if (!storedId) {
    throw new Error(`Could not create ${profileName}'s Bot Chat`)
  }

  if (runtimeId) {
    await gatewayRequest('session.title', { session_id: runtimeId, title: CANONICAL_CHAT_TITLE })
  }

  return storedId
}

/**
 * The bot's ONE forever chat, resolved by name — canonical-chat.ts:477-519's
 * `openBotCanonicalChat`, minus the navigation half (no screen this round).
 * Pass the roster row's `canonical_session?.id` as `knownCanonicalSessionId`
 * when you have one (from `listBots()`) so a transient empty `session.list`
 * result fails closed instead of re-minting a duplicate chat.
 */
export async function resolveCanonicalChat(
  profileName: string,
  knownCanonicalSessionId?: null | string
): Promise<string> {
  const existing = await findExistingCanonicalChat(profileName, knownCanonicalSessionId)

  if (existing) {
    return existing.resolved_id || existing.id
  }

  return createCanonicalChat(profileName)
}
