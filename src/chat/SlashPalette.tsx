import type { SlashCompletionItem } from '../gateway/session-connection'
import { filterSlashPalette } from '../lib/mobile-slash-commands'

import { CompletionList } from './CompletionList'

export interface SlashPaletteProps {
  items: SlashCompletionItem[]
  onSelect: (text: string) => void
}

/** The `/`-triggered completion list — `commands.catalog` + `complete.slash`
 *  rows, filtered through `mobile-slash-commands.ts` so a pane-only command
 *  never appears (M06 exit criterion). Skills always pass through. */
export function SlashPalette({ items, onSelect }: SlashPaletteProps) {
  return <CompletionList onSelect={onSelect} rows={filterSlashPalette(items)} />
}
