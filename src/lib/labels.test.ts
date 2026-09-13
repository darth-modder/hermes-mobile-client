// M14 exit criterion (line 141-142 of M14-screen-layouts.md): "Labels: ...
// asserts every visible string is a value from the vendored en.ts or a
// formatted data value; a retyped label fails." Implemented as a static
// source-scan, not a render, for the same reason route-replicates.test.ts
// is a source-scan: this codebase has no .tsx component tests (react-native
// transitively pulled in via expo-router/@tabler/icons-react-native/
// @shopify/flash-list breaks vitest's transform — see drawer-rows.ts's
// header). Recorded as Deviation 6 in M14-screen-layouts.md.
//
// Was settings-labels.test.ts (scoped to app/(main)/settings/** only), then
// widened to every route file under app/ (excluding app/dev/) with a
// PENDING ratchet while the sweep worked through the rest of the app. Every
// route file passed as of the M14 task-list's completion (`e64fb2c`) —
// PENDING dropped here per route-replicates.test.ts's own precedent ("once
// PENDING is empty, drop it... the loop then hard-fails on literally
// everything"). This criterion is now closed, not open-with-ratchet. A
// genuinely mobile-only string (no desktop counterpart) still belongs in
// src/lib/strings.mobile.ts, the one module this test whitelists —
// importing a value from there makes it an identifier reference, not a
// literal, so it naturally stops tripping the scan below.
//
// Scope note: originally walked app/ (route files) only, matching the exit
// criterion's own "each ported screen" wording — which is how Composer.tsx's
// retyped "Stop"/"Send"/"Steer"/placeholder labels went unnoticed (M14
// close-out round 2, task 4c): it's a component under src/chat/, not a route
// file. Widened to also walk every .tsx file under src/chat/ (screens'
// actual rendered content: Composer, Transcript, SessionHeader, the card/
// part components, etc.) and src/components/ (AppDrawer and the shared `ui/`
// primitives — both render user-visible text: AppDrawer's row labels/section
// heading, and e.g. Button/Sheet/Menu's own default copy where they have
// any). AppDrawer.tsx's row TITLES are still also covered separately by
// drawer-rows.test.ts (which checks the pure DRAWER_ROW_META data AppDrawer
// renders) — the two tests overlap there by design, not a gap.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import { t } from './t'

const REPO_ROOT = join(__dirname, '..', '..')
const APP_ROOT = join(REPO_ROOT, 'app')
const SRC_ROOT = join(REPO_ROOT, 'src')

// Same exclusions as route-replicates.test.ts: `_layout.tsx` is never a
// screen by itself, and these two are pure `<Redirect>` shims with no
// rendered UI of their own.
const NOT_A_SCREEN = new Set(['index.tsx', 'session/[id].tsx'])

// A literal that "looks like" a bare identifier/path/style value rather
// than user-facing prose: module specifiers ('react-native',
// '@nanostores/react'), route paths ('/(main)/settings/plugins'),
// StyleSheet/accessibility enum values ('bottom', 'flex-start', 'radio').
// All-lowercase (or lowercase-leading with only word-separator punctuation)
// and never a real vendored label in practice — genuine prose in this
// codebase is always capitalized or multi-word with mixed case.
const LOOKS_TECHNICAL = /^[./]|^[a-z0-9@][a-z0-9\-_/.:]*$/

// Two more technical shapes the widened src/chat + src/components scan
// (task 4c) surfaced that the pattern above doesn't cover, because both can
// start with an uppercase letter: an rgba()/rgb() color literal used as a
// style value (src/components/AppDrawer.tsx's scrim, ui/Sheet.tsx's
// backdrop), and an SVG path's `d` attribute data (src/components/
// ToolIcon.tsx's phosphor icon set, each a single long string of path-command
// letters and numbers). Neither is prose a user reads; both are data a
// StyleSheet or an <Path> consumes.
const LOOKS_LIKE_COLOR_VALUE = /^rgba?\([\d\s.,%]+\)$/i
const LOOKS_LIKE_SVG_PATH_DATA = /^[MLHVCSQTAZ][MLHVCSQTAZ0-9\s,.-]+$/i

// A string literal passed directly to `console.<method>(...)` — a debug tag
// like `'[approval-card-layout] card'` (ApprovalCard.tsx's __DEV__-only
// layout log, M14 close-out round 3, task 3) is developer-facing diagnostic
// output, never rendered to a user, so it can never be a "retyped label" by
// the exit criterion's own definition ("every VISIBLE string"). Checked by
// walking up from the literal rather than pattern-matching its text, the
// same principle as the literal-TYPE check below — this is about where the
// string lives in the syntax tree, not what it looks like.
function isConsoleCallArgument(node: ts.Node): boolean {
  const call = node.parent

  if (!call || !ts.isCallExpression(call)) {
    return false
  }

  const callee = call.expression

  return (
    ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'console'
  )
}

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
      // discriminant, not user-facing text. Same for a console.* call
      // argument — a debug tag, never shown to a user.
      if (!ts.isLiteralTypeNode(node.parent) && !isConsoleCallArgument(node)) {
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

  return values.filter(
    value =>
      value.length >= 3 &&
      /[A-Za-z]/.test(value) &&
      !LOOKS_TECHNICAL.test(value) &&
      !LOOKS_LIKE_COLOR_VALUE.test(value) &&
      !LOOKS_LIKE_SVG_PATH_DATA.test(value)
  )
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

// Generic recursive .tsx walker for the two non-route source trees. Unlike
// listRouteFiles there's no "not a screen by itself" concept here — every
// .tsx file under these roots is a component that can render text — but
// `.test.tsx` is excluded on the same principle as `_layout.tsx` above: it's
// not itself rendered UI. (Neither tree has any `.test.tsx` file today; the
// guard is defensive.)
function listTsxFiles(dir: string): string[] {
  const out: string[] = []

  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)

    if (statSync(abs).isDirectory()) {
      out.push(...listTsxFiles(abs))

      continue
    }

    if (!entry.endsWith('.tsx') || entry.endsWith('.test.tsx')) {
      continue
    }

    out.push(abs)
  }

  return out
}

describe('every ported screen or component uses only vendored or whitelisted labels', () => {
  const files = [
    ...listRouteFiles(APP_ROOT),
    ...listTsxFiles(join(SRC_ROOT, 'chat')),
    ...listTsxFiles(join(SRC_ROOT, 'components'))
  ]

  const vendoredStrings = new Set<string>()

  flattenStrings(t, vendoredStrings)

  it('found at least one file to check (the walk itself works)', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files.map(file => [relative(REPO_ROOT, file).split('\\').join('/'), file] as const))(
    '%s has no retyped label',
    (_rel, file) => {
      const source = readFileSync(file, 'utf8')
      const offenders = extractLiteralCandidates(source, file).filter(literal => !vendoredStrings.has(literal))

      expect(
        offenders,
        `Found ${offenders.length} literal(s) not in the vendored en.ts or src/lib/strings.mobile.ts: ${JSON.stringify(offenders)}`
      ).toEqual([])
    }
  )
})
