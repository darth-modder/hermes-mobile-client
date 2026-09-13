/**
 * Mobile counterpart of apps/desktop/src/lib/desktop-slash-commands.ts's
 * `NO_DESKTOP_SURFACE` classification. The server's registry
 * (`commands.catalog` / `complete.slash`) knows every command that exists;
 * this module only says which of them this client can actually fulfil, and
 * routes the rest to a generic RPC instead of hand-building a picker/action
 * for each one.
 *
 * Scope trim vs. the desktop file (documented as a Deviation in
 * M06-chat-screen.md): the desktop has local UI for a couple dozen commands
 * — pickers (`/model`, `/resume`), a skin switcher, a pet screen, a memory
 * graph. M13 Step 8 (task D) closes the gap for the ones that now have a
 * mobile screen to route to (M07's session list, M09's settings, M13's own
 * appearance screen); the rest stay `no-mobile-ui`. Terminal-only,
 * messaging-only and advanced-power-user commands are unavailable for the
 * same reasons they are on desktop — this app is not a TUI either, and
 * `/approve` `/deny` are the approval CARD's job, not typed text (see
 * ApprovalCard).
 */

import type { Href } from 'expo-router'

export type MobileUnavailableReason = 'advanced' | 'machine-bound' | 'messaging' | 'no-mobile-ui' | 'terminal' | 'voice'

export type MobileCommandRpc = 'prompt.btw' | 'session.compress' | 'session.interrupt' | 'session.title'

export type MobileCommandSurface =
  | { kind: 'rpc'; rpc: MobileCommandRpc }
  | { kind: 'exec' }
  | { kind: 'navigate'; route: Href }
  | { kind: 'unavailable'; reason: MobileUnavailableReason }

export interface MobileCommandSpec {
  name: string
  aliases?: string[]
  argumentMode?: 'mixed' | 'options' | 'text'
  surface: MobileCommandSurface
}

const rpc = (name: MobileCommandRpc): MobileCommandSurface => ({ kind: 'rpc', rpc: name })

const navigate = (route: Href): MobileCommandSurface => ({ kind: 'navigate', route })

const unavailable = (reason: MobileUnavailableReason): MobileCommandSurface => ({ kind: 'unavailable', reason })

// Commands this milestone's chat screen fulfils directly (session header /
// composer actions), bypassing the generic `slash.exec` round-trip.
const MOBILE_COMMAND_SPECS: readonly MobileCommandSpec[] = [
  { name: '/stop', surface: rpc('session.interrupt') },
  { name: '/compress', aliases: ['/compact'], surface: rpc('session.compress'), argumentMode: 'text' },
  { name: '/title', surface: rpc('session.title'), argumentMode: 'text' },
  { name: '/btw', surface: rpc('prompt.btw'), argumentMode: 'text' },

  // M13 Step 8 (task D): routed to the screens that now exist. `/new` and
  // `/reset` are the same backend command (`/reset` is a literal alias, not
  // "clear current context" — hermes_cli/commands.py), and `/resume`,
  // `/sessions`, `/switch` all alias to the same session-picker surface on
  // desktop (apps/desktop/src/lib/desktop-slash-commands.ts) — bare
  // invocation always opens a list, never auto-resumes the most recent
  // session, so all three route to the session list, same as the picker.
  {
    name: '/new',
    aliases: ['/reset'],
    surface: navigate({ params: { id: 'new' }, pathname: '/(main)/sessions/[id]' } as Href)
  },
  { name: '/resume', aliases: ['/sessions', '/switch'], surface: navigate('/(main)/session-list' as Href) },
  { name: '/model', surface: navigate('/(main)/settings/models' as Href) },
  { name: '/profile', surface: navigate('/(main)/settings/profiles' as Href) },
  { name: '/skills', surface: navigate('/(main)/settings/skills' as Href) },
  // Not in the task's literal 8-command list, but M13's own appearance
  // screen (Step 3) is exactly what desktop's `/skin` picker does — leaving
  // it `no-mobile-ui` after building that screen in this same milestone
  // would be an avoidable gap (M13 plan Deviations).
  { name: '/skin', surface: navigate('/(main)/settings/appearance' as Href) }
]

// Same rationale as desktop's NO_DESKTOP_SURFACE, reason-for-reason, plus
// `no-mobile-ui` for desktop actions/pickers this milestone has nowhere to
// put, and `machine-bound` for the ones AGENTS.md rules out entirely (pet
// overlay, embedded browser, the server's own mic/speaker) rather than
// "no UI built yet".
const NO_MOBILE_SURFACE: Record<MobileUnavailableReason, readonly string[]> = {
  terminal: [
    '/busy',
    '/clear',
    '/config',
    '/copy',
    '/cron',
    '/density',
    '/details',
    '/exit',
    '/footer',
    '/gateway',
    '/history',
    '/image',
    '/indicator',
    '/logs',
    '/mouse',
    '/paste',
    '/platforms',
    '/plugins',
    '/quit',
    '/redraw',
    '/reload',
    '/restart',
    '/sb',
    '/set-home',
    '/sethome',
    '/snap',
    '/snapshot',
    '/statusbar',
    '/toolsets',
    '/update',
    '/verbose'
  ],
  messaging: ['/approve', '/deny'],
  advanced: [
    '/curator',
    '/fast',
    '/insights',
    '/kanban',
    '/reasoning',
    '/reload-mcp',
    '/reload_mcp',
    '/reload-skills',
    '/reload_skills'
  ],
  voice: ['/voice'],
  // AGENTS.md "Machine features don't exist here": the pet overlay, the
  // embedded browser/preview, and `wake.*` (the server's own mic).
  'machine-bound': ['/pet', '/pets', '/hatch', '/generate-pet', '/browser', '/wake'],
  'no-mobile-ui': ['/branch', '/fork', '/handoff', '/journey', '/learning', '/memory-graph', '/yolo']
}

const ALL_SPECS: readonly MobileCommandSpec[] = [
  ...MOBILE_COMMAND_SPECS,
  ...(Object.entries(NO_MOBILE_SURFACE) as [MobileUnavailableReason, readonly string[]][]).flatMap(([reason, names]) =>
    names.map(name => ({ name, surface: unavailable(reason) }))
  )
]

const SPEC_BY_NAME = new Map<string, MobileCommandSpec>(ALL_SPECS.map(spec => [spec.name, spec]))

const ALIAS_TO_CANONICAL = new Map<string, string>(
  ALL_SPECS.flatMap(spec => (spec.aliases ?? []).map(alias => [alias, spec.name] as const))
)

function normalizeCommand(command: string): string {
  const trimmed = command.trim().toLowerCase()

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/** The mobile surface for a typed `/command` — falls through to `exec` (the
 *  generic `slash.exec` RPC) for anything the registry knows about that
 *  isn't one of the rows above: quick commands, plugin commands, skills,
 *  and every other built-in this client has no reason to special-case. */
export function mobileCommandSurface(command: string): MobileCommandSurface {
  const normalized = normalizeCommand(command)
  const canonical = ALIAS_TO_CANONICAL.get(normalized) ?? normalized
  const spec = SPEC_BY_NAME.get(canonical)

  return spec?.surface ?? { kind: 'exec' }
}

export function mobileCommandArgumentMode(command: string): 'mixed' | 'options' | 'text' | undefined {
  const normalized = normalizeCommand(command)
  const canonical = ALIAS_TO_CANONICAL.get(normalized) ?? normalized

  return SPEC_BY_NAME.get(canonical)?.argumentMode
}

export function isMobileCommandAvailable(command: string): boolean {
  return mobileCommandSurface(command).kind !== 'unavailable'
}

const UNAVAILABLE_MESSAGES: Record<MobileUnavailableReason, string> = {
  terminal: 'Only available in the terminal UI.',
  messaging: 'Use the approval card instead of typing this.',
  advanced: 'Not available on mobile yet.',
  voice: 'Use the mic button instead.',
  'machine-bound': "This drives the server's own machine, not your phone.",
  'no-mobile-ui': 'Not available on mobile yet.'
}

export function mobileCommandUnavailableMessage(reason: MobileUnavailableReason): string {
  return UNAVAILABLE_MESSAGES[reason]
}

/** A slash-palette row (from `commands.catalog` / `complete.slash`), filtered
 *  and annotated for the mobile composer: hidden commands are dropped
 *  entirely rather than shown greyed-out (M06 exit criterion: "hides
 *  pane-only commands"), matching the desktop's own popover behavior for its
 *  own NO_DESKTOP_SURFACE list. */
export interface SlashPaletteRow {
  display: string
  meta: string
  text: string
  kind: 'command' | 'skill'
}

export function filterSlashPalette(items: readonly SlashPaletteRow[]): SlashPaletteRow[] {
  return items.filter(item => item.kind === 'skill' || isMobileCommandAvailable(item.text))
}
