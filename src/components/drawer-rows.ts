// Pure data half of AppDrawer.tsx's row list — no react-native/Tabler
// import, so the drawer-order test (drawer-rows.test.ts) can import it
// directly. Importing AppDrawer.tsx itself into a vitest `.test.ts` doesn't
// work in this project: react-native's own package entry point is Flow-
// typed and vitest's Node/esbuild transform chokes on it the moment
// anything pulls in the real package rather than the test stub
// (vitest.config.ts's alias only catches bare `from 'react-native'`
// imports, not what expo-router/@tabler/icons-react-native/
// react-native-safe-area-context reach for transitively) — the same reason
// this codebase has no other `.tsx` component tests (see
// src/theme/provider.tsx's header).
//
// Drawer order, derived not invented (`docs/mobile-prototypes/sessions.html`
// "Drawer order" note, decided 2026-09-12): the desktop's own nav strip in
// its order (Capabilities, Messaging, Artifacts, Scheduled jobs —
// `sidebar.nav` in the vendored en.ts) → the ported overlay screens in
// `DESKTOP-SCREENS.md` §A order (Profiles, Agents, Webhooks, Command
// center) → Projects (mobile-only: the desktop keeps projects inside its
// session tree, not the nav) → Settings last. Bots/Sessions/Tasks are the
// M14 tab row (inside the session list screen itself), prepended to this
// drawer by M15 A — the drawer-order test asserts from Capabilities down,
// agnostic to whatever precedes it.
import { DRAWER_ON_DESKTOP_VALUE } from '../lib/strings.mobile'
import { t } from '../lib/t'

export interface DrawerRowMeta {
  // A plain string, not expo-router's `Href`: `Href` is a big union that
  // also admits object route descriptors, which TypeScript then refuses to
  // use as a `Record` index (AppDrawer.tsx's icon lookup) — `Href` accepts
  // any string that's ALSO a valid route, so `router.push` still typechecks
  // at the one place these strings are actually navigated with.
  route: string
  title: string
  // Told up front that a screen is inert, not after the tap — mirrors
  // settings-rows.ts's HOST_MANAGED_INDEX_VALUE, but a single shared string
  // here (2026-09-12 review: "the user doesn't care whether the cause is
  // host-managed config or an unported endpoint"). Absent for every real
  // screen's row.
  value?: string
}

export const DRAWER_ROW_META: readonly DrawerRowMeta[] = [
  { route: '/(main)/session-list', title: t.commandCenter.sections.sessions },
  { route: '/(main)/settings/skills', title: t.sidebar.nav.skills },
  { route: '/(main)/channels', title: t.sidebar.nav.messaging },
  { route: '/(main)/artifacts', title: t.sidebar.nav.artifacts },
  { route: '/(main)/cron', title: t.sidebar.nav.cron },
  { route: '/(main)/settings/profiles', title: t.profiles.title },
  { route: '/(main)/agents', title: t.shell.statusbar.agents, value: DRAWER_ON_DESKTOP_VALUE },
  { route: '/(main)/webhooks', title: t.shell.statusbar.webhooks },
  { route: '/(main)/command-center', title: t.commandCenter.commandCenter, value: DRAWER_ON_DESKTOP_VALUE },
  { route: '/(main)/projects', title: t.commandCenter.projects },
  { route: '/(main)/settings', title: t.commandCenter.settings }
]
