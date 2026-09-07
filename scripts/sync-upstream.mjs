#!/usr/bin/env node
/**
 * Vendors a fixed allow-list of files from the hermes-agent monorepo into
 * src/upstream/, rewriting `@/...` imports to relative paths and applying a
 * small set of programmatic patches (each asserted against the original text
 * so an upstream shape change fails loudly instead of silently drifting).
 *
 * Usage: node scripts/sync-upstream.mjs
 * Env:   HERMES_AGENT_ROOT (default ../hermes-agent, relative to repo root)
 *
 * Idempotent: running this twice in a row against an unchanged upstream
 * checkout must produce no git diff. UPSTREAM.json's `syncedAt` is therefore
 * the upstream COMMIT's date, not wall-clock time.
 */

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const UPSTREAM_ROOT = path.resolve(REPO_ROOT, process.env.HERMES_AGENT_ROOT || '../hermes-agent')
const DEST_ROOT = path.join(REPO_ROOT, 'src', 'upstream')
const STAGING_PREFIX = 'tmp-upstream-sync-'

/**
 * Every file this project borrows from hermes-agent. `dest` is relative to
 * src/upstream/. Add a file here (never hand-edit inside src/upstream/) when
 * another vendored file needs it.
 */
const ALLOW_LIST = [
  { dest: 'shared/json-rpc-gateway.ts', src: 'apps/shared/src/json-rpc-gateway.ts' },
  { dest: 'shared/websocket-url.ts', src: 'apps/shared/src/websocket-url.ts' },
  { dest: 'shared/skin.ts', src: 'apps/shared/src/skin.ts' },
  { dest: 'shared/backend-scope.ts', src: 'apps/shared/src/backend-scope.ts' },
  { dest: 'shared/cron-trigger-controller.ts', src: 'apps/shared/src/cron-trigger-controller.ts' },
  // Not in the original M02 allow-list: chat-messages/hydration.ts imports
  // `skillInvocationText` from the `@hermes/shared` workspace package. This
  // one function is pure/dependency-free, so it's vendored whole rather than
  // hand-rolled — see the patch on hydration.ts below, which points its
  // import at this file instead of the (unvendored) `@hermes/shared` package.
  { dest: 'shared/skill-scaffold.ts', src: 'apps/shared/src/skill-scaffold.ts' },
  { dest: 'shared/json-rpc-gateway-replay.test.ts', src: 'apps/shared/src/json-rpc-gateway-replay.test.ts' },
  { dest: 'types/hermes.ts', src: 'apps/desktop/src/types/hermes.ts' },
  // Not in the original M02 allow-list: M05 needs the barrel other files
  // import from upstream as `@/lib/chat-messages` rather than reaching into
  // each submodule directly. Pure re-exports, no @/ imports of its own.
  { dest: 'lib/chat-messages/index.ts', src: 'apps/desktop/src/lib/chat-messages/index.ts' },
  { dest: 'lib/chat-messages/types.ts', src: 'apps/desktop/src/lib/chat-messages/types.ts' },
  { dest: 'lib/chat-messages/parts.ts', src: 'apps/desktop/src/lib/chat-messages/parts.ts' },
  { dest: 'lib/chat-messages/tool-parts.ts', src: 'apps/desktop/src/lib/chat-messages/tool-parts.ts' },
  { dest: 'lib/chat-messages/reconciliation.ts', src: 'apps/desktop/src/lib/chat-messages/reconciliation.ts' },
  { dest: 'lib/chat-messages/hydration.ts', src: 'apps/desktop/src/lib/chat-messages/hydration.ts' },
  { dest: 'lib/gateway-events.ts', src: 'apps/desktop/src/lib/gateway-events.ts' },
  { dest: 'lib/reconnect-backoff.ts', src: 'apps/desktop/src/lib/reconnect-backoff.ts' },
  { dest: 'lib/with-timeout.ts', src: 'apps/desktop/src/lib/with-timeout.ts' },
  { dest: 'lib/keyed-timeouts.ts', src: 'apps/desktop/src/lib/keyed-timeouts.ts' },
  { dest: 'lib/text.ts', src: 'apps/desktop/src/lib/text.ts' },
  { dest: 'lib/todos.ts', src: 'apps/desktop/src/lib/todos.ts' },
  { dest: 'lib/error-surface.ts', src: 'apps/desktop/src/lib/error-surface.ts' },
  { dest: 'lib/embedded-images.ts', src: 'apps/desktop/src/lib/embedded-images.ts' },
  { dest: 'lib/generated-images.ts', src: 'apps/desktop/src/lib/generated-images.ts' }
]

function fail(message) {
  console.error(`sync-upstream: ${message}`)
  process.exit(1)
}

/** Replace every occurrence of `find` (must occur exactly `count` times) with `replace`. */
function patch(content, { count = 1, description, file, find, replace }) {
  const occurrences = content.split(find).length - 1

  if (occurrences !== count) {
    fail(
      `patch target ${occurrences === 0 ? 'not found' : `found ${occurrences}x, expected ${count}x`} in ${file}: ${description}\n` +
        `--- expected to find ---\n${find}\n--- end ---`
    )
  }

  return content.split(find).join(replace)
}

/**
 * Per-destination-path patches, applied before the generic `@/` alias
 * rewrite below. Each entry replaces an import (or, for json-rpc-gateway.ts,
 * adds replay-truncation handling) that would otherwise pull in a package or
 * browser global this project doesn't vendor.
 */
const PATCHES = {
  'lib/chat-messages/hydration.ts': [
    {
      description: "skillInvocationText import from the '@hermes/shared' workspace package -> vendored copy",
      find: "import { skillInvocationText } from '@hermes/shared'",
      replace: "import { skillInvocationText } from '../../shared/skill-scaffold'"
    }
  ],
  'lib/chat-messages/parts.ts': [
    {
      description: "media helpers import from '@/lib/media' -> the app's own src/lib/media.ts (not vendored)",
      find: "import { mediaDisplayLabel, mediaMarkdownHref } from '@/lib/media'",
      replace: "import { mediaDisplayLabel, mediaMarkdownHref } from '../../../lib/media'"
    }
  ],
  'lib/chat-messages/types.ts': [
    {
      description:
        'type-only @assistant-ui/react import + @hermes/shared BillingBlock import -> local structural types',
      find: "import type { ThreadMessageLike } from '@assistant-ui/react'\nimport { type BillingBlock } from '@hermes/shared'",
      replace: [
        '/**',
        " * Local structural stand-in for assistant-ui/react's ThreadMessageLike. This client",
        " * doesn't use assistant-ui's runtime, only the message-part shape this",
        ' * reducer was written against — narrowed to the part kinds it actually',
        ' * branches on (text, reasoning, tool-call). assistant-ui’s other part kinds',
        ' * (image, file, source, data, generative-ui, audio) are never constructed or',
        ' * matched anywhere in this file or tool-parts.ts.',
        ' */',
        'type ThreadMessageLike = {',
        '  readonly content: readonly (',
        "    | { readonly type: 'text'; readonly text: string }",
        "    | { readonly type: 'reasoning'; readonly text: string }",
        '    | {',
        "        readonly type: 'tool-call'",
        '        readonly toolCallId?: string',
        '        readonly toolName: string',
        '        readonly args?: Record<string, unknown>',
        '        readonly argsText?: string',
        '        readonly result?: unknown',
        '        readonly isError?: boolean',
        '      }',
        '  )[]',
        '}',
        '',
        "/** Local stand-in for @hermes/shared's BillingBlock (mirrors apps/shared/src/billing-types.ts upstream). */",
        'interface BillingBlock {',
        '  provider: string',
        '  provider_label: string',
        '  model: string',
        '  billing_url: string | null',
        '  is_nous: boolean',
        '  message: string',
        '}'
      ].join('\n')
    }
  ],
  'lib/gateway-events.ts': [
    {
      description: "StatusbarMenuItem type import from '@/app/shell/statusbar-controls' -> inline local type",
      find: "import type { StatusbarMenuItem } from '@/app/shell/statusbar-controls'",
      replace: [
        "/** Local stand-in for the desktop's StatusbarMenuItem — only the fields this module constructs. */",
        'interface StatusbarMenuItem {',
        '  className?: string',
        '  disabled?: boolean',
        '  id: string',
        '  label: string',
        '}'
      ].join('\n')
    }
  ],
  'shared/json-rpc-gateway.ts': [
    {
      count: 2,
      description: "DOMException isn't available on every JS engine (Hermes) -> a plain Error named 'AbortError'",
      find: "new DOMException('Aborted', 'AbortError')",
      replace: "Object.assign(new Error('Aborted'), { name: 'AbortError' })"
    },
    {
      description: 'declare the synthetic replay.truncated event type in the GatewayEventName union',
      find: "  | 'error'\n  | 'skin.changed'\n  | (string & {})",
      replace: "  | 'error'\n  | 'skin.changed'\n  | 'replay.truncated'\n  | (string & {})"
    },
    {
      description: 'track which session_id each in-flight session.events.since call belongs to',
      find:
        '      for (const result of results) {\n' +
        "        if (result.status !== 'fulfilled' || !Array.isArray(result.value?.events)) {\n" +
        '          continue\n' +
        '        }',
      replace:
        '      for (const [replayIndex, result] of results.entries()) {\n' +
        "        if (result.status !== 'fulfilled' || !Array.isArray(result.value?.events)) {\n" +
        '          continue\n' +
        '        }\n' +
        '\n' +
        '        const [replaySid] = entries[replayIndex]'
    },
    {
      description: 'emit a synthetic replay.truncated event when session.events.since reports truncated: true',
      find:
        '        for (const event of result.value.events) {\n' +
        '          if (!event?.type) {\n' +
        '            continue\n' +
        '          }\n' +
        '\n' +
        '          this.dispatchIfNewer(event as GatewayEvent)\n' +
        '        }\n' +
        '      }',
      replace:
        '        for (const event of result.value.events) {\n' +
        '          if (!event?.type) {\n' +
        '            continue\n' +
        '          }\n' +
        '\n' +
        '          this.dispatchIfNewer(event as GatewayEvent)\n' +
        '        }\n' +
        '\n' +
        '        if ((result.value as { truncated?: unknown }).truncated === true) {\n' +
        '          const latestSeq = (result.value as { latest_seq?: unknown }).latest_seq\n' +
        '\n' +
        '          this.dispatchEvent({\n' +
        "            type: 'replay.truncated',\n" +
        '            session_id: replaySid,\n' +
        "            payload: { session_id: replaySid, latest_seq: typeof latestSeq === 'number' ? latestSeq : undefined }\n" +
        '          })\n' +
        '        }\n' +
        '      }'
    }
  ],
  'shared/websocket-url.ts': [
    {
      description:
        'never read window.location — React Native defines a global `window` without `.location`, and vendored code must not touch browser globals at all; callers in this project always pass explicit host/protocol',
      find:
        'function readWindowLocation(): { host: string; protocol: string } {\n' +
        "  if (typeof window === 'undefined') {\n" +
        "    return { host: '', protocol: 'http:' }\n" +
        '  }\n' +
        '\n' +
        '  return { host: window.location.host, protocol: window.location.protocol }\n' +
        '}',
      replace:
        'function readWindowLocation(): { host: string; protocol: string } {\n' +
        '  // Never touch `window` here (React Native defines a global `window` without\n' +
        '  // `.location`, and vendored code must not touch browser globals at all).\n' +
        '  // Callers in this project always pass explicit host/protocol.\n' +
        "  return { host: '', protocol: 'http:' }\n" +
        '}'
    }
  ]
}

/** Rewrite `from '@/foo/bar'` to a relative import pointing at src/upstream/foo/bar. */
function rewriteAtAliasImports(content, destAbsPath) {
  return content.replace(/from '@\/([^']+)'/g, (match, sub) => {
    const targetAbs = path.join(DEST_ROOT, sub)
    let rel = path.relative(path.dirname(destAbsPath), targetAbs).split(path.sep).join('/')

    if (!rel.startsWith('.')) {
      rel = `./${rel}`
    }

    return `from '${rel}'`
  })
}

function assertNoRemainingAliasOrWorkspaceImports(content, file) {
  const badImport = content.match(/from '(@\/[^']+|@hermes\/[^']+|@assistant-ui\/[^']+)'/)

  if (badImport) {
    fail(`${file}: unresolved import ${badImport[1]} survived patching — add a patch or extend the allow-list`)
  }
}

/**
 * Refuses to run if the upstream checkout has uncommitted changes under any
 * allow-listed path — someone else may be mid-edit on a file we vendor, and
 * we only ever read from the committed git object, never the working tree.
 */
function assertUpstreamAllowListedPathsClean() {
  const statusOut = execFileSync('git', ['-C', UPSTREAM_ROOT, 'status', '--short'], { encoding: 'utf8' })
  const allowSet = new Set(ALLOW_LIST.map(({ src }) => src))
  const offending = statusOut
    .split('\n')
    .filter(Boolean)
    .map(line => line.slice(3).trim())
    .filter(changedPath => changedPath.split(' -> ').some(part => allowSet.has(part)))

  if (offending.length > 0) {
    fail(
      `${UPSTREAM_ROOT} has uncommitted changes under allow-listed paths — commit or stash them there first:\n` +
        offending.join('\n')
    )
  }
}

/** Reads an allow-listed file from the upstream git object at `commit`, never from the working tree. */
function readUpstreamFile(commit, src) {
  try {
    return execFileSync('git', ['-C', UPSTREAM_ROOT, 'show', `${commit}:${src}`], { encoding: 'utf8' })
  } catch {
    fail(`missing upstream file at ${commit}:${src} for allow-list entry: ${src}`)
  }
}

/**
 * Builds the fully patched, alias-rewritten content for every allow-listed
 * file, entirely in memory. Every patch/import assertion (and therefore every
 * possible failure) happens here, before anything touches disk — so a failure
 * can never leave a half-written src/upstream/ behind.
 */
function buildContents(commit) {
  const contents = new Map()

  for (const { dest, src } of ALLOW_LIST) {
    let content = readUpstreamFile(commit, src)

    for (const p of PATCHES[dest] ?? []) {
      content = patch(content, { ...p, file: dest })
    }

    const destAbs = path.join(DEST_ROOT, dest)

    content = rewriteAtAliasImports(content, destAbs)
    assertNoRemainingAliasOrWorkspaceImports(content, dest)
    contents.set(dest, content)
  }

  return contents
}

/** Removes any staging directory left behind by a prior run that crashed mid-swap. */
function cleanStaleStaging() {
  for (const entry of readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (entry.isDirectory() && entry.name.startsWith(STAGING_PREFIX)) {
      rmSync(path.join(REPO_ROOT, entry.name), { force: true, recursive: true })
    }
  }
}

/** Every file under `root`, as POSIX-style paths relative to `root`. */
function listFilesRecursive(root) {
  const out = []

  const walk = dir => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        walk(abs)
      } else if (entry.isFile()) {
        out.push(path.relative(root, abs).split(path.sep).join('/'))
      }
    }
  }

  walk(root)

  return out
}

/** Removes now-empty directories under (and including) `root`, deepest first. */
function removeEmptyDirsRecursive(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    const abs = path.join(root, entry.name)

    removeEmptyDirsRecursive(abs)

    if (readdirSync(abs).length === 0) {
      rmSync(abs, { force: true, recursive: true })
    }
  }
}

/**
 * Copies every file from `srcRoot` into `destRoot` (overwriting in place,
 * creating `destRoot` if needed), then deletes anything under `destRoot`
 * with no counterpart in `srcRoot`. Never renames or removes `destRoot`
 * itself — see stageAndSwap's docstring for why that matters here.
 */
function syncDirectoryInPlace(srcRoot, destRoot) {
  const srcFiles = listFilesRecursive(srcRoot)

  for (const relPath of srcFiles) {
    const destAbs = path.join(destRoot, relPath)

    mkdirSync(path.dirname(destAbs), { recursive: true })
    copyFileSync(path.join(srcRoot, relPath), destAbs)
  }

  if (!existsSync(destRoot)) {
    return
  }

  const srcSet = new Set(srcFiles)

  for (const relPath of listFilesRecursive(destRoot)) {
    if (!srcSet.has(relPath)) {
      rmSync(path.join(destRoot, relPath), { force: true })
    }
  }

  removeEmptyDirsRecursive(destRoot)
}

/**
 * Writes every file to a fresh temp directory, lint-fixes and writes the
 * manifest there, and only touches src/upstream/ once all of that has
 * succeeded.
 *
 * The swap is an in-place per-file copy, never a directory rename or a
 * delete-then-recreate. Both of those were tried and both fail on this
 * machine: with Metro running (this project's normal dev state, not an edge
 * case — Metro watches the whole tree including src/upstream), Metro's file
 * watcher holds handles that block renaming *or* removing the src/upstream
 * directory entry itself, even though individual files inside it can still
 * be freely overwritten. Verified directly: with Metro running,
 * `renameSync('src/upstream', anything)` fails EPERM as the very FIRST step,
 * before anything is deleted or moved — so even a rename-current-dir-aside
 * swap can't get past that first rename. `writeFileSync` on a file already
 * inside src/upstream, by contrast, succeeds immediately. So this never
 * touches the directory's own identity: it overwrites each allow-listed
 * file's content in place and removes any file the new allow-list no longer
 * produces. Every failure mode that can throw for a *content* reason (a
 * patch assertion, a lint error, an unresolved import) already happened
 * earlier, entirely inside the isolated staging directory, before this
 * function is even called — this loop is pure file I/O with nothing left to
 * validate, so the only way it can leave src/upstream in a mixed old/new
 * state is a mid-loop crash (process killed, disk full), not a bad sync.
 */
function stageAndSwap(contents, commit) {
  const stagingRoot = mkdtempSync(path.join(REPO_ROOT, STAGING_PREFIX))

  try {
    for (const [dest, content] of contents) {
      const destAbs = path.join(stagingRoot, dest)

      mkdirSync(path.dirname(destAbs), { recursive: true })
      writeFileSync(destAbs, content)
    }

    lintFixDest(stagingRoot)
    writeManifest(stagingRoot, commit, [...contents.keys()])
  } catch (error) {
    rmSync(stagingRoot, { force: true, recursive: true })
    fail(`staging failed, src/upstream left untouched: ${error instanceof Error ? error.message : error}`)
  }

  try {
    syncDirectoryInPlace(stagingRoot, DEST_ROOT)
  } catch (error) {
    // Unlike the staging failures above, a throw here means the per-file
    // copy loop was interrupted partway — src/upstream may now hold a mix of
    // old and new file contents, not the untouched guarantee the staging
    // phase gives. Said plainly, not papered over: re-run the sync (safe —
    // it's idempotent) to finish the copy, or `git checkout src/upstream` to
    // revert to the last committed state.
    fail(
      `copying synced files into src/upstream failed partway through — it may now hold a mix of ` +
        `old and new files; re-run this script (safe, idempotent) or "git checkout src/upstream" ` +
        `to revert: ${error instanceof Error ? error.message : error}`
    )
  } finally {
    rmSync(stagingRoot, { force: true, recursive: true })
  }
}

/**
 * The rewritten import order rarely matches this project's perfectionist/sort-imports
 * rule (upstream groups imports differently, and alias rewriting changes each
 * import's depth). Auto-fixing here — deterministic for unchanged input, so it
 * doesn't break idempotency — keeps `src/upstream/**` lint-clean without a
 * bespoke reorder patch per file.
 */
function lintFixDest(targetRoot) {
  const eslintBin = path.join(REPO_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js')
  const prettierBin = path.join(REPO_ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs')

  execFileSync(process.execPath, [eslintBin, '--fix', targetRoot], { cwd: REPO_ROOT, stdio: 'inherit' })
  execFileSync(process.execPath, [prettierBin, '--write', targetRoot], { cwd: REPO_ROOT, stdio: 'inherit' })
}

function writeManifest(targetRoot, commit, files) {
  // The upstream COMMIT's date, not wall-clock time — keeps re-running this
  // script against an unchanged checkout byte-for-byte idempotent.
  const syncedAt = execFileSync('git', ['-C', UPSTREAM_ROOT, 'log', '-1', '--format=%cI', commit], {
    encoding: 'utf8'
  }).trim()
  let repo = 'hermes-agent'

  try {
    repo = execFileSync('git', ['-C', UPSTREAM_ROOT, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  } catch {
    // No 'origin' remote configured on this checkout; fall back to the default name.
  }

  const manifest = { commit, files: [...files].sort(), repo, syncedAt }

  writeFileSync(path.join(targetRoot, 'UPSTREAM.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

if (!existsSync(UPSTREAM_ROOT)) {
  fail(`HERMES_AGENT_ROOT not found: ${UPSTREAM_ROOT}`)
}

cleanStaleStaging()
assertUpstreamAllowListedPathsClean()

const commit = execFileSync('git', ['-C', UPSTREAM_ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
const contents = buildContents(commit)

stageAndSwap(contents, commit)
console.log(`sync-upstream: wrote ${contents.size} files to ${path.relative(REPO_ROOT, DEST_ROOT)}`)
