// Pure text-coercion helpers ported from apps/desktop/src/lib/chat-runtime.ts
// (coerceGatewayText, coerceThinkingText, normalizePersonalityValue). Small
// enough, and used widely enough across the family handlers, that hand-porting
// them here is simpler than allow-listing the whole (much larger) desktop
// file — same precedent as M02's inlined local types.

import { normalize } from '../../upstream/lib/text'

const THINKING_STATUS_PREFIX_RE =
  /^\s*(?:(?:[^\s.]{1,16})\s+)?(?:processing|thinking|reasoning|analyzing|pondering|contemplating|musing|cogitating|ruminating|deliberating|mulling|reflecting|computing|synthesizing|formulating|brainstorming)\.\.\.\s*/i

const EMPTY_THINKING_PLACEHOLDER_RE =
  /\b(?:current rewritten thinking|next thinking to process|provide the thinking content|don't see any .*thinking)\b/i

export function coerceGatewayText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value === null || value === undefined) {
    return ''
  }

  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'string') {
          return item
        }

        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>

          if (typeof row.text === 'string') {
            return row.text
          }

          if (typeof row.output_text === 'string') {
            return row.output_text
          }
        }

        return ''
      })
      .join('')
  }

  if (typeof value === 'object') {
    const row = value as Record<string, unknown>

    if (typeof row.text === 'string') {
      return row.text
    }

    if (typeof row.output_text === 'string') {
      return row.output_text
    }

    try {
      return JSON.stringify(value)
    } catch {
      return ''
    }
  }

  return String(value)
}

/**
 * Normalize a reasoning/thinking text payload from the gateway.
 *
 * Only the leading status prefix (e.g. "Hermes is thinking...") and the
 * obvious placeholder echoes are stripped. We deliberately do NOT trim
 * the delta — reasoning streams as small chunks (often individual tokens
 * with leading or trailing spaces), and trimming each chunk before
 * concatenation collapses adjacent words together. Whitespace between
 * tokens belongs to the data, not chrome.
 */
export function coerceThinkingText(value: unknown): string {
  const raw = coerceGatewayText(value).replace(THINKING_STATUS_PREFIX_RE, '')

  return EMPTY_THINKING_PLACEHOLDER_RE.test(raw) ? '' : raw
}

export function normalizePersonalityValue(value: string): string {
  const trimmed = normalize(value)

  return !trimmed || trimmed === 'default' || trimmed === 'none' ? '' : trimmed
}
