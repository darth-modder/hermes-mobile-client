import { describe, expect, it } from 'vitest'

import { t } from './t'

describe('t', () => {
  it('is the vendored English translations object, not a path-string lookup', () => {
    expect(t.common.save).toBe('Save')
    expect(t.common.cancel).toBe('Cancel')
  })

  it("exposes the desktop's interpolated entries as callables", () => {
    expect(typeof t.settings.about.version).toBe('function')
    expect(t.settings.about.version('1.2.3')).toBe('Version 1.2.3')
  })
})
