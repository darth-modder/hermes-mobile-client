import { describe, expect, it } from 'vitest'

import { responseStatsLine } from './strings.mobile'

// M15 B, task 2: the per-message response-stats line
// (docs/mobile-prototypes/chat.html:113's own example: "mimo-v2.5 · Σ 14K
// tok · 3.9 tok/s"). ResponseStats.tsx is the only caller and isn't itself
// unit-testable (this project's vitest setup doesn't render .tsx
// components), so the formatting logic is tested here directly.
describe('responseStatsLine', () => {
  it('matches the prototype example exactly', () => {
    expect(responseStatsLine('mimo-v2.5', '14k', '3.9')).toBe('mimo-v2.5 · Σ 14k tok · 3.9 tok/s')
  })

  it('omits the tok/s segment when the server sent no avg_tps', () => {
    expect(responseStatsLine('mimo-v2.5', '14k', null)).toBe('mimo-v2.5 · Σ 14k tok')
  })

  it('omits the model segment (no leading empty " · ") when the message carries usage but no model', () => {
    expect(responseStatsLine(null, '62', null)).toBe('Σ 62 tok')
    expect(responseStatsLine(null, '62', '1.0')).toBe('Σ 62 tok · 1.0 tok/s')
  })
})
