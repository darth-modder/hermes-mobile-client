// Ported from apps/desktop/src/lib/markdown-code.ts (codiconForLanguage,
// codiconForFilename, sanitizeLanguageTag, and the two lookup tables they
// use) — file/language -> codicon name, so a file row and a fenced code
// block resolve to the same icon vocabulary as the desktop. Not vendored
// (markdown-code.ts also carries the Shiki-language table and
// prose-vs-code heuristics this app doesn't use — src/chat/parts/highlight.ts
// owns syntax highlighting here, via lowlight, not this file).

import { normalize } from '../upstream/lib/text'

const VALID_LANGUAGE_RE = /^[a-z0-9][a-z0-9+#-]*$/i

export function sanitizeLanguageTag(tag: string): string {
  const trimmed = tag.trim()
  const first = trimmed.split(/\s/, 1)[0] || ''

  return VALID_LANGUAGE_RE.test(first) && first.length <= 16 ? first.toLowerCase() : ''
}

// Sanitized language tag -> codicon glyph name. Anything not listed falls
// back to the generic `code` glyph, which matches what the tool-row icons use.
const CODICON_BY_LANGUAGE: Record<string, string> = {
  bash: 'terminal',
  cmd: 'terminal',
  console: 'terminal',
  fish: 'terminal',
  powershell: 'terminal',
  ps1: 'terminal',
  sh: 'terminal',
  shell: 'terminal',
  zsh: 'terminal',

  md: 'markdown',
  markdown: 'markdown',

  json: 'json',
  json5: 'json',

  ini: 'settings-gear',
  toml: 'settings-gear',
  yaml: 'settings-gear',
  yml: 'settings-gear',
  dotenv: 'settings-gear',
  env: 'settings-gear',

  graphql: 'database',
  gql: 'database',
  mysql: 'database',
  postgres: 'database',
  postgresql: 'database',
  sql: 'database',
  sqlite: 'database',

  diff: 'diff',
  patch: 'diff',

  css: 'symbol-color',
  less: 'symbol-color',
  sass: 'symbol-color',
  scss: 'symbol-color',
  svg: 'symbol-color',

  regex: 'regex',
  regexp: 'regex',

  curl: 'globe',
  http: 'globe',

  docker: 'package',
  dockerfile: 'package',

  mermaid: 'graph'
}

export function codiconForLanguage(language: string | undefined): string {
  return CODICON_BY_LANGUAGE[sanitizeLanguageTag(language || '')] || 'code'
}

// File extension -> language tag, so a filename can resolve to the same icon
// a fenced code block of that language would get. Only extensions that map
// to a non-generic codicon need an entry; everything else falls through to
// `code`.
const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  bash: 'bash',
  cfg: 'ini',
  conf: 'ini',
  css: 'css',
  dockerfile: 'dockerfile',
  env: 'env',
  gql: 'graphql',
  graphql: 'graphql',
  ini: 'ini',
  json: 'json',
  json5: 'json',
  less: 'less',
  markdown: 'markdown',
  md: 'markdown',
  mdx: 'markdown',
  mmd: 'mermaid',
  ps1: 'powershell',
  psql: 'sql',
  sass: 'sass',
  scss: 'scss',
  sh: 'bash',
  sql: 'sql',
  svg: 'svg',
  toml: 'toml',
  yaml: 'yaml',
  yml: 'yml',
  zsh: 'zsh'
}

/** Last path segment's extension (or the bare lowercased name for
 *  `Dockerfile`, `Makefile`, ...). */
function filenameExtToken(path: string | undefined): string {
  const base = normalize((path || '').replace(/\\/g, '/').split('/').pop())
  const dot = base.lastIndexOf('.')

  return dot > 0 ? base.slice(dot + 1) : base
}

/** Icon for a file path by its extension, reusing the language -> codicon map
 *  so file rows and code blocks share one visual vocabulary. */
export function codiconForFilename(path: string | undefined): string {
  const token = filenameExtToken(path)
  const language = LANGUAGE_BY_EXTENSION[token] || token

  return codiconForLanguage(language)
}
