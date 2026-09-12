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

// settings/appearance.tsx — "Skin" is this app's own established term for a
// desktop *palette*; the desktop itself has no separate "skin" word for a
// settings section (D15.2 uses "skin" throughout the app's own code and
// data model, so keeping the section label matching is more consistent
// than force-fitting a different vendored word here).
export const APPEARANCE_SKIN_SECTION_TITLE = 'Skin'

export function appearanceSkinSyncHint(themeLabel: string): string {
  return `Matches the desktop app's skins. The backend's active skin (${themeLabel}) applies automatically the first time it changes; pick a different one here to override it on this device.`
}

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
// beyond "Checking…" (t.settings.gateway.checking, already reused as-is).
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
