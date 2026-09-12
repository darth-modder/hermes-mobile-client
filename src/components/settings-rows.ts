// Pure data half of app/(main)/settings/index.tsx — no react-native import,
// so settings-rows.test.ts can import it directly (settings-header.tsx,
// which the screen also needs, pulls in @tabler/icons-react-native, which
// breaks vitest the same way AppDrawer.tsx and Transcript.tsx do — see
// drawer-rows.ts's header for the full explanation).
//
// Row titles are vendored (D15.4 / src/lib/t.ts: "every visible string on a
// ported screen comes from the desktop's own English copy"). Group labels
// ("Host", "Models and tools", "App", "Account") have no desktop equivalent
// — the desktop is a flat nav rail with no section headers — so they're
// copied verbatim from docs/mobile-prototypes/settings.html's own
// `.section-label` elements instead, the mobile-only structural grouping
// that prototype introduces.
//
// That prototype's own header comment flags the group order itself as an
// open question: this is the mobile prototype's *draft* "host-first" order
// (this app's pre-existing index order, with M14's additions folded in),
// not the desktop rail's literal order (Model, Chat, Appearance, Workspace,
// Safety, Browser, Memory & Context, Voice, Advanced, Notifications,
// Billing | Providers…, Gateways, Keybinds, Tools & Keys, Plugins, Archived
// Chats | About). M14 says "sections in the desktop's order"; which order
// wins on a phone needs a D-entry — flagging it, not deciding it here.
//
// One of the mobile prototype's rows (About) and Toolsets have no route yet
// — each lands in its own later M14 commit, per the milestone's own task
// order. Chat, Safety and Memory & Context landed above, in the "App" group
// alongside Appearance/Notifications/Voice: the M14 task doc places them
// there (device-facing app preferences). Billing and Archived chats land
// below, in "Account" alongside Plugins — About joins it there too, matching
// the desktop rail's own adjacency (Plugins, Archived Chats, About are
// consecutive there).
import { t } from '../lib/t'

export interface SettingsRowMeta {
  // A plain string, not expo-router's `Href` — see drawer-rows.ts's
  // DrawerRowMeta for why (mirrored here for the same router.push call-site
  // cast, even though this file doesn't need a Record index by route).
  route: string
  subtitle: string
  title: string
}

export interface SettingsGroup {
  label: string
  rows: readonly SettingsRowMeta[]
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    label: 'Host',
    rows: [
      {
        route: '/(main)/settings/connections',
        subtitle: 'Add, edit, test, switch, delete',
        title: t.settings.connections.title
      },
      { route: '/(main)/settings/profiles', subtitle: 'Switch or create a profile', title: t.profiles.title }
    ]
  },
  {
    label: 'Models and tools',
    rows: [
      { route: '/(main)/settings/providers', subtitle: 'API keys, custom endpoints', title: t.settings.nav.providers },
      {
        route: '/(main)/settings/models',
        subtitle: 'Main model, auxiliary tasks, toolsets',
        title: t.settings.sections.model
      },
      { route: '/(main)/settings/mcp', subtitle: 'Add, test, enable MCP servers', title: t.settings.nav.mcp },
      { route: '/(main)/settings/skills', subtitle: 'Enable, install, uninstall', title: t.skills.tabSkills }
    ]
  },
  {
    label: 'App',
    rows: [
      {
        route: '/(main)/settings/appearance',
        subtitle: 'Skin and light/dark mode',
        title: t.settings.sections.appearance
      },
      {
        route: '/(main)/settings/chat',
        subtitle: 'Personality, reasoning, reactions',
        title: t.settings.sections.chat
      },
      {
        route: '/(main)/settings/safety',
        subtitle: 'Approvals, allowlists, checkpoints',
        title: t.settings.sections.safety
      },
      {
        route: '/(main)/settings/memory',
        subtitle: 'Memory, context engine, compression',
        title: t.settings.sections.memory
      },
      {
        route: '/(main)/settings/notifications',
        subtitle: 'Push and in-app alerts',
        title: t.settings.notifications.title
      },
      { route: '/(main)/settings/voice', subtitle: 'Dictation and spoken replies', title: t.settings.sections.voice }
    ]
  },
  {
    label: 'Account',
    rows: [
      { route: '/(main)/settings/plugins', subtitle: 'Installed plugin dashboards', title: t.settings.nav.plugins },
      { route: '/(main)/settings/billing', subtitle: 'Plan, payment, usage', title: t.settings.nav.billing },
      {
        route: '/(main)/settings/archived-chats',
        subtitle: 'Unarchive or delete permanently',
        title: t.settings.nav.archivedChats
      }
    ]
  }
]
