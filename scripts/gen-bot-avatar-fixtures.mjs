#!/usr/bin/env node
/**
 * Generates src/lib/__fixtures__/bot-avatar.json — the ground truth for
 * bot-avatar.test.ts's "our SVG string equals the desktop's for the same
 * seed" check (M15 A/"plus avatars").
 *
 * Imports `blobatar` the same way the desktop does: `apps/desktop/src/sdk/
 * index.ts:1750` re-exports `blobatarSvg` as `export { blobatar as
 * blobatarSvg } from 'blobatar/blob'` — i.e. `blobatarSvg` IS the npm
 * package's own `blobatar` function from its `/blob` submodule, called with
 * no desktop-specific wrapping. This script calls the exact same import raw,
 * so the fixture is independent of src/lib/bot-avatar.ts's own port of the
 * seed-resolution logic (avatar.tsx:172-190) — a bug in that port would show
 * up as a real mismatch against this fixture, not get baked into both sides.
 *
 * Deliberately excludes avatar.tsx:212's `<svg data-bot-face="...">`
 * attribute rewrite — that's the desktop's own PNG-backfill bookkeeping, not
 * part of the seeding contract this milestone's exit criterion is about.
 *
 * Usage: node scripts/gen-bot-avatar-fixtures.mjs
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { blobatar } from 'blobatar/blob'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dirname, '..', 'src', 'lib', '__fixtures__', 'bot-avatar.json')

// One fixed case per parseBlobShape branch (avatar.tsx:172-182): plain
// name-seeded, a locked seed, a locked seed + pinned silhouette, and a
// pinned silhouette with the seed still following the name.
const CASES = [
  { name: 'plain-name-seed', seed: 'researcher', opts: { size: 40 } },
  { name: 'another-plain-name-seed', seed: 'coder', opts: { size: 40 } },
  { name: 'locked-seed', seed: 'pinned-seed-value', opts: { size: 40 } },
  {
    name: 'locked-seed-plus-pinned-silhouette-sun',
    seed: 'pinned-seed-value',
    // BLOB_KIND_TRAIT.sun (avatar.tsx:155)
    opts: { size: 40, traits: { shape: 0.965 } }
  },
  {
    name: 'pinned-silhouette-triangle-seed-follows-name',
    seed: 'researcher',
    // BLOB_KIND_TRAIT.triangle (avatar.tsx:156)
    opts: { size: 40, traits: { shape: 0.99 } }
  },
  { name: 'default-size-96', seed: 'researcher', opts: { size: 96 } }
]

const fixtures = Object.fromEntries(
  CASES.map(c => [c.name, { seed: c.seed, opts: c.opts, svg: blobatar(c.seed, c.opts) }])
)

writeFileSync(OUT_PATH, JSON.stringify(fixtures, null, 2) + '\n')

console.log(`wrote ${Object.keys(fixtures).length} fixtures to ${OUT_PATH}`)
