/**
 * Attachment picking for the composer — bytes RPCs only (no shared
 * filesystem between phone and server, M06 task line). Images and PDFs are
 * queued server-side by the attach call itself (`session["attached_images"]`
 * in tui_gateway/prompt_attachments.py) and picked up by the NEXT
 * `prompt.submit` automatically — nothing needs inserting into the composer
 * text for those. A plain `file.attach`, by contrast, returns an
 * `@file:<path>` ref that must ride along in the submitted text for the
 * model to see it, so its `ComposerAttachment.ref` is non-empty; image/pdf
 * attachments leave `ref` empty for the same reason.
 */

import * as DocumentPicker from 'expo-document-picker'
import * as FileSystemLegacy from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'

import { attachFile, attachImageBytes, attachPdf } from '../gateway/session-connection'
import type { ComposerAttachment } from '../store/composer'

function filenameFromUri(uri: string): string {
  return uri.split(/[?#]/, 1)[0]?.split('/').pop() || 'attachment'
}

/** Opens the photo library; resolves `null` when the user cancels. Requires
 *  the `expo-image-picker` photos permission (declared in app.config.ts). */
export async function pickAndAttachImage(storedSessionId: string): Promise<ComposerAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()

  if (!permission.granted) {
    throw new Error('Photo library permission was not granted')
  }

  const result = await ImagePicker.launchImageLibraryAsync({ base64: true, mediaTypes: 'images', quality: 0.9 })

  if (result.canceled || !result.assets[0]) {
    return null
  }

  const asset = result.assets[0]

  if (!asset.base64) {
    throw new Error('Image picker did not return image data')
  }

  const filename = asset.fileName || filenameFromUri(asset.uri)
  const response = await attachImageBytes(storedSessionId, asset.base64, filename)

  return { label: response.text ?? `📎 ${filename}`, ref: '' }
}

/** Opens the document picker for any non-image file; resolves `null` when
 *  the user cancels. PDFs render server-side via `pdf.attach`
 *  (`pdftoppm`/poppler-utils REQUIRED on the server — a server without it
 *  fails with error 5028, surfaced here as a thrown Error the composer
 *  should show, not silently swallow); everything else goes through the
 *  generic `file.attach`, whose `@file:` ref must be inserted into the
 *  submitted text. */
export async function pickAndAttachDocument(storedSessionId: string): Promise<ComposerAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: '*/*' })

  if (result.canceled || !result.assets[0]) {
    return null
  }

  const asset = result.assets[0]
  const filename = asset.name || filenameFromUri(asset.uri)

  if (asset.mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    const base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: FileSystemLegacy.EncodingType.Base64 })
    const response = await attachPdf(storedSessionId, base64, filename)

    return { label: `📎 ${response.filename} (${response.pages_attached}p)`, ref: '' }
  }

  const base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, { encoding: FileSystemLegacy.EncodingType.Base64 })
  const dataUrl = `data:${asset.mimeType || 'application/octet-stream'};base64,${base64}`
  const response = await attachFile(storedSessionId, dataUrl, filename)

  return { label: `📎 ${response.name}`, ref: response.ref_text }
}
