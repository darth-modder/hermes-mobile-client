/** Pure helpers for tts.ts, split out so they stay testable under plain vitest — tts.ts itself
 *  statically imports `expo-file-system/legacy`, which (like `attachments.ts`'s own use of the
 *  same module) can't load outside a real Expo/RN environment. */

const MIME_EXTENSIONS: Record<string, string> = {
  'audio/flac': 'flac',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav'
}

export function extensionForMime(mimeType: string): string {
  return MIME_EXTENSIONS[mimeType] ?? 'mp3'
}

export function base64FromDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')

  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1)
}
