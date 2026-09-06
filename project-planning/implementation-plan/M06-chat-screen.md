# M06 — Chat screen

**Status:** todo
**Depends on:** M04, M05
**Goal:** Real conversations with tool cards, reasoning, inline approvals, attachments and slash commands.

## Tasks

- [ ] `app/(main)/sessions/[id].tsx` + `src/chat/Transcript.tsx` (`@shopify/flash-list`, inverted, `maintainVisibleContentPosition`)
- [ ] Message parts:
  - `TextPart`: `react-native-markdown-display` with block-split memoization (only the streaming tail re-parses); `lowlight` code highlighting (no shiki: Hermes has no WebAssembly); math / mermaid rendered as code in v1
  - `ToolCallCard` (collapsible, progress, diffs), `ReasoningDisclosure`
  - `ApprovalCard`, `ClarifyCard`, `SudoCard`, `SecretCard` answering via `approval.respond`, `clarify.respond`, `sudo.respond`, `secret.respond`
  - `TodoPanel` (`todo.updated`), `UsageChip` (`session.usage`)
- [ ] `src/chat/Composer.tsx` on `react-native-keyboard-controller`: send, stop, steer, `prompt.btw`; multiline; per-session draft persistence
- [ ] `src/lib/mobile-slash-commands.ts` mirroring upstream `NO_DESKTOP_SURFACE` (`apps/desktop/src/lib/desktop-slash-commands.ts`) plus pane-only commands; slash palette on `commands.catalog` + `complete.slash`; `@`-file refs via `complete.path`; skills and quick commands pass through
- [ ] Attachments via bytes RPCs (no shared filesystem): `image.attach_bytes { session_id, content_base64, filename }` (25 MiB), `file.attach { session_id, data_url, name }`, `pdf.attach { session_id, content_base64, filename }` (50 MiB, needs poppler on the server); pickers `expo-image-picker`, `expo-document-picker`; base64 via `expo-file-system`
- [ ] Session header: model / provider / effort from `session.info`; `session.compress`; title edit
- [ ] `expo-screen-capture` blocks screenshots while a secret card is open; secret values are never persisted

## Deliverables

- `src/chat/**`, `src/lib/mobile-slash-commands.ts`, `app/(main)/sessions/[id].tsx`

## Exit criteria (on device)

- Approval, clarify, sudo and secret round-trips succeed.
- Image and PDF attachments upload and are referenced in the reply.
- Slash palette lists skills and hides pane-only commands.
- A 2,000-message transcript scrolls without dropped frames on a mid-range phone.
- Desktop and phone on the same session: `session.reclaimed` handled without a stuck composer.
