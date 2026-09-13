// M14 exit criterion: "Drawer order: a test asserts the drawer's rows equal
// the desktop's sidebar nav order from DESKTOP-SCREENS.md §A with the Bots
// and machine-bound rows removed." Unblocked by the 2026-09-12 decision
// (docs/mobile-prototypes/sessions.html's "Drawer order" note): the order is
// derived from the desktop's nav strip (`sidebar.nav` in the vendored
// en.ts) followed by DESKTOP-SCREENS §A's ported overlay screens, then the
// two mobile-only additions (Projects, Settings last). Bots/Sessions/Tasks
// are the M14 tab row, prepended to the drawer by M15 A — so this only
// asserts the list from Capabilities down, per that same decision.
//
// Tests drawer-rows.ts (the pure order/route/title data), not AppDrawer.tsx
// itself — see drawer-rows.ts's header for why importing the .tsx component
// doesn't work under vitest here.
import { describe, expect, it } from 'vitest'

import { t } from '../lib/t'

import { DRAWER_ROW_META } from './drawer-rows'

describe('drawer order', () => {
  it('matches the desktop nav strip, then §A overlay screens, then Projects, then Settings', () => {
    const titlesFromCapabilities = DRAWER_ROW_META.map(row => row.title).slice(
      DRAWER_ROW_META.findIndex(row => row.title === t.sidebar.nav.skills)
    )

    expect(titlesFromCapabilities).toEqual([
      t.sidebar.nav.skills,
      t.sidebar.nav.messaging,
      t.sidebar.nav.artifacts,
      t.sidebar.nav.cron,
      t.profiles.title,
      t.shell.statusbar.agents,
      t.shell.statusbar.webhooks,
      t.commandCenter.commandCenter,
      t.commandCenter.projects,
      t.commandCenter.settings
    ])
  })

  it('has no row for Bots or Tasks (M15 A prepends them)', () => {
    const titles = DRAWER_ROW_META.map(row => row.title)

    expect(titles).not.toContain('Bots')
    expect(titles).not.toContain('Tasks')
  })

  it('every row title comes from the vendored en.ts, not a retyped string', () => {
    const flatten = (value: unknown, out: Set<string>): void => {
      if (typeof value === 'string') {
        out.add(value)
      } else if (typeof value === 'object' && value !== null) {
        for (const nested of Object.values(value)) {
          flatten(nested, out)
        }
      }
    }

    const allStrings = new Set<string>()

    flatten(t, allStrings)

    for (const row of DRAWER_ROW_META) {
      expect(allStrings.has(row.title), `"${row.title}" is not a value from the vendored en.ts`).toBe(true)
    }
  })
})
