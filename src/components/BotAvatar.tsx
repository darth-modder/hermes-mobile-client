// M15 A/"plus avatars": the roster row, chat header and bot-settings sheet
// (all future work — no screen consumes this yet, per this round's scope)
// share this one component so a bot shows the same face everywhere, exactly
// as the desktop's BotFace (avatar.tsx) does across its roster row, dialog
// and tile call sites.

import { SvgXml } from 'react-native-svg'

import { type BotAvatarOptions, botAvatarSvg } from '../lib/bot-avatar'

export interface BotAvatarProps extends BotAvatarOptions {
  /** The bot's profile name — the seed when `shape` doesn't lock its own. */
  name: string
}

/** Renders the bot's blobatar face via `react-native-svg`'s `SvgXml`, seeded
 *  exactly as the desktop's `avatar.tsx` seeds it (`src/lib/bot-avatar.ts`'s
 *  header). Renders nothing when `botAvatarSvg` returns `null` (a `blobatar`
 *  throw), matching `avatar.tsx:213-215`'s own fallback. */
export function BotAvatar({ name, shape, size }: BotAvatarProps) {
  const svg = botAvatarSvg(name, { shape, size })

  if (!svg) {
    return null
  }

  return <SvgXml height={size ?? 40} width={size ?? 40} xml={svg} />
}
