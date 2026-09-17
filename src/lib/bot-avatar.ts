/**
 * Bot avatar seeding (M15 A/"plus avatars"): ported, not vendored, from the
 * desktop's `apps/desktop/src/plugins/hermes-bots/avatar.tsx` — that file
 * imports `@hermes/plugin-sdk` (`blobatarSvg`, `profileColor`) and other
 * Electron-plugin-host machinery, so it is not a pure file the sync script
 * could vendor even if `apps/desktop/src/plugins/**` were on its allow-list
 * (it isn't). The seeding math itself — `parseBlobShape`/`blobShapeString`/
 * `BLOB_KINDS`/`BLOB_KIND_TRAIT` (`avatar.tsx:120-157`) — has no such
 * dependency, so it's ported here verbatim with the exact line numbers cited
 * inline, and `blobatarSvg` itself turns out to BE the `blobatar` npm
 * package's own export, re-exported under that name
 * (`apps/desktop/src/sdk/index.ts:1750`:
 * `export { blobatar as blobatarSvg } from 'blobatar/blob'`) — so this
 * module imports the same package directly, pinned to the same
 * `2.0.0` the desktop's `apps/desktop/package.json:113` pins (MIT,
 * confirmed via `npm view blobatar@2.0.0 license`).
 *
 * `botAvatarSvg` below intentionally does NOT reproduce avatar.tsx:212's
 * `<svg data-bot-face="...">` attribute rewrite — that's the desktop's own
 * PNG-backfill bookkeeping (`pushLocalAvatars` → `rasterizeSvgToPng`), not
 * part of the seeding contract this milestone's exit criterion is about
 * ("the SVG string for a fixed seed equals the desktop's for the same
 * seed"). `scripts/gen-bot-avatar-fixtures.mjs` generates the comparison
 * fixtures from the RAW `blobatar(seed, opts)` call, matching what this
 * module also calls raw.
 */

import { blobatar, type BlobatarOptions } from 'blobatar/blob'

/** `avatar.tsx:128-139`. */
export const BLOB_KINDS = [
  'round',
  'organic',
  'boxy',
  'capsule',
  'nub',
  'cloud',
  'droplet',
  'hexagon',
  'sun',
  'triangle'
]

/** `avatar.tsx:146-157`. Trait positions at the center of each silhouette
 *  band; frozen per blobatar major. */
const BLOB_KIND_TRAIT: Record<string, number> = {
  boxy: 0.54,
  capsule: 0.65,
  cloud: 0.825,
  droplet: 0.8875,
  hexagon: 0.9325,
  nub: 0.745,
  organic: 0.35,
  round: 0.11,
  sun: 0.965,
  triangle: 0.99
}

/** `avatar.tsx:159-161`. */
export function isBlobShape(shape: null | string | undefined): boolean {
  return shape === 'blobatar' || (typeof shape === 'string' && shape.startsWith('blobatar:'))
}

export interface ParsedBlobShape {
  /** A BLOB_KINDS member when the silhouette is pinned, else empty. */
  kind: string
  /** The seed actually rendered — the pinned one, else the bot's name. */
  seed: string
  /** The pinned seed alone, empty when the face follows the name. */
  seedPart: string
}

/**
 * `avatar.tsx:172-182`. `shape` is the stored `ui_meta['hermes-bots'].shape`
 * string: bare `'blobatar'` (face follows the name), `'blobatar:<seed>'`
 * (seed locked), `'blobatar:<seed>:<kind>'` (seed + silhouette pinned), or
 * `'blobatar::<kind>'` (silhouette pinned, seed still follows the name).
 */
export function parseBlobShape(shape: null | string | undefined, name: string | undefined): ParsedBlobShape {
  const parts = typeof shape === 'string' ? shape.split(':') : []
  const seedPart = parts[1] || ''
  const kind = BLOB_KINDS.includes(parts[2]) ? parts[2] : ''

  return {
    kind,
    seed: seedPart || name || 'agent',
    seedPart
  }
}

/** `avatar.tsx:184-190`. */
export function blobShapeString(seedPart: string, kind: string): string {
  if (kind) {
    return `blobatar:${seedPart}:${kind}`
  }

  return seedPart ? `blobatar:${seedPart}` : 'blobatar'
}

export interface BotAvatarOptions {
  /** The stored `ui_meta['hermes-bots'].shape` value, or `null`/absent to
   *  render the plain name-seeded face (the only case reachable before a
   *  bot-settings/avatar-picker screen exists). */
  shape?: null | string
  size?: number
}

/** `avatar.tsx:194-216`'s seed/options resolution, minus the desktop-only
 *  `data-bot-face` attribute rewrite (see this module's header). Returns
 *  `null` on a `blobatar()` throw, same as `avatar.tsx:213-215`. */
export function botAvatarSvg(name: string, options: BotAvatarOptions = {}): null | string {
  const { kind, seed } = parseBlobShape(options.shape, name)
  const opts: BlobatarOptions = { size: options.size ?? 40 }

  if (kind) {
    opts.traits = { shape: BLOB_KIND_TRAIT[kind] }
  }

  try {
    return blobatar(seed, opts)
  } catch {
    return null
  }
}
