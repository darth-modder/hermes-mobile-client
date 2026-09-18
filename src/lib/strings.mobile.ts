// The one whitelisted home for a genuinely mobile-only string — one with no
// desktop counterpart in the vendored `src/upstream/i18n/en.ts` — per the
// 2026-09-12 review of the settings label sweep. `src/lib/settings-labels.
// test.ts` only scans app/(main)/settings/**/*.tsx for retyped labels;
// importing a value from here (rather than writing it inline) is what takes
// a screen's copy out of that scan. Each export below carries a one-line
// note on why no vendored string fits — checked against en.ts, not assumed.
//
// This is NOT a place to put a label that DOES have a desktop counterpart
// just because the wording differs slightly — D15.4 says the vendored
// wording wins (e.g. "Connections" became "Registered gateways", settings/
// connections.tsx, 979bbcc's follow-up). Only things the desktop has no
// concept of at all belong here: mobile-specific gestures (dictation is a
// composer hold-gesture, not a settings toggle, on the desktop), the
// Push/In-app notification split (the desktop has one delivery path), and
// the two-line "Connected to <x>" summary card (a mobile-only settings-index
// affordance).

// src/components/drawer-rows.ts — the drawer row value for Agents and
// Command center (2026-09-12 review: "the user doesn't care whether the
// cause is host-managed config or an unported endpoint" — one shared
// string for both, not one per screen the way the settings-index rows
// get HOST_MANAGED_INDEX_VALUE below). No vendored equivalent: the desktop
// has no notion of a drawer row that describes itself as living elsewhere,
// since it IS the host.
export const DRAWER_ON_DESKTOP_VALUE = 'On the desktop'

// src/components/ScreenHeader.tsx, src/lib/settings-header.tsx,
// app/(main)/session-list.tsx — the drawer-hamburger button's
// accessibilityLabel. The desktop's closest concept ("Toggle sessions
// sidebar", a keybind description in en.ts) names a different interaction —
// a persistent sidebar's own toggle, not opening a full-screen overlay
// drawer — and no bare "Menu"/"Open menu" string exists anywhere in en.ts.
export const OPEN_MENU_ACCESSIBILITY_LABEL = 'Open menu'

// settings/about.tsx — this section header has no desktop counterpart: the
// desktop's about-settings.tsx never shows a per-connection host card (it
// isn't dialing anywhere), so there's no vendored word to reuse for the
// mobile-only "which host am I talking to" block. Copied from the mobile
// prototype's own `data-view="about"` `.section-label`.
export const ABOUT_HOST_SECTION_TITLE = 'Host'

// t.settings.about.version(value) already covers "Version X" (the desktop's
// own format, checked against en.ts's `settings.about` block); the parenthetical build
// number is an Android versionCode, a concept the desktop's about screen has
// no equivalent for (it pairs a git branch and commit via `branchCommit`
// instead — values this app has no build-time injection for, so they're not
// shown here rather than shown wrong).
export function aboutBuildSuffix(build: string): string {
  return ` (build ${build})`
}

// settings/appearance.tsx — "Skin" is this app's own established term for a
// desktop *palette*; the desktop itself has no separate "skin" word for a
// settings section (D15.2 uses "skin" throughout the app's own code and
// data model, so keeping the section label matching is more consistent
// than force-fitting a different vendored word here).
export const APPEARANCE_SKIN_SECTION_TITLE = 'Skin'

export function appearanceSkinSyncHint(themeLabel: string): string {
  return `Matches the desktop app's skins. The backend's active skin (${themeLabel}) applies automatically the first time it changes; pick a different one here to override it on this device.`
}

// artifacts/index.tsx (M10, M14 sweep) — the desktop's Artifacts page has no
// native share sheet at all (it offers Download / Copy content / Open in
// browser instead — a desktop app has no OS share target to hand off to);
// checked en.ts's artifacts/artifactCard/artifactPreview blocks and the rest
// of the file for a "Share" word, none exists. This app's own
// `shareArtifact` (src/api/artifacts.ts, expo-sharing) is the mobile-only
// equivalent.
export const ARTIFACTS_SHARE = 'Share'
export const ARTIFACTS_SHARING = 'Sharing…'
export const ARTIFACTS_SHARE_FAILED_TITLE = 'Could not share'

// projects/index.tsx (M10, M14 sweep) — the desktop keeps project
// management inside the sessions sidebar (docs/desktop-prototypes/b-panels/
// sessions-sidebar.html's `#sb=projects`/`#sb=project` views), which picks a
// folder from an on-device file browser; this screen's own header comment
// already explains why mobile instead types a server-side path, a concept
// the desktop's own folder picker has no placeholder text for (checked
// t.sidebar.projects: foldersLabel/addFolder/noFolders all assume the
// desktop's multi-folder-picker flow, none fits a single typed path).
export const PROJECTS_FOLDER_PLACEHOLDER = 'Primary folder path (on the server)'

// No vendored "you have no projects yet" empty state exists either: the
// closest string, t.sidebar.projects.moveNoProjects ("No other projects"),
// means something different (no OTHER project to move a session into, not
// zero projects total) and would misrepresent the actual state if reused
// here.
export const PROJECTS_EMPTY = 'No projects yet — create one below.'

// No vendored "+N more folders" template exists (checked t.sidebar.projects
// — only singular removeFolder/addFolder actions, no count summary; the
// closest shape, t.agents.moreFiles, is a different domain's "+N more
// files").
export function projectsMoreFoldersSuffix(count: number): string {
  return ` (+${count} more)`
}

// No vendored confirm-dialog TITLE exists for deleting a project (checked
// t.sidebar.projects — menuDelete is the menu item's bare "Delete", and
// deleteConfirm is the dialog BODY text, reused below for the Alert message;
// there's no matching "Delete project?" question anywhere in en.ts).
export const PROJECTS_DELETE_CONFIRM_TITLE = 'Delete project?'

// agents/index.tsx — the desktop's Agents view (docs/desktop-prototypes/
// a-main/agents.html) aggregates subagent delegations across every open
// session from its own `store/subagents`; nothing on mobile fills that
// role. A session's own delegations already reach this app as chat tool
// cards (per-session, via src/gateway/session-stream — checked: no
// cross-session subagent store exists anywhere under src/gateway or
// src/store), so this screen genuinely has no live feed to show. Per M14's
// "may not invent new backend API surface" rule (models.tsx/appearance.tsx/
// safety.tsx already drew this line for their own gaps), it says so rather
// than showing the vendored t.agents.emptyTitle/emptyDesc "No live
// subagents" copy — that copy means "checked, found none," which would
// misrepresent a capability gap as a verified data point when a session
// elsewhere might have subagents running this app just can't see.
export const AGENTS_NOT_AVAILABLE =
  "Live subagent activity isn't available from this app yet — no mobile API aggregates delegation status across sessions the way the desktop's own store does. Progress for a session you have open still streams inline as tool cards in that chat."

// Status legend descriptions for the AGENTS_NOT_AVAILABLE screen — paired in
// the component with vendored titles (t.agents.running/done/failed) since
// t.agents has no field text of its own beyond those bare status words.
// Adapted from docs/desktop-prototypes/a-main/agents.html's own Measurements
// block (status glyph meanings: braille spinner while running, circle-check
// when done, alert-circle on failure/interrupt) — the same "copy the
// prototype's own field text" precedent as CHAT_FIELDS/SAFETY_FIELDS/
// MEMORY_FIELDS below, since there's no vendored sentence-length
// description for any of them either.
export const AGENTS_RUNNING_DESC = 'A child agent is actively working — its latest step streams here.'
export const AGENTS_DONE_DESC = 'A child agent finished its delegated task.'
export const AGENTS_FAILED_DESC = 'A child agent stopped on an error or was interrupted.'

// command-center/index.tsx — the desktop's Usage panel (docs/desktop-
// prototypes/a-main/command-center.html) reads `getUsageAnalytics`
// (capability-scoped, multi-gateway analytics), which src/api/models.ts's
// own header already says isn't ported: "desktop's own multi-gateway
// concept ... not ported — no equivalent surface here." Reusing the
// vendored t.commandCenter.noUsage/noModelUsage/noSkillActivity/
// noDailyActivity empty-state copy here would claim "queried, found
// nothing" when this app never queries at all — same concern as
// AGENTS_NOT_AVAILABLE above — so this says so instead.
export const COMMAND_CENTER_USAGE_NOT_AVAILABLE =
  "Usage analytics aren't available from this app yet — no mobile API reads token, cost, or skill activity the way the desktop's dashboard does. View usage from the Hermes desktop app."

// Field descriptions for the stats/lists the desktop's Usage panel shows —
// paired in the component with vendored titles (t.commandCenter.
// statSessions/statApiCalls/statTokens/dailyTokens/topModels/topSkills).
// Adapted from the prototype's own markup and sectionDescriptions.usage
// ("Token, cost, and skill activity over time"), same precedent as
// AGENTS_*_DESC above.
export const USAGE_SESSIONS_DESC = 'Sessions active in the selected period.'
export const USAGE_API_CALLS_DESC = 'Model calls made across all sessions.'
export const USAGE_TOKENS_DESC = 'Total input and output tokens processed.'
export const USAGE_DAILY_TOKENS_DESC = 'Input vs. output tokens per day over the period.'
export const USAGE_TOP_MODELS_DESC = 'Models used most, by tokens processed.'
export const USAGE_TOP_SKILLS_DESC = 'Skills invoked most, by action count.'

// settings/archived-chats.tsx — nearly every string this screen needs
// (loading/empty/error states, Unarchive, Delete permanently, the message
// count) already exists under t.settings.sessions (D15.4). The one
// exception is the untitled-session fallback, which mirrors this app's own
// pre-existing term (app/(main)/session-list.tsx already falls back to
// "Untitled" for a null `SessionInfo.title`) rather than any desktop string
// (checked en.ts: no standalone "Untitled" value exists there).
export const ARCHIVED_SESSION_UNTITLED = 'Untitled'

// settings/billing.tsx — this app has no billing/credits API at all: past
// the mid-turn "out of credits" wall carried on the message stream
// (BillingBlock, src/upstream/lib/chat-messages/types.ts — only present
// while a turn is actively blocked, never queryable on its own), there is no
// endpoint to read a plan, payment method, or usage from. Desktop's own
// billing/index.tsx polls a dedicated REST route every 30s that has no
// mobile port (src/api/config.ts's header already draws this line for the
// sibling raw-config surface). Until a billing-status endpoint exists on
// mobile, this screen can only say so.
export const BILLING_NOT_AVAILABLE =
  "Billing isn't available from this app yet. Manage your plan, payment method, and usage from the Hermes desktop app or your account portal."

// The three config-schema-only settings sections (Chat, Safety, Memory &
// Context) show their host's field NAMES as read-only rows so a visitor
// learns what lives there instead of only reading an apology (2026-09-12
// review). Those field names/descriptions come from the desktop prototype's
// own markup (docs/desktop-prototypes/a-main/settings.html's data-view
// panels), copied faithfully — NOT from the vendored en.ts, despite it
// having the right shape for exactly this (`t.settings.fieldLabels` /
// `fieldDescriptions`, both typed `Record<string, string>` in
// src/upstream/i18n/types.ts): checked src/upstream/i18n/en.ts directly,
// both objects are empty (`fieldLabels: {}`, `fieldDescriptions: {}`,
// lines 671-672) — the desktop's config-schema field text was never
// vendored as translatable data, only ever hardcoded into the prototype
// HTML. This is the most faithful available source, and reproduces the
// desktop's real field text rather than the prototype's a step removed.
export interface HostManagedField {
  description: string
  title: string
}

// settings/index.tsx row value for Chat, Safety and Memory & Context: told
// up front, not after a tap, that the section is read-only (2026-09-12
// review — "a chevron that leads to a paragraph is the competitor's dead
// Notifications row with better manners"). No vendored equivalent exists
// for this either (checked) — the desktop has no notion of a section
// belonging to "the host" since it IS the host.
export const HOST_MANAGED_INDEX_VALUE = 'Host-managed'

// settings/chat.tsx — every row on the desktop's Chat panel (Personality,
// Timezone, Show Reasoning, Image Input Mode) is a config.yaml-schema field,
// autosaved through the desktop's generic config editor that src/api/
// config.ts's header already decided not to port ("out — the named
// 'providers' screen is env-vars and custom endpoints, not a schema-driven
// config editor"). Two more settings that conceptually belong on this
// screen per the M14 mapping — Collapse-thinking-by-default and Message
// Reactions (t.settings.appearance.reasoningCollapsedTitle/reactionsTitle,
// flagged in appearance.tsx's own Replicates comment) — have no local
// preference store either. Nothing here is backed by real state yet.
export const CHAT_NOT_AVAILABLE =
  "Chat preferences aren't editable from this app yet — they live in the host's config file, which this app doesn't read or write. Change them from the Hermes desktop app or hermes-cli."

export const CHAT_FIELDS: readonly HostManagedField[] = [
  { description: 'Default assistant style for new sessions.', title: 'Personality' },
  { description: 'Used for timestamps and scheduled jobs.', title: 'Timezone' },
  { description: "Stream the model's thinking into the transcript.", title: 'Show Reasoning' },
  { description: 'Controls how image attachments are sent to the model.', title: 'Image Input Mode' }
]

// channels/index.tsx (M10, M14 sweep) — the messaging platform list and the
// pairing list each have a vendored count-based header (t.messaging.
// pendingRequests(count), t.messaging.approvedUsers(count)) but no vendored
// empty-state sentence for either list at zero (checked t.messaging: no
// "no platforms"/"no pending" string exists there or anywhere else in
// en.ts).
export const CHANNELS_NO_PLATFORMS = 'No messaging platforms available.'
export const CHANNELS_NO_PENDING_PAIRING = 'No pending pairing requests.'

// app/connect/{index,scan}.tsx, app/connect/[id]/login.tsx (M04/M08, M14
// sweep) — the desktop's own login windows (docs/desktop-prototypes/
// d-windows/login-window.html) are external identity-provider pages Hermes
// doesn't author (OAuth/portal only — its own header comment: "NOTHING
// inside the window is Hermes UI"), and its onboarding remote form
// (e-overlays/onboarding.html #onboarding=remote/remote-token) covers only
// URL + OAuth + token, never a username/password form — checked both files
// and en.ts directly: no Username/Password field label, no QR-code string,
// and no camera-permission copy exists anywhere in the vendored strings,
// since none of this has a desktop counterpart at all (gated-by-password
// backends, this app's QR-pairing shortcut, and the OS camera permission
// prompt are all mobile-only concepts). Named individually rather than one
// shared blob so each stays traceable to the field it labels.
export const CONNECT_USERNAME_LABEL = 'Username'
export const CONNECT_PASSWORD_LABEL = 'Password'
export const CONNECT_SIGNING_IN = 'Signing in…'

export const CONNECT_SCAN_QR = 'Scan QR'
export const CONNECT_SCAN_PROMPT = 'Point the camera at a connection QR code.'
export const CONNECT_SCAN_INVALID_CODE = 'Not a valid connect code.'
export const CONNECT_SCAN_NOT_HERMES = 'Not a Hermes connect code.'
export const CONNECT_SCAN_MISSING_FIELDS = 'Connect code is missing url or token.'
export const CONNECT_CAMERA_ACCESS_NEEDED = 'Camera access is needed to scan a connect code.'
export const CONNECT_GRANT_CAMERA_ACCESS = 'Grant camera access'

// The manual "detect" trigger and its in-flight/result copy: the desktop's
// remote form (onboarding.html) probes as you type (debounced, no button of
// its own) and shows only `install.probing`/`probeError` while it works —
// this app instead needs an explicit trigger and a short human-readable
// summary of what the probe found (ungated/password/oauth), none of which
// the desktop expresses as its own string since it never surfaces the
// distinction in words, only by which fields it reveals next.
export const CONNECT_DETECT_LABEL = 'Detect auth mode'

export function connectUngatedStatus(version: string): string {
  return `Ungated backend (version ${version}) — token mode.`
}

export function connectPasswordStatus(providerLabel: string): string {
  return `Gated backend — password sign-in via "${providerLabel}".`
}

export function connectOauthStatus(providerLabel: string): string {
  return `Gated backend — sign in with ${providerLabel}.`
}

export const CONNECT_NO_AUTH_PROVIDER = 'Gated backend with no registered auth provider — cannot sign in yet.'

// The post-connect confirmation surfaces this app's own per-install
// identifier (installId, from MobileConnection — used elsewhere for
// session.create) rather than the desktop's backend version
// (`install.testSucceeded`/`connectedTo`): the two connections don't carry
// the same metadata, so reusing either vendored template would either drop
// data or print a value it was never written for.
export function connectSucceededStatus(installId: string | undefined): string {
  return `Connected — install_id=${installId ?? '(none)'}`
}

// connect/[id]/login.tsx's "Test WS ticket dial" control (post-login): an
// M04/M08 connectivity self-check left in deliberately for on-device
// verification of the WS ticket handshake — a real diagnostic tool, not a
// dead control (it does something when pressed), and has no desktop
// counterpart at all (that screen's own header comment explains why it
// stays rather than being pulled — not a call this labels sweep makes).
export const CONNECT_MINTING_TICKET = 'Minting ticket…'
export const CONNECT_WS_ERROR = 'WS error'
export const CONNECT_TEST_WS_TICKET_DIAL = 'Test WS ticket dial'

// settings/connections.tsx — this compact per-row auth-mode badge has no
// desktop equivalent: the desktop describes auth mode with full sentences
// ("This gateway uses a username and password...", en.ts's authSignedIn*/
// authNeeds* strings), never a short tag. "Nous Portal" here names the
// OAuth flow specifically, distinct from the community-support "Nous Portal
// Support" string elsewhere in en.ts.
export const CONNECTION_AUTH_MODE_LABEL = {
  oauth: 'Nous Portal',
  password: 'Password',
  token: 'Token'
} as const

// No vendored sign-out confirm exists (only a bare "Sign out" button label,
// t.settings.gateway.signOut, already used for the action itself).
export const CONNECTION_SIGN_OUT_CONFIRM_TITLE = 'Sign out?'
export const CONNECTION_NEVER_USED_SUFFIX = '· never used'
export const CONNECTION_NEEDS_SIGN_IN_SUFFIX = '· needs sign-in'
export const CONNECTION_SIGNING_OUT = 'Signing out…'

// settings/index.tsx — the boxed "Connected to <x> / Profile: <y>" summary
// card is a mobile-only settings-index affordance; the desktop's own
// Connected-to strings (en.ts's connectedTo/testSucceeded) are full
// sentences meant for a toast/status line, not a label-plus-value pair.
export const CONNECTED_TO_LABEL = 'Connected to'
export const NO_ACTIVE_CONNECTION = 'No active connection'
export const PROFILE_LABEL_PREFIX = 'Profile:'

// settings/mcp.tsx — no vendored remove-confirm exists for MCP servers
// (t.settings.mcp only has a bare "Remove" action label); the two-field
// (name, command-or-url) add form is this screen's own pre-existing manual
// alternative to the desktop's catalog-browse UI (src/api/mcp.ts's header),
// so its placeholder has no desktop counterpart either.
export const MCP_REMOVE_SERVER_CONFIRM_TITLE = 'Remove MCP server?'
export const MCP_TARGET_PLACEHOLDER = 'command, or https:// url'
export const MCP_ADDING = 'Adding…'

// settings/memory.tsx — every row on the desktop's Memory & Context panel
// (Memory, User Profile, Memory Provider, Context Engine, Auto-Compression,
// Compression Threshold) is either a config.yaml-schema field (see
// CHAT_NOT_AVAILABLE above) or one of the memory/curator endpoints
// src/api/system.ts's header explicitly left unported ("getMemoryStatus/
// resetMemory/getCuratorStatus/.../getMemoryProviderConfig/
// saveMemoryProviderConfig ... have no named M09 sub-screen"). Adding that
// API surface is data-fetching work, out of scope for a layout pass.
export const MEMORY_NOT_AVAILABLE =
  "Memory and context settings aren't available from this app yet — no mobile API exists to read or change them. Change them from the Hermes desktop app or hermes-cli."

export const MEMORY_FIELDS: readonly HostManagedField[] = [
  { description: 'Save durable memories that can help future sessions.', title: 'Memory' },
  { description: 'Maintain a compact profile of user preferences.', title: 'User Profile' },
  { description: 'Where memories are stored and recalled from.', title: 'Memory Provider' },
  { description: 'Strategy for managing long conversations near the context limit.', title: 'Context Engine' },
  { description: 'Summarize older context when conversations get large.', title: 'Auto-Compression' },
  { description: 'Share of the context window that triggers compression.', title: 'Compression Threshold' }
]

// settings/models.tsx — section titles/hints for the model list and the
// per-provider "(not configured)" suffix have no vendored match in
// src/upstream/i18n/en.ts (checked: no currentModel/chooseModel/
// notConfigured-shaped key exists anywhere in the file).
export const MODELS_CURRENT_SECTION_TITLE = 'Current model'
export const MODELS_SWITCHING = 'Switching…'
export const MODELS_CHOOSE_SECTION_TITLE = 'Choose a model'
export const MODELS_CHOOSE_HINT = 'Used for new sessions. A session can still switch model from the composer chip.'
export const MODELS_NOT_CONFIGURED_SUFFIX = '(not configured)'

// settings/notifications.tsx — the Push/In-app section split is this app's
// own adaptation of the desktop's single Notifications concept (only one of
// the two needs an EAS-published build); the desktop has no equivalent
// split to vendor a label from.
export const NOTIFICATIONS_PUSH_SECTION_TITLE = 'Push notifications'
export const NOTIFICATIONS_PUSH_HINT =
  'Delivered by the server when this device is backgrounded — never while the app is open. Requires an EAS-published build and a server with the hermes-push plugin installed.'
export const NOTIFICATIONS_IN_APP_SECTION_TITLE = 'In-app notifications'
export const NOTIFICATIONS_IN_APP_HINT = 'Shown locally while the app is running, for events on other sessions.'

// settings/notifications.tsx — the OS permission row. A concept the desktop
// has no equivalent for (Electron notifications carry no separate OS
// permission prompt the way Android/iOS do), added so this screen tells the
// truth about whether the OS will actually show anything the toggles above
// promise. checked t.settings.notifications for any permission-shaped key:
// none exists.
export const NOTIFICATIONS_PERMISSION_LABEL = 'System permission'
export const NOTIFICATIONS_PERMISSION_GRANTED = 'Granted'
export const NOTIFICATIONS_PERMISSION_NOT_GRANTED = 'Not granted'
export const NOTIFICATIONS_PERMISSION_ENABLE_ACTION = 'Enable notifications'
export const NOTIFICATIONS_PERMISSION_OPEN_SETTINGS_ACTION = 'Open system settings'
export const NOTIFICATIONS_PERMISSION_BLOCKED_HINT =
  'Android has stopped asking after a previous decline. Turn notifications on for this app in system settings.'

// settings/plugins.tsx — the vendored t.settings.plugins.blurb describes
// what agent plugins are, not that per-plugin dashboards aren't available
// on mobile yet; that gap is this platform's own, so the caveat stays here.
export const PLUGINS_MOBILE_CAVEAT =
  "Plugins installed on the backend. Per-plugin dashboards (a plugin's own web UI) aren't available on mobile yet — install and configure a plugin from the desktop app or CLI."

// settings/profiles.tsx — the explainer, the default-profile subtitle, the
// create-form placeholder, and the long-press hint have no vendored
// counterpart (t.profiles has titles/actions/counts, not this descriptive
// copy or a bare "profile name" placeholder).
export const PROFILES_EXPLAINER =
  'A profile is a separate config, sessions, and skill set on the same backend. Switching scopes every settings screen and new sessions to it.'
export const PROFILES_DEFAULT_SUBTITLE = "The connection's default profile"
export const PROFILES_NAME_PLACEHOLDER = 'profile name'

// settings/profiles.tsx — the Rename sheet's description
// (t.profiles.renameDescPrefix/Suffix, M14 task 5) wraps a literal path the
// desktop's own dialog also hardcodes outside its i18n system
// (docs/desktop-prototypes/f-dialogs/profile-dialogs.html's `rename` view:
// "...wrapper scripts in <span class="t-mono">~/.local/bin</span>." — the
// path itself is markup, not a translated string; checked en.ts, no key
// holds it either). Named here rather than left as a bare literal in the
// component so the labels test can tell it apart from an actually-retyped
// label.
export const PROFILES_RENAME_WRAPPER_PATH = '~/.local/bin'
export const PROFILES_DELETE_HINT = 'Long-press a profile to delete it. The default profile cannot be deleted.'

// settings/providers.tsx — provider-OAuth connect (a device-code flow) isn't
// wired on mobile yet (this screen's own header comment), so the CLI
// fallback hint is mobile-specific; "Not connected"/the two empty states/
// the active-endpoint suffix have no vendored match either (checked
// t.settings.providers — only "Connected" exists, not its opposite).
export const PROVIDERS_CLI_HINT = 'Connecting a new provider needs the CLI (`hermes model`) for now.'
export const PROVIDERS_NOT_CONNECTED = 'Not connected'
export const PROVIDERS_NO_OAUTH = 'No OAuth providers available.'
export const PROVIDERS_NO_CUSTOM_ENDPOINTS = 'No custom endpoints configured.'
export const PROVIDERS_ACTIVE_ENDPOINT_SUFFIX = '(active)'

export function providersDeleteEndpointConfirmTitle(name: string): string {
  return `Delete "${name}"?`
}

// settings/safety.tsx — every row on the desktop's Safety panel (Approval
// Mode, Approval Timeout, Confirm MCP Reloads, Command Allowlist, Redact
// Secrets, Allow Private URLs, File Checkpoints) is a config.yaml-schema
// field (see CHAT_NOT_AVAILABLE above). Approval mode also has no live
// mirror on mobile to fall back to as a read-only display: session-info.ts's
// header lists "approval_mode reconciliation (profile-scoped desktop
// settings sync)" among what was deliberately dropped porting the desktop's
// session-info handler, so there is nothing to read even without a write
// path.
export const SAFETY_NOT_AVAILABLE =
  "Safety settings aren't editable from this app yet — approval mode, command allowlists, and the rest live in the host's config file. Change them from the Hermes desktop app or hermes-cli."

export const SAFETY_FIELDS: readonly HostManagedField[] = [
  { description: 'How Hermes handles commands that need explicit approval.', title: 'Approval Mode' },
  { description: 'How long approval prompts wait before timing out.', title: 'Approval Timeout' },
  { description: 'Ask before reloading MCP servers mid-session.', title: 'Confirm MCP Reloads' },
  { description: 'Commands that never need approval.', title: 'Command Allowlist' },
  { description: 'Hide detected secrets from model-visible content when possible.', title: 'Redact Secrets' },
  { description: 'Let web tools reach localhost and private network addresses.', title: 'Allow Private URLs' },
  { description: 'Create rollback snapshots before file edits.', title: 'File Checkpoints' }
]

// settings/skills.tsx — no vendored remove-confirm for skills (t.skills.hub
// has bare "Uninstall", not a "Uninstall X?" confirm); the two empty states
// are more specific than the vendored t.skills.noSkillsTitle ("No skills
// found", the hub-search empty state, not installed-vs-available-to-install).
export const SKILLS_UNINSTALL_CONFIRM_TITLE = 'Uninstall skill?'
export const SKILLS_NONE_INSTALLED = 'No skills installed.'
export const SKILLS_NONE_AVAILABLE = 'No skills available to install.'

// settings/voice.tsx — dictation and spoken replies are composer hold-
// gestures on mobile (mic hold, speaker tap), not a desktop settings
// concept at all (this screen's own Replicates comment explains the
// adaptation); the mic-permission status words have no vendored match
// beyond "Checking…" (t.settings.about.checking, already reused as-is).
export const VOICE_DICTATION_SECTION_TITLE = 'Dictation'
export const VOICE_DICTATION_HINT =
  'Tap the mic in the composer to record; releasing it sends the clip to the backend for transcription and inserts the text into your message.'
export const VOICE_MIC_ACCESS_LABEL = 'Microphone access'
export const VOICE_MIC_GRANTED = 'Granted'
export const VOICE_MIC_NOT_GRANTED = 'Not granted'
export const VOICE_GRANT_MIC_ACCESS = 'Grant microphone access'
export const VOICE_SPOKEN_REPLIES_SECTION_TITLE = 'Spoken replies'
export const VOICE_SPOKEN_REPLIES_HINT =
  "Tap the speaker in the composer to hear the assistant's latest reply, synthesized by the backend and played back on this device."

// src/chat/Composer.tsx — the Steer button's label. Desktop's own strings for
// this action (`composer.steer`: 'Steer the running turn', `composer.
// queueSteer`: 'Steer — redirect the live turn now') are full sentences for a
// tooltip/aria-label, not a short button word — the same brevity Stop
// already gets from `composer.stopShort` ('Stop') has no equivalent short
// form for Steer anywhere in en.ts.
export const COMPOSER_STEER_LABEL = 'Steer'

// src/chat/Composer.tsx — the composer's placeholder. The desktop rotates
// through `composer.newSessionPlaceholders`/`followUpPlaceholders` per
// session; this app shows one fixed placeholder regardless of new-vs-
// follow-up state (a deliberate simplification), and none of the rotating
// options name the gateway the way this one does.
export const COMPOSER_PLACEHOLDER = 'Message Hermes…'

// M14 close-out round 2, task 4c: src/chat/Composer.tsx's voice/attachment
// row. Dictation, TTS playback, and image/document attachment are mobile
// composer gestures with no desktop settings-panel counterpart (see
// VOICE_DICTATION_HINT/VOICE_SPOKEN_REPLIES_HINT above) — checked en.ts
// directly for each of these and found no matching accessibilityLabel or
// toast copy anywhere (attachImages/imageAttachFailed exist but describe the
// desktop's own plural drag-drop/clipboard flow, a different feature from
// this single persistent icon button, so reusing that wording would misname
// what the control does).
export const COMPOSER_ATTACH_IMAGE_LABEL = 'Attach image'
export const COMPOSER_ATTACH_DOCUMENT_LABEL = 'Attach document'
export const COMPOSER_RECORD_VOICE_LABEL = 'Record voice message'
export const COMPOSER_STOP_RECORDING_LABEL = 'Stop recording'
export const COMPOSER_READ_LAST_REPLY_LABEL = 'Read last reply aloud'
export const COMPOSER_NOT_AVAILABLE_TITLE = 'Not available'
export const COMPOSER_SEND_FAILED_TITLE = 'Send failed'
export const COMPOSER_ATTACHMENT_FAILED_TITLE = 'Attachment failed'
export const COMPOSER_DICTATION_FAILED_TITLE = 'Dictation failed'
export const COMPOSER_COULD_NOT_START_RECORDING_TITLE = 'Could not start recording'
export const COMPOSER_NOTHING_TO_SPEAK_TITLE = 'Nothing to speak'
export const COMPOSER_NO_REPLY_TO_READ_MESSAGE = 'No new reply to read out.'
export const COMPOSER_SPEECH_FAILED_TITLE = 'Speech failed'

// M15 B, round 9: src/chat/Composer.tsx's hold-to-dictate states. Mobile-only
// by construction — hold-to-dictate is a touch gesture and the desktop has no
// counterpart at all: grepped `src/upstream/i18n/en.ts` for `auto.?send`,
// `autosend` and `editBeforeSend` and for any `hold`/`dictat`/`record` key,
// and there is nothing to reuse. `COMPOSER_RECORD_VOICE_LABEL` above already
// names the button itself; these three name the auto-send state the hold
// arms, the escape out of it, and the hint that explains the gesture on the
// accessibility label.
export const COMPOSER_AUTO_SEND_LABEL = 'Auto-send'
export const COMPOSER_AUTO_SEND_ARMED_HINT = 'Release to send'
export const COMPOSER_EDIT_BEFORE_SENDING_LABEL = 'Edit before sending'
export const COMPOSER_HOLD_TO_AUTO_SEND_HINT = 'Hold to dictate and send'

// M15 B, task 1: docs/mobile-prototypes/chat.html's `#chat=model`/`#chat=effort`
// views (lines 357-407) — the composer's model and effort chips. No desktop
// counterpart sheet titles exist for either (the desktop's own model picker
// is a menu panel, not a titled sheet — apps/desktop/src/app/shell/
// model-menu-panel.tsx has no "Model"/"Reasoning effort" heading of its own),
// so these are this mobile sheet's own copy, quoted from the prototype.
export const MODEL_CHIP_SHEET_TITLE = 'Model' // chat.html:373
export const MODEL_CHIP_SEARCH_PLACEHOLDER = 'Search models…' // chat.html:375
export const MODEL_CHIP_THIS_CHAT_SECTION = 'This chat' // chat.html:376
export const EFFORT_CHIP_SHEET_TITLE = 'Reasoning effort' // chat.html:400
export const MODEL_CHIP_PENDING_SUFFIX = ' (pending)'

/** Response stats line (M15 B, task 2) — quoted verbatim from
 *  docs/mobile-prototypes/chat.html:113's own example
 *  (`mimo-v2.5 · Σ 14K tok · 3.9 tok/s`); `tok`/`tok/s`/`min separator ·
 *  are this line's own mobile-only copy (the desktop's equivalent,
 *  apps/desktop/src/lib/statusbar.tsx's `tokensPerSecondLabel`, is a global
 *  status-bar figure — "t/s", no model — not a per-message line, so there
 *  is no vendored string to reuse for this shape). `model`/`tokens`/`tokPerSecond`
 *  are pre-formatted by the caller (compactNumber for tokens, one decimal
 *  for tok/s — see ResponseStats.tsx). `model` is omitted from the line
 *  (not shown as an empty leading " · ") when the server didn't stamp a
 *  model onto this particular message even though it did send `usage`. */
export function responseStatsLine(model: null | string, tokens: string, tokPerSecond: null | string): string {
  const parts = [model, `Σ ${tokens} tok`, tokPerSecond ? `${tokPerSecond} tok/s` : null].filter(
    (part): part is string => Boolean(part)
  )

  return parts.join(' · ')
}

// src/chat/SessionHeader.tsx — the manual `session.compress` action
// (compressSession, src/gateway/session-connection.ts). No vendored word
// exists for it anywhere in en.ts (checked case-insensitively); the closest
// hit, settings.model.compression ("Compression" / "Context compaction"), is
// a different screen's description of automatic threshold-based compaction,
// not this header button's own manual trigger.
export const SESSION_HEADER_COMPRESS_LABEL = 'Compress'
export const SESSION_HEADER_COMPRESS_FAILED_TITLE = 'Compress failed'

// src/chat/SessionHeader.tsx — the header overflow menu's manual re-hydrate
// action (M15 B, "Refresh conversation"). No vendored equivalent: the
// desktop's own window stays connected and its session state is kept live
// by the gateway socket for as long as it's open, so it has never needed a
// user-triggered re-hydrate; the closest hits in en.ts (cloudSignedInDesc /
// authSignedInOauth's "the session refreshes automatically") describe an
// unrelated auto-refresh, not a manual action. Mobile needs one because the
// app is routinely backgrounded/killed and reopened — see M15 task 1's
// stale-model bug, which this action also recovers from without a cold
// relaunch.
export const SESSION_HEADER_REFRESH_LABEL = 'Refresh conversation'
export const SESSION_HEADER_REFRESH_FAILED_TITLE = 'Refresh failed'
export const SESSION_HEADER_OVERFLOW_ACCESSIBILITY_LABEL = 'More'

// src/components/ScreenHeader.tsx — the overflow-menu button's
// accessibilityLabel. No bare "More" string exists in en.ts (the closest,
// assistant.thread.moreActions, is "More actions" — a different control, the
// per-message action row, not this screen-level header button).
export const SCREEN_HEADER_MORE_ACCESSIBILITY_LABEL = 'More'

// src/chat/Transcript.tsx — the jump-to-latest pill (M15 B, task "Jump-to-
// latest"), quoted from docs/mobile-prototypes/chat.html:179's own example
// ("Latest · 3"). Mobile-only: the desktop has no scrolled-away transcript
// state to name (its own window just keeps the tail in view), so there's no
// vendored string to reuse.
export function latestPillLabel(count: number): string {
  return `Latest · ${count}`
}

// src/chat/parts/UsageChip.tsx — the context-window-pressure suffix next to
// the token count (session.usage's context_percent). No vendored format
// string exists for this anywhere in en.ts (checked for context_percent/
// contextPercent/ctx-shaped keys — none).
export const USAGE_CHIP_CONTEXT_SUFFIX = '% ctx'

// src/chat/parts/ApprovalCard.tsx — this M06 card's own chrome. The mid-
// turn-prompts.html pairing (M14 mapping, Section E) restyles this card's
// structure to the prototype but its copy was never vendored text to begin
// with (checked en.ts: no "Approval required"/guardian-related string
// exists anywhere).
export const APPROVAL_CARD_TITLE = 'Approval required'
export const APPROVAL_CARD_SMART_DENIED_NOTICE = 'Flagged by the guardian — reduced to once/deny.'

// src/chat/parts/ClarifyCard.tsx — same M06-card-copy situation as
// ApprovalCard above. No vendored equivalent (t.chat.parts.clarify only has
// the tool-call-row done/pending/pendingAction words — "Asked a question" —
// not this card's own title or its free-text answer placeholder).
export const CLARIFY_CARD_BATCH_TITLE = 'A few questions'
export const CLARIFY_CARD_SINGLE_TITLE = 'Question'
export const CLARIFY_CARD_ANSWER_PLACEHOLDER = 'Type an answer…'

// src/chat/parts/SudoCard.tsx, src/chat/parts/SecretCard.tsx — NOT new
// mobile-only strings. Both cards' titles are fixed here to read from the
// vendored t.prompts.sudoTitle ('Administrator password') and
// t.prompts.secretTitle ('Secret required') instead of the retyped
// "Sudo password requested" / "Secret requested" the labels-test sweep
// found (task 4c) — see the fix in those files directly, not a whitelist
// entry, since a real vendored string already existed for exactly this.

// app/(main)/bots/index.tsx (M15 A round 2). Bot Mode's real copy lives in
// `apps/desktop/src/plugins/hermes-bots/i18n.ts`, a PLUGIN-scoped i18n
// bundle registered via `ctx.i18n.register` — never touching core `en.ts`
// (that file's own header, line 3: "never touching core en.ts"). It isn't
// on the sync allow-list either (it imports `@hermes/plugin-sdk`, not
// pure), so these are hand-copied from its `en` object literal with the
// exact line cited, not vendored through the sync script.
export const BOTS_TAB_LABEL = 'Bots' // apps/desktop/src/plugins/hermes-bots/plugin.tsx:95 — hardcoded upstream too, not itself a translation key
export const BOTS_NEW_TITLE = 'New bot' // hermes-bots/i18n.ts:332, `bot.newTitle`
export const BOTS_EMPTY_TITLE = 'No bots yet' // hermes-bots/i18n.ts:275, `roster.emptyTitle`
export const BOTS_EMPTY_DESC = 'Create your first bot.' // hermes-bots/i18n.ts:276, `roster.emptyDesc`
export const BOTS_DESCRIPTION_PLACEHOLDER = 'What should this bot help with?' // hermes-bots/i18n.ts:335, `bot.helpPromptPlaceholder`
export const BOTS_CREATE_FAILED = 'Could not create the profile yet' // hermes-bots/i18n.ts:344, `bot.createFailed`
// create-dialog.tsx:1010 — literal in the desktop's own JSX, not an i18n
// key there either ('Create Bot' / 'Creating…').
export const BOTS_CREATE_ACTION = 'Create Bot'
export const BOTS_CREATING_ACTION = 'Creating…'

// The handle field's hint: `docs/mobile-prototypes/bots.html`'s own `Field:`
// marker ("the name hint states the rule, not just the label") — this
// exact copy has no vendored source anywhere (checked en.ts and
// hermes-bots/i18n.ts: the desktop's own Name field, create-dialog.tsx:628,
// carries no hint text at all, just a placeholder, "inbox-triage") — a
// mobile-only addition, not a retyped label.
export const BOTS_NAME_HINT = 'Lowercase profile handle, for example research-rabbit.'

// "Avatar seed": a mobile-only simplification of the desktop's visual
// AvatarPicker (color swatches + shape tiles, avatar-picker.tsx) into one
// text field that locks `blobatar`'s seed (src/lib/bot-avatar.ts). The
// desktop has no equivalent text field or copy to vendor — this UI concept
// doesn't exist on the desktop at all.
export const BOTS_AVATAR_SEED_LABEL = 'Avatar seed'
export const BOTS_AVATAR_SEED_HINT = "Leave as the bot's name for the default face, or lock a different one."

// New bot sheet's model picker: "no pick" means the profile inherits the
// host's default model (`profiles.create` no-ops its model section unless
// both model AND provider are given, `methods_profiles.py:482-501`'s
// `_configure_model` guard — the same one this file's Deviation 3 note
// documents for `profiles.configure`). `t.profiles.default` ('default') is
// the profile-list DEFAULT-BADGE word, a different concept — no vendored
// phrase means "inherits the host's default model" anywhere (checked
// t.settings.model and t.profiles).
export const BOTS_MODEL_INHERIT_LABEL = 'Inherit host default'

// src/components/BotSettingsSheet.tsx (M15 A round 2, task 2). "Bot
// settings" is bots.html's own sheet title (docs/mobile-prototypes/
// bots.html's `settings` view) — the desktop's equivalent dialog is titled
// "Edit profile" (hermes-bots/i18n.ts:333, `bot.editTitle`), a different
// word for the phone's own framing, so this isn't a retyped label so much
// as an intentional mobile title choice already drawn in the prototype.
export const BOTS_SETTINGS_TITLE = 'Bot settings'
export const BOTS_CAPABILITIES_TITLE = 'Capabilities'
export const BOTS_CAPABILITIES_SUBTITLE = 'Skills and toolsets for this bot'
export const BOTS_MODEL_PIN_SUBTITLE = 'Pinned for this bot'
// bots.html:313 — the SOUL.md field's own hint line, quoted verbatim (not a
// `Field:` marker, just the prototype's field copy — no vendored source
// exists for it, checked t.profiles' soul-related strings).
export const BOTS_SOUL_HINT = 'Replaces the generated persona. Saves on blur; a change on the host asks first.'
// bots.html:329 — `Field:` "host-authority framing in the settings copy".
export const BOTS_HOST_AUTHORITY_NOTE =
  'The host owns models, credentials, tools, memory, skills and approvals. This client is the control surface.'
export const BOTS_SOUL_CHANGED_ON_HOST_TITLE = 'Soul changed on the host'
export const BOTS_SOUL_CHANGED_ON_HOST_MESSAGE =
  'This bot’s SOUL.md was edited somewhere else since you opened it. Overwrite it with your version?'
export const BOTS_SOUL_SAVE_FAILED = 'Could not save SOUL.md'
export const BOTS_CAPABILITIES_SEARCH_PLACEHOLDER = 'Search skills and toolsets…'
export const BOTS_CAPABILITIES_SKILLS_SECTION = 'Skills'
export const BOTS_CAPABILITIES_TOOLSETS_SECTION = 'Toolsets'

// src/components/CapabilitiesSheet.tsx (M15 A-close round 1). The gateway
// silently refuses to disable an essential skill — `save_disabled_skills`
// drops it from the persisted set unconditionally
// (hermes_cli/skills_config.py:43-54, `agent/skill_utils.py:268-270`'s
// `ESSENTIAL_SKILLS`) — so after a save the sheet re-reads `profiles.describe`
// and, for any skill the user turned off that the server kept enabled, shows
// this instead of silently reverting the switch with no explanation. Never
// hard-codes which skill is essential — the server's readback decides.
export function botsCapabilitiesSkillLockedNote(name: string): string {
  return `“${name}” can’t be disabled — the host keeps it on.`
}

export const BOTS_MODEL_CONFIRM_TITLE = 'Confirm model switch'

// ── Tasks tab (M15 C, app/(main)/tasks/**, src/components/NewTaskSheet.tsx) ──
//
// Every string below was checked against the vendored `src/upstream/i18n/
// en.ts` `cron.*` block first, which is rich — `title`, `states.*`,
// `emptyTitleNew`, `emptyDescNew`, `promptLabel`, `deliverLabel`,
// `modelLabel`, `triggerNow`, `pauseTitle`, `resumeTitle`, `deleteTitle`,
// `createAction`, `scheduleLabels.*`, `scheduleHints.*` and the whole
// humanizer vocabulary are all used directly from there and are deliberately
// NOT duplicated here. What follows is only what the desktop has no concept
// of, because the desktop has no Tasks *tab*: it has a /cron overlay.

// tasks.html:26-27, a `Field (ours)` — the counters above the list. en.ts has
// `cron.states.running` ('running'), the state of one job; it has no word for
// "how many are running at this moment", which is what the tile counts. The
// desktop never aggregates this because its pane shows every job at once.
export const TASKS_RUNNING_NOW_LABEL = 'Running now'
// Pairs with the tile above. `cron.states.scheduled` is the lowercase
// per-job state; this is the tile's heading for the count of them.
export const TASKS_SCHEDULED_LABEL = 'Scheduled'

// tasks.html:140 — the row's state chip when a job is mid-run. en.ts's
// `cron.states.running` is the bare adjective 'running'; the prototype says
// "running now" specifically to distinguish the in-flight job from the ones
// merely enabled, which on this screen sit in the same column.
export const TASKS_STATE_RUNNING_NOW = 'running now'

// tasks.html:121 — the list's one section heading. en.ts's `cron.title` is
// 'Scheduled jobs' and is already used as this screen's *header* title, so
// reusing it for the section inside would print the same words twice; this
// is the section's own label.
export const TASKS_SECTION_LABEL = 'Scheduled jobs'

// tasks.html:131 — the row meta line, "Next … · last …". The desktop's cron
// page labels these as grid headers ('NEXT'/'LAST' in its own markup, not
// en.ts strings — checked, there is no `cron.nextRun`/`cron.lastRun`), so
// there is nothing vendored to reuse for the inline prefixes.
export const TASKS_NEXT_RUN_PREFIX = 'Next'
export const TASKS_LAST_RUN_PREFIX = 'last'

// tasks.html:99 / :345 — the header action and the empty state's button.
// en.ts has `cron.newCron` ('New cron') and `cron.createTitle` ('New cron
// job'); both name the desktop's own noun. This tab's noun is "task"
// throughout its prototype, which is the whole point of the re-framing, so
// the label follows the screen rather than the vendored wording. Recorded as
// a Deviation in the M15 doc.
export const TASKS_NEW_TASK_ACTION = 'New task'
export const TASKS_NEW_TASK_TITLE = 'New task'

// tasks.html:264 — the template chip row's heading. `cron.blueprints.
// startFrom` in en.ts is 'Start from', which fits exactly; used from there,
// not redefined. (Noted so the absence of a constant here reads as checked,
// not forgotten.)

// tasks.html:283 — the schedule section heading in the New task sheet.
// en.ts has no heading for this: the desktop's create dialog puts the
// schedule Select inline with no section of its own.
export const TASKS_WHEN_TO_RUN_LABEL = 'When to run'

// tasks.html:300-302 — the raw-expression field under the picker.
// `cron.scheduleHints.custom` ('Cron syntax or natural language') is the
// vendored hint and IS used as this field's hint; the label itself has no
// vendored counterpart.
export const TASKS_ADVANCED_SCHEDULE_LABEL = 'Advanced — schedule string'

// tasks.html:274 — the Name field. en.ts's cron block has no `nameLabel`
// (checked): the desktop's create dialog derives the name from the prompt
// rather than asking for one.
export const TASKS_NAME_LABEL = 'Name'
export const TASKS_NAME_PLACEHOLDER = 'Morning inbox digest'

// tasks.html:270 — the "no template" chip that clears a picked blueprint.
// The desktop's "Start from" Select has an empty option with no label; a
// chip row needs a word on the chip.
export const TASKS_TEMPLATE_NONE = 'Custom'

// The detail screen's Prompt / Run history section headings and its
// delete-confirm body. `cron.promptLabel` ('Prompt') is vendored and used;
// 'Run history' is not in en.ts (checked) — the desktop labels that pane in
// markup. The confirm body is assembled from the vendored
// `cron.deleteDescPrefix`/`deleteDescSuffix` pair, so nothing is added here.
export const TASKS_RUN_HISTORY_LABEL = 'Run history'
export const TASKS_NO_RUNS_YET = 'No completed runs yet'

// src/components/drawer-rows.ts — the drawer row for the Tasks tab, closing
// M15's Deviation 6. The vendored `t.sidebar.nav.cron` ('Scheduled jobs') is
// what the row said while it still opened the old cron screen, and it is
// still the right words for the *screen header* (the Tasks screen uses
// `t.cron.title`, the same string). This is the tab's own name, which
// `docs/mobile-prototypes/tasks.html` uses throughout (:33 `#tasks=list`,
// :102-106 the tab row, :95 the header title) and which the M14 tab row
// names alongside Bots and Sessions. No vendored counterpart: the desktop
// has no Tasks tab, only a /cron overlay.
export const TASKS_TAB_LABEL = 'Tasks'

// app/(main)/tasks/[id].tsx's schedule grid label and
// src/components/NewTaskSheet.tsx's picker row. Round 12 device-verification
// caught both rendering `t.cron.scheduleLabels.custom` ("Custom") as a FIELD
// label — the detail grid read "CUSTOM  Every day at 8:00 AM · 0 8 * * *" and
// the sheet's row read "Custom  0 9 * * *". `scheduleLabels.*` is the map of
// schedule *kinds* (daily/weekdays/…/custom); it names the value, never the
// field. en.ts's cron block has no field label for either (checked): the
// desktop's create dialog puts the schedule Select inline with no label of
// its own, and its inspector labels the grid in markup. The prototype names
// them — "Schedule" in the detail grid (tasks.html:195) and "Frequency" in
// the sheet (tasks.html:285).
export const TASKS_SCHEDULE_FIELD_LABEL = 'Schedule'
export const TASKS_FREQUENCY_LABEL = 'Frequency'

// ── Connect / pairing (M15 D, app/connect/index.tsx) ────────────────────────
//
// Connect is a mobile-only flow — `docs/mobile-prototypes/connect.html:54-56`
// says so outright: "the desktop reaches a gateway from its own settings and
// has no pairing story". So `src/upstream/i18n/en.ts` has nothing to reuse for
// any of it. Checked, and the only loopback copy it does carry runs the other
// way: `:862` `localDesc` RECOMMENDS localhost ("Start a private Hermes
// backend on localhost") and `:1901` ships `http://127.0.0.1:8080` as a
// placeholder — both correct on a desktop, which IS the host, and both exactly
// the advice this screen has to contradict on a phone.

// connect.html `:start` view — the two entry cards.
export const CONNECT_TAILSCALE_TITLE = 'Pair over Tailscale'
export const CONNECT_TAILSCALE_RECOMMENDED = 'Recommended'
export const CONNECT_TAILSCALE_DESC =
  'The phone joins the same private tailnet as your computer, so port 9119 never faces the public internet.'
export const CONNECT_URL_TITLE = 'Enter a URL'
export const CONNECT_URL_DESC =
  'You already have a reachable, authenticated gateway — a LAN address, a reverse proxy, or an emulator host.'

// connect.html `:steps` view — three steps, two machines.
export const CONNECT_STEPS_TITLE = 'Pair a phone'
export const CONNECT_STEPS_SUBTITLE = 'Three steps, two machines'
export const CONNECT_STEP_TAILNET_TITLE = 'Join the same Tailnet'
export const CONNECT_STEP_TAILNET_DESC =
  'Install Tailscale here and on your computer, then sign both into the same tailnet.'
export const CONNECT_STEP_GATEWAY_TITLE = 'Run a reachable gateway'
export const CONNECT_STEP_GATEWAY_DESC =
  'On the computer, bind `hermes serve` to the tailnet address so the auth gate engages.'
export const CONNECT_STEP_AUTH_TITLE = 'Authenticate in the app'
export const CONNECT_STEP_AUTH_DESC =
  'Enter the tailnet URL, test it, then sign in. The password is exchanged for revocable tokens.'

// connect.html `:steps` — the `Field:` checklist, pasteable on the host
// (:20-22).
//
// NOT the prototype's three lines verbatim. Its third is
// `hermes auth add password --user tester`, and that command does not exist:
// `hermes auth add <provider>` is "Add a pooled credential"
// (hermes_cli/_parser.py:73) and configures MODEL-provider API keys, not the
// dashboard gate. The real mechanism is the basic-auth plugin's env vars
// (plugins/dashboard_auth/basic/__init__.py:220-222) plus the signing secret
// at :191-202 — without which every gateway restart invalidates every issued
// cookie and signs the phone out. Recorded as a Deviation in the M15 doc;
// docs/CONNECTING.md carries the long form.
export const CONNECT_COPY_CHECKLIST = 'Copy setup checklist'
export const CONNECT_COPY_CHECKLIST_HINT = "Copies the commands, in order, for the computer's terminal."
export const CONNECT_CHECKLIST_COMMANDS = [
  'tailscale up',
  'export HERMES_DASHBOARD_BASIC_AUTH_USERNAME=you',
  'export HERMES_DASHBOARD_BASIC_AUTH_PASSWORD=<a long random password>',
  'export HERMES_DASHBOARD_BASIC_AUTH_SECRET=$(python -c "import secrets;print(secrets.token_hex(32))")',
  'hermes serve --host $(tailscale ip -4) --port 9119'
].join('\n')

// connect.html `:steps` / `:start` — the link to the host-side recipe, which
// is docs/CONNECTING.md (the prototype names that file at :56).
export const CONNECT_THIS_COMPUTER_TITLE = 'This computer'
export const CONNECT_GUIDE_LINK = 'Gateway connection guide'
export const CONNECT_GUIDE_HINT = 'How to keep `hermes serve` running on Windows, macOS or Linux, and bind it safely.'

// connect.html `:url` view — the field, now tailnet-shaped. It used to be
// `http://127.0.0.1:9119` (app/connect/index.tsx:245 before this round), which
// the prototype calls out as the thing to stop doing (:17-19).
export const CONNECT_URL_PLACEHOLDER = 'https://your-pc.tailnet.ts.net:9119'
export const CONNECT_URL_HINT_TAILSCALE =
  'Never enter 127.0.0.1, localhost or 10.0.2.2 on your phone — those point back at the phone itself, not at your computer.'
export const CONNECT_NOTHING_SENT_YET = 'Nothing is sent anywhere yet. Sign-in appears only after the gateway answers.'

// connect.html `:rejected` view — "the error IS the guard sentence: rule plus
// reason, in the field, not a toast". One function per rejection family so the
// sentence can name the address actually typed.
export function connectRejectedLoopback(host: string): string {
  return `That address is this phone, not your computer. “${host}” points back at the phone itself, so there is nothing here to test.`
}

export function connectRejectedEmulatorHost(host: string): string {
  return `That address is this phone, not your computer. “${host}” is the emulator's alias for the machine running it, not a tailnet address — use the computer's tailnet name instead.`
}

export function connectRejectedUnspecified(host: string): string {
  return `That address is this phone, not your computer. “${host}” means “every interface” when a server binds it; it is not an address you can dial.`
}

// Shown under the URL field when the address is an explicit `http://` one
// pointing off this device (`isUnencryptedGatewayUrl`, src/net/gateway-url-
// guard.ts). It warns; it never blocks — the app permits cleartext on purpose
// (plugins/withCleartextTraffic.js: `hermes serve` offers no TLS, so demanding
// HTTPS would demand a reverse proxy of every user before the app works once).
//
// The reason it exists: what crosses the wire in the clear is not just the
// chat, it is the session token that authenticates every later request, and
// nothing on screen would otherwise say so. Phrased as the one thing the user
// can act on — the network they are on — rather than as a scolding, because
// the recommended fix (a reverse proxy) is not something the screen can offer.
export const CONNECT_UNENCRYPTED_WARNING =
  'Not encrypted. http:// sends your session token and messages in the clear — use it only on a network you trust.'

export const CONNECT_USE_COMPUTER_ADDRESS_TITLE = "Use the computer's address"
export const CONNECT_USE_COMPUTER_ADDRESS_DESC = 'Its tailnet name, for example https://your-pc.tailnet.ts.net:9119.'
export const CONNECT_BACK_TO_STEPS = 'Back to the pairing steps'

// connect.html `:steps` — the button onto the URL step.
export const CONNECT_NEXT_URL = 'Next: enter the gateway URL'

// The "This computer" card's destination. `docs/CONNECTING.md` is a repo
// file, not a hosted page, so the phone cannot open it locally; this points
// at the same file on the project's origin. Kept beside the copy it belongs
// to rather than in a config, because it is a label's destination.
export const CONNECTING_DOC_URL = 'https://github.com/darth-modder/hermes-mobile/blob/main/docs/CONNECTING.md'

// ── Connection banner (M15 D, src/chat/ConnectionBanner.tsx) ────────────────
//
// The banner's existing copy is vendored from `boot.*` (that component's own
// header records why: gateway-connecting.html has no banner-shaped string of
// its own). What M15 D adds has no vendored source either — checked `boot.*`
// and `settings.gateway.*` in en.ts: the desktop has no "needs attention"
// banner with a recovering action, because it never loses its own backend the
// way a phone loses a host. connect.html:24-27 marks this a `Field:` — "a
// banner whose primary action actually recovers the stated cause".
export const BANNER_NEEDS_ATTENTION_TITLE = 'Connection needs attention'
export const BANNER_SYNC_NOW = 'Sync now'
export const BANNER_SIGN_IN_AGAIN = 'Sign in again'
// The 401 case. `boot.errors.*` has nothing for "your token expired, sign in
// again" — the desktop's equivalent is a login window, not a banner line.
export const BANNER_NEEDS_LOGIN_DETAIL = 'The host rejected this phone’s credentials. Sign in again to continue.'
