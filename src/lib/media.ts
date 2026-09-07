import { capitalize } from '../upstream/lib/text'

/**
 * Pure port of the two media helpers `src/upstream/lib/chat-messages/parts.ts` needs
 * (mirrors `apps/desktop/src/lib/media.ts` upstream). Only `mediaDisplayLabel` and
 * `mediaMarkdownHref` are ported — everything else in the upstream file resolves an
 * actual byte source (Electron IPC, desktop-fs, the gateway media proxy), which has
 * no equivalent here; the mobile client fetches media over `/api/*` instead (M09+).
 */

type MediaKind = 'audio' | 'file' | 'image' | 'video'

const MEDIA_KIND_BY_EXT: Record<string, MediaKind> = {
  avi: 'video',
  bmp: 'image',
  flac: 'audio',
  gif: 'image',
  jpeg: 'image',
  jpg: 'image',
  m4a: 'audio',
  mkv: 'video',
  mov: 'video',
  mp3: 'audio',
  mp4: 'video',
  ogg: 'audio',
  opus: 'audio',
  png: 'image',
  svg: 'image',
  wav: 'audio',
  webm: 'video',
  webp: 'image'
}

function mediaExtension(path: string): string | undefined {
  return path.split(/[?#]/, 1)[0]?.split('.').pop()?.toLowerCase()
}

function mediaKind(path: string): MediaKind {
  const ext = mediaExtension(path)

  return (ext && MEDIA_KIND_BY_EXT[ext]) || 'file'
}

function mediaName(path: string): string {
  try {
    const url = new URL(path)

    return url.pathname.split('/').filter(Boolean).pop() || path
  } catch {
    return path.split(/[\\/]/).filter(Boolean).pop() || path
  }
}

export function mediaDisplayLabel(path: string): string {
  const escaped = mediaName(path).replace(/[[\]\\]/g, '\\$&')
  const kind = mediaKind(path)

  return `${capitalize(kind)}: ${escaped}`
}

export function mediaMarkdownHref(path: string): string {
  return `#media:${encodeURIComponent(path)}`
}
