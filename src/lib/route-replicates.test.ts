// M14 exit criterion: "Every route file under app/ (excluding app/dev/) has
// a Replicates: comment naming a prototype page; a unit test enumerates the
// route files and fails on a missing one." Walks the real app/ directory
// (this test runs under Node — vitest.config.ts's environment — so plain
// fs/path work), so a new route file is caught the next time this test runs
// without needing its own entry added anywhere.
//
// Ratcheted like M13's hex-colour rule (`f20efaf`, "sweep complete — ratchet
// the hex-colour rule to error"): the M14 screen sweep lands one screen per
// commit, so this can't hard-fail on every not-yet-restyled screen without
// breaking "npm run check green before every handoff" for the whole sweep.
// PENDING is the sweep's own punch list — remove an entry the same commit
// that adds its screen's Replicates comment. Once PENDING is empty, drop it
// and the two tests that reference it; the loop below then hard-fails on
// literally everything, which is the criterion as written.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = join(__dirname, '..', '..')
const APP_ROOT = join(REPO_ROOT, 'app')

// Not screens, so nothing to name a prototype for: `_layout.tsx` is
// expo-router's own layout/config file, never a route by itself (the
// convention the framework itself draws the "not a screen" line at), and
// these two are pure `<Redirect>` shims with no rendered UI of their own —
// `app/index.tsx` sends you to session-list or connect, `app/session/
// [id].tsx` is the `hermes-android://session/<id>` deep-link target that
// forwards straight to `/(main)/sessions/[id]`, which itself does carry the
// comment. Listed explicitly, not sniffed, so a genuinely new screen can't
// slip through this exclusion by accident.
const NOT_A_SCREEN = new Set(['index.tsx', 'session/[id].tsx'])

// M14's screen sweep, not yet reached (task list order). Remove the line the
// same commit that restyles that screen and adds its comment.
const PENDING = new Set([
  '(main)/webhooks/index.tsx',
  '(main)/channels/index.tsx',
  '(main)/artifacts/index.tsx',
  '(main)/projects/index.tsx',
  '(main)/agents/index.tsx',
  '(main)/command-center/index.tsx',
  'connect/index.tsx',
  'connect/scan.tsx',
  'connect/[id]/login.tsx'
])

function listRouteFiles(dir: string): string[] {
  const out: string[] = []

  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)

    if (statSync(abs).isDirectory()) {
      out.push(...listRouteFiles(abs))

      continue
    }

    if (!entry.endsWith('.tsx') || entry === '_layout.tsx') {
      continue
    }

    const rel = relative(APP_ROOT, abs).split('\\').join('/')

    if (rel.startsWith('dev/') || NOT_A_SCREEN.has(rel)) {
      continue
    }

    out.push(abs)
  }

  return out
}

describe('every ported route has a Replicates: comment', () => {
  const routeFiles = listRouteFiles(APP_ROOT)
  const routesByRel = new Map(routeFiles.map(file => [relative(APP_ROOT, file).split('\\').join('/'), file]))

  it('found at least one route file to check (the walk itself works)', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  it('PENDING names only route files that actually exist and are not already done', () => {
    for (const rel of PENDING) {
      const file = routesByRel.get(rel)

      expect(file, `PENDING lists "${rel}", which listRouteFiles didn't find`).toBeDefined()
      expect(
        readFileSync(file as string, 'utf8'),
        `"${rel}" already has a Replicates: comment — remove it from PENDING`
      ).not.toMatch(/Replicates:/)
    }
  })

  it.each(
    routeFiles
      .map(file => relative(APP_ROOT, file).split('\\').join('/'))
      .filter(rel => !PENDING.has(rel))
      .map(rel => [rel, routesByRel.get(rel) as string] as const)
  )('%s names its prototype page', (_label, file) => {
    const content = readFileSync(file, 'utf8')

    expect(content).toMatch(/Replicates:/)
  })
})
