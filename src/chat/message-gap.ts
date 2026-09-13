// Pure — no react-native/FlashList import, so Transcript.test.ts can import
// it directly (importing Transcript.tsx itself pulls in @shopify/flash-list,
// which vitest's react-native stub doesn't cover; same class of problem as
// src/components/drawer-rows.ts, see that file's header).
//
// M14: the boundary between a message and the one chronologically before it
// — a role change opens a new turn (6 dp, `.375rem`); consecutive same-role
// messages are blocks inside one turn (12 dp, `.75rem`). Derived from
// `role` rather than invented, since `ChatMessage` has no explicit
// turn-boundary field to key off directly.
export type MessageGap = 'block' | 'turn' | null

export function messageGap(message: { role: string }, older: { role: string } | undefined): MessageGap {
  if (!older) {
    return null
  }

  return older.role === message.role ? 'block' : 'turn'
}
