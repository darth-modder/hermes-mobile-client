// Tests settings-rows.ts (the pure group/route/title data), not
// app/(main)/settings/index.tsx itself — see settings-rows.ts's header for
// why importing the screen doesn't work under vitest here.
import { describe, expect, it } from 'vitest'

import { t } from '../lib/t'

import { SETTINGS_GROUPS } from './settings-rows'

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

  it('has Chat, Safety, Memory and Billing rows and no row yet for the two remaining M14 sections', () => {
    const titles = SETTINGS_GROUPS.flatMap(group => group.rows.map(row => row.title))

    expect(titles).toContain(t.settings.sections.chat)
    expect(titles).toContain(t.settings.sections.safety)
    expect(titles).toContain(t.settings.sections.memory)
    expect(titles).toContain(t.settings.nav.billing)
    expect(titles).not.toContain(t.settings.nav.archivedChats)
    expect(titles).not.toContain(t.settings.nav.about)
  })
})
