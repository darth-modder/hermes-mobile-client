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
