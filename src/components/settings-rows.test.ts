// Tests settings-rows.ts (the pure group/route/title data), not
// app/(main)/settings/index.tsx itself — see settings-rows.ts's header for
// why importing the screen doesn't work under vitest here.
import { describe, expect, it } from 'vitest'

import { t } from '../lib/t'

import { SETTINGS_GROUPS, settingsGroupsForAudience } from './settings-rows'

describe('settings index rows', () => {
  it('has no empty group and no duplicate route', () => {
    const routes = SETTINGS_GROUPS.flatMap(group => group.rows.map(row => row.route))

    for (const group of SETTINGS_GROUPS) {
      expect(group.rows.length).toBeGreaterThan(0)
    }

    expect(new Set(routes).size).toBe(routes.length)
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

    for (const group of SETTINGS_GROUPS) {
      for (const row of group.rows) {
        expect(allStrings.has(row.title), `"${row.title}" is not a value from the vendored en.ts`).toBe(true)
      }
    }
  })

  it('has a row for all six M14 settings sections (Toolsets excepted — its own future screen)', () => {
    const titles = SETTINGS_GROUPS.flatMap(group => group.rows.map(row => row.title))

    expect(titles).toContain(t.settings.sections.chat)
    expect(titles).toContain(t.settings.sections.safety)
    expect(titles).toContain(t.settings.sections.memory)
    expect(titles).toContain(t.settings.nav.billing)
    expect(titles).toContain(t.settings.nav.archivedChats)
    expect(titles).toContain(t.settings.nav.about)
  })
})

// D18: four of the six inert screens are settings rows (Chat, Safety,
// Memory & Context, Billing). One test per flavour, per the decision's own
// "a test per flavour for each file" instruction.
describe('settings rows by audience (D18)', () => {
  const allTitles = (groups: readonly (typeof SETTINGS_GROUPS)[number][]) =>
    groups.flatMap(group => group.rows.map(row => row.title))

  it('internal keeps every row, including the four host-managed ones', () => {
    const titles = allTitles(settingsGroupsForAudience('internal'))

    expect(titles).toEqual(allTitles(SETTINGS_GROUPS))
    expect(titles).toContain(t.settings.sections.chat)
    expect(titles).toContain(t.settings.sections.safety)
    expect(titles).toContain(t.settings.sections.memory)
    expect(titles).toContain(t.settings.nav.billing)
  })

  it('public drops Chat, Safety, Memory & Context and Billing, keeps every other row, and no empty group', () => {
    const groups = settingsGroupsForAudience('public')
    const titles = allTitles(groups)

    expect(titles).not.toContain(t.settings.sections.chat)
    expect(titles).not.toContain(t.settings.sections.safety)
    expect(titles).not.toContain(t.settings.sections.memory)
    expect(titles).not.toContain(t.settings.nav.billing)
    expect(titles.length).toBe(allTitles(SETTINGS_GROUPS).length - 4)

    for (const group of groups) {
      expect(group.rows.length).toBeGreaterThan(0)
    }
  })
})
