// D22.3: the unaffiliated notice must appear on the About screen and the
// connect screen footer. Asserted as a source-scan (imports + reference),
// not a render, for the same reason labels.test.ts is a source-scan — this
// codebase has no .tsx component tests (see drawer-rows.ts's header).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { UNAFFILIATED_NOTICE } from './app-identity'

const REPO_ROOT = join(__dirname, '..', '..')

describe('unaffiliated notice', () => {
  it('is a real, non-empty sentence naming Hermes Agent and Nous Research', () => {
    expect(UNAFFILIATED_NOTICE.length).toBeGreaterThan(20)
    expect(UNAFFILIATED_NOTICE).toContain('Hermes Agent')
    expect(UNAFFILIATED_NOTICE).toContain('Nous Research')
  })

  it('is imported and referenced on the About screen', () => {
    const source = readFileSync(join(REPO_ROOT, 'app/(main)/settings/about.tsx'), 'utf-8')

    expect(source).toContain('UNAFFILIATED_NOTICE')
    expect(source).toMatch(/from\s+['"].*app-identity['"]/)
  })

  it('is imported and referenced on the connect screen', () => {
    const source = readFileSync(join(REPO_ROOT, 'app/connect/index.tsx'), 'utf-8')

    expect(source).toContain('UNAFFILIATED_NOTICE')
    expect(source).toMatch(/from\s+['"].*app-identity['"]/)
  })
})
