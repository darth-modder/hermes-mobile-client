// M14 exit criterion: "Drawer order: a test asserts the drawer's rows equal
// the desktop's sidebar nav order from DESKTOP-SCREENS.md §A with the Bots
// and machine-bound rows removed." Unblocked by the 2026-09-12 decision
// (docs/mobile-prototypes/sessions.html's "Drawer order" note): the order is
// derived from the desktop's nav strip (`sidebar.nav` in the vendored
// en.ts) followed by DESKTOP-SCREENS §A's ported overlay screens, then the
// two mobile-only additions (Projects, Settings last).
//
// M15 round 2: Bots now leads for real (`/(main)/bots` exists), Sessions is
// second (unchanged route), and the existing `/(main)/cron` row moved up to
// third, still titled "Scheduled jobs" — M15 C's Tasks-tab rebuild hasn't
// landed, so this is not yet renamed "Tasks" (drawer-rows.ts's own header;
// M15 Deviations). The "prepended by M15 A, not a row yet" framing this
// test used in M14 is retired: Bots is a row now, and the assertion below
// checks it explicitly instead of asserting its absence.
//
// Tests drawer-rows.ts (the pure order/route/title data), not AppDrawer.tsx
// itself — see drawer-rows.ts's header for why importing the .tsx component
// doesn't work under vitest here.
import { describe, expect, it } from 'vitest'

import { BOTS_TAB_LABEL } from '../lib/strings.mobile'
import { t } from '../lib/t'

import { DRAWER_ROW_META } from './drawer-rows'

describe('drawer order', () => {
  it('leads with Bots, then Sessions, then Scheduled jobs (M15 round 2)', () => {
    const leadingTitles = DRAWER_ROW_META.slice(0, 3).map(row => row.title)

    expect(leadingTitles).toEqual([BOTS_TAB_LABEL, t.commandCenter.sections.sessions, t.sidebar.nav.cron])
  })

  it('matches the desktop nav strip, then §A overlay screens, then Projects, then Settings', () => {
    const titlesFromCapabilities = DRAWER_ROW_META.map(row => row.title).slice(
      DRAWER_ROW_META.findIndex(row => row.title === t.sidebar.nav.skills)
    )

    expect(titlesFromCapabilities).toEqual([
      t.sidebar.nav.skills,
      t.sidebar.nav.messaging,
      t.sidebar.nav.artifacts,
      t.profiles.title,
      t.shell.statusbar.agents,
      t.shell.statusbar.webhooks,
      t.commandCenter.commandCenter,
      t.commandCenter.projects,
      t.commandCenter.settings
    ])
  })

  it('has no row for Tasks (M15 C has not rebuilt the cron screen as Tasks yet)', () => {
    const titles = DRAWER_ROW_META.map(row => row.title)

    expect(titles).not.toContain('Tasks')
  })

  it('every row title comes from the vendored en.ts or the documented BOTS_TAB_LABEL exception', () => {
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
    allStrings.add(BOTS_TAB_LABEL)

    for (const row of DRAWER_ROW_META) {
      expect(allStrings.has(row.title), `"${row.title}" is not a value from the vendored en.ts`).toBe(true)
    }
  })
})
