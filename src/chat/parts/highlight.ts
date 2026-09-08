/**
 * Thin wrapper around `lowlight` (M06: no shiki — Hermes has no WebAssembly,
 * see AGENTS.md / M02's spike). `common` is the same "common languages"
 * bundle shiki/highlight.js ship by default — enough for the languages a
 * coding agent's tool output actually uses (js/ts/py/json/bash/...) without
 * pulling in every grammar highlight.js knows.
 *
 * Kept separate from CodeBlock.tsx (which turns this into RN `Text`) so the
 * tokenizing half is plain data and testable without a React Native runtime.
 */

import type { Element, Root, RootContent } from 'hast'
import { common, createLowlight } from 'lowlight'

const lowlight = createLowlight(common)

export interface HighlightToken {
  text: string
  /** hljs class names (e.g. "hljs-keyword") this run should be colored by —
   *  empty for plain, unhighlighted text. */
  className: string[]
}

function flatten(node: RootContent, inherited: string[], out: HighlightToken[]): void {
  if (node.type === 'text') {
    if (node.value) {
      out.push({ className: inherited, text: node.value })
    }

    return
  }

  if (node.type !== 'element') {
    return
  }

  const element = node as Element

  const className = Array.isArray(element.properties?.className)
    ? (element.properties.className as unknown[]).filter((c): c is string => typeof c === 'string')
    : []

  const combined = className.length > 0 ? [...inherited, ...className] : inherited

  for (const child of element.children) {
    flatten(child, combined, out)
  }
}

/** Tokenize `code` as `language`. Returns a flat list of runs, each carrying
 *  every hljs class name that applies to it (nesting collapsed) — falls back
 *  to one unhighlighted run for an unknown language or a lowlight failure
 *  (malformed/partial code mid-stream must never crash the transcript). */
export function highlightCode(code: string, language: string | undefined): HighlightToken[] {
  const lang = (language || '').trim().toLowerCase()

  if (!lang || !lowlight.registered(lang)) {
    return [{ className: [], text: code }]
  }

  let tree: Root

  try {
    tree = lowlight.highlight(lang, code)
  } catch {
    return [{ className: [], text: code }]
  }

  const tokens: HighlightToken[] = []

  for (const child of tree.children) {
    flatten(child, [], tokens)
  }

  return tokens.length > 0 ? tokens : [{ className: [], text: code }]
}
