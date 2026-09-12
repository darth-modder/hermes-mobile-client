// M14 exit criterion (line 141-142 of M14-screen-layouts.md): "Labels: ...
// asserts every visible string is a value from the vendored en.ts or a
// formatted data value; a retyped label fails." Implemented as a static
// source-scan, not a render, for the same reason route-replicates.test.ts
// is a source-scan: this codebase has no .tsx component tests (react-native
// transitively pulled in via expo-router/@tabler/icons-react-native/
// @shopify/flash-list breaks vitest's transform — see drawer-rows.ts's
// header). Recorded as Deviation 6 in M14-screen-layouts.md.
//
// Was settings-labels.test.ts, scoped to app/(main)/settings/** only
// (2026-09-12). Widened to every route file under app/ (excluding app/dev/,
// same exclusions as route-replicates.test.ts) per the same day's follow-up
// review: "a passing test scoped to settings with a dozen screens held by
// hand is the weakest link in this milestone." Ratcheted exactly like
// route-replicates.test.ts's own PENDING: a file not yet swept goes in
// PENDING, and comes out the same commit that cleans up its screen. A
// genuinely mobile-only string (no desktop counterpart) belongs in
// src/lib/strings.mobile.ts, the one module this test whitelists —
// importing a value from there makes it an identifier reference, not a
// literal, so it naturally stops tripping the scan below.
//
// Scope note: this walks app/ (route files) only, matching the exit
// criterion's own "each ported screen" wording. src/components/AppDrawer.tsx
// is not a route file and isn't scanned here — its row TITLES are covered
// separately by drawer-rows.test.ts (which checks the pure DRAWER_ROW_META
// data AppDrawer.tsx renders), but any other literal inside AppDrawer.tsx
// itself (its "Hermes" heading, for instance) is outside both tests.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { t } from './t'

const REPO_ROOT = join(__dirname, '..', '..')
const APP_ROOT = join(REPO_ROOT, 'app')

// Same exclusions as route-replicates.test.ts: `_layout.tsx` is never a
// screen by itself, and these two are pure `<Redirect>` shims with no
// rendered UI of their own.
const NOT_A_SCREEN = new Set(['index.tsx', 'session/[id].tsx'])

// Not yet swept for labels — remove an entry the same commit that cleans up
// its screen. The other nine files this test originally seeded (agents,
// artifacts, channels, command-center, cron, projects, session-list,
// sessions/[id] (chat), webhooks) turned out to already comply or needed
// only small fixes, cleared the same day this file was widened. `connect/*`
// is deliberately left here even though it's mid-sweep elsewhere (a
// separate, concurrently-running task): pulling it out from under that work
// would race a file another pass owns right now.
const PENDING = new Set<string>([])

// A literal that "looks like" a bare identifier/path/style value rather
// than user-facing prose: module specifiers ('react-native',
// '@nanostores/react'), route paths ('/(main)/settings/plugins'),
// StyleSheet/accessibility enum values ('bottom', 'flex-start', 'radio').
// All-lowercase (or lowercase-leading with only word-separator punctuation)
// and never a real vendored label in practice — genuine prose in this
// codebase is always capitalized or multi-word with mixed case.
const LOOKS_TECHNICAL = /^[./]|^[a-z0-9@][a-z0-9\-_/.:]*$/

// Parsed with the real TypeScript AST, not a regex scan: JSX text content
// can contain a raw apostrophe ("a plugin's own web UI") that isn't a
// string-literal delimiter at all, which a character-by-character scanner
// has no principled way to tell apart from a real quote — the parser
// already knows the grammar, so it can't confuse the two. `typescript` is a
// pure syntax parser (no react-native import), so it's safe under vitest
// the same way ts-morph/babel would be, just already a dependency here.
function extractLiteralCandidates(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const values: string[] = []

  function visit(node: ts.Node): void {
    if (ts.isStringLiteral(node)) {
      // A string literal TYPE ('a' in `Record<Foo['a'], ...>` or a union
      // like `'a' | 'b'`) is never rendered — it's a type-checker-only
      // discriminant, not user-facing text.
      if (!ts.isLiteralTypeNode(node.parent)) {
        values.push(node.text.trim())
      }
    } else if (ts.isJsxText(node)) {
      // JSX text nodes span whitespace-only runs between tags too (e.g. the
      // newline+indentation between sibling elements) — only real prose is
      // a candidate.
      const text = node.text.replace(/\s+/g, ' ').trim()

      if (text.length > 0) {
        values.push(text)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  return values.filter(value => value.length >= 3 && /[A-Za-z]/.test(value) && !LOOKS_TECHNICAL.test(value))
}

function flattenStrings(value: unknown, out: Set<string>): void {
  if (typeof value === 'string') {
    out.add(value)
  } else if (typeof value === 'object' && value !== null) {
    for (const nested of Object.values(value)) {
      flattenStrings(nested, out)
    }
  }
}

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

describe('every ported screen uses only vendored or whitelisted labels', () => {
  const routeFiles = listRouteFiles(APP_ROOT)
  const vendoredStrings = new Set<string>()

  flattenStrings(t, vendoredStrings)

  it('found at least one route file to check (the walk itself works)', () => {
    expect(routeFiles.length).toBeGreaterThan(0)
  })

  it('PENDING names only route files that actually exist', () => {
    const relFiles = new Set(routeFiles.map(file => relative(APP_ROOT, file).split('\\').join('/')))

    for (const rel of PENDING) {
      expect(relFiles.has(rel), `PENDING lists "${rel}", which listRouteFiles didn't find`).toBe(true)
    }
  })

  it.each(
    routeFiles
      .map(file => [relative(APP_ROOT, file).split('\\').join('/'), file] as const)
      .filter(([rel]) => !PENDING.has(rel))
  )('%s has no retyped label', (_rel, file) => {
    const source = readFileSync(file, 'utf8')
    const offenders = extractLiteralCandidates(source, file).filter(literal => !vendoredStrings.has(literal))

    expect(
      offenders,
      `Found ${offenders.length} literal(s) not in the vendored en.ts or src/lib/strings.mobile.ts: ${JSON.stringify(offenders)}`
    ).toEqual([])
  })
})
