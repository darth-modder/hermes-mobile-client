// M14 exit criterion: "Every route file under app/ (excluding app/dev/) has
// a Replicates: comment naming a prototype page; a unit test enumerates the
// route files and fails on a missing one." Walks the real app/ directory
// (this test runs under Node — vitest.config.ts's environment — so plain
// fs/path work), so a new route file is caught the next time this test runs
// without needing its own entry added anywhere.
//
// Was ratcheted like M13's hex-colour rule (`f20efaf`) while the M14 screen
// sweep landed one screen per commit, via a PENDING punch-list Set and a
// test asserting PENDING stayed accurate. The sweep finished (M14 task list
// complete as of `e64fb2c`) and PENDING reached empty — dropped here per
// this file's own prior instruction ("once PENDING is empty, drop it... the
// loop then hard-fails on literally everything, which is the criterion as
// written"). This criterion is now closed, not open-with-ratchet: every
// route file is checked unconditionally, no exemption list left to shrink.
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

  it('found at least one route file to check (the walk itself works)', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  it.each(routeFiles.map(file => [relative(APP_ROOT, file).split('\\').join('/'), file] as const))(
    '%s names its prototype page',
    (_label, file) => {
      const content = readFileSync(file, 'utf8')

      expect(content).toMatch(/Replicates:/)
    }
  )
})
