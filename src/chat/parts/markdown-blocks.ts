/**
 * Splits assistant markdown into top-level blocks on blank-line boundaries,
 * without ever splitting inside a fenced code block. TextPart.tsx renders
 * each block through its own memoized `<Markdown>` instance so a streaming
 * reply's per-delta re-render only re-parses its still-open TAIL block —
 * every earlier, already-closed block keeps its previous render (M06's
 * "only the streaming tail re-parses" task line).
 */

const FENCE_RE = /^\s*(```|~~~)/

export function splitMarkdownBlocks(text: string): string[] {
  const lines = text.split('\n')
  const blocks: string[] = []
  let current: string[] = []
  let inFence = false

  for (const line of lines) {
    if (FENCE_RE.test(line)) {
      inFence = !inFence
    }

    current.push(line)

    if (!inFence && line.trim() === '') {
      blocks.push(current.join('\n'))
      current = []
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'))
  }

  return blocks.filter(block => block.trim().length > 0)
}
