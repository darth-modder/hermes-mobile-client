import { useStore } from '@nanostores/react'
import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { KeyboardStickyView } from 'react-native-keyboard-controller'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  askBtw,
  completePath,
  completeSlash,
  compressSession,
  execSlashCommand,
  type PathCompletionItem,
  renameSession,
  type SlashCompletionItem,
  steerTurn,
  stopTurn,
  submitPrompt
} from '../gateway/session-connection'
import { pickAndAttachDocument, pickAndAttachImage } from '../lib/attachments'
import { hapticSubmit } from '../lib/haptics'
import { FileText, ImageIcon, Mic, MicOff, Volume2, X } from '../lib/icons'
import { mobileCommandSurface, mobileCommandUnavailableMessage } from '../lib/mobile-slash-commands'
import { clearComposerDraft, type ComposerAttachment, composerDraft, setComposerDraft } from '../store/composer'
import { notify } from '../store/notifications'
import { $sessionStates } from '../store/session-states'
import { useTheme } from '../theme/provider'
import { radius, type } from '../theme/type'
import { cancelRecording, isRecording, startRecording, stopRecordingAndTranscribe } from '../voice/recorder'
import { speakUnspokenReply } from '../voice/speech-progress'
import { speak } from '../voice/tts'

import { CompletionList } from './CompletionList'
import { shouldApplyDictationResult } from './dictation-guard'
import { SlashPalette } from './SlashPalette'

export interface ComposerProps {
  storedSessionId: string
}

function firstWord(text: string): string {
  return text.trim().split(/\s+/, 1)[0] ?? ''
}

function restOfCommand(text: string): string {
  return text.trim().slice(firstWord(text).length).trim()
}

/** The trailing `@word` being typed (no whitespace since the `@`), or null —
 *  mirrors how `complete.path`'s `word` param is meant to be sourced (the
 *  token immediately behind the cursor). Text-only tracking (no cursor
 *  position from `TextInput`), so this always looks at the END of the text;
 *  editing an `@ref` earlier in a longer message won't re-trigger it. */
function activeAtWord(text: string): null | string {
  const match = /(^|\s)(@\S*)$/.exec(text)

  return match ? match[2] : null
}

// M14 task 5: docs/desktop-prototypes/f-dialogs/add-url.html ("Attach a
// URL" — fetches a page and adds it as context for the turn, opened from
// the composer's "Add context" menu) is confirmed absent, not built.
// Checked src/gateway/session-connection.ts directly: `attachImageBytes`/
// `attachFile`/`attachPdf` all take bytes already on the device (via
// pickAndAttachImage/pickAndAttachDocument below) — there is no
// fetch-a-URL-and-attach-as-context call, gateway RPC or otherwise, for
// this app to send. That prototype's own header already hedges this ("URL
// attach is not listed [in PARITY.md], so treat it as unverified"); having
// now checked, it isn't there. This composer also has no "Add context"
// menu at all yet (only the two attach buttons below) — a URL-attach sheet
// would need both that menu and a backend call neither exists.
export function Composer({ storedSessionId }: ComposerProps) {
  const tokens = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const session = useStore($sessionStates)[storedSessionId]
  const busy = session?.busy ?? false

  const [text, setText] = useState(() => composerDraft(storedSessionId).text)
  const [attachments, setAttachments] = useState<ComposerAttachment[]>(() => composerDraft(storedSessionId).attachments)
  const [sending, setSending] = useState(false)
  const [attaching, setAttaching] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [slashItems, setSlashItems] = useState<SlashCompletionItem[]>([])
  const slashDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [atItems, setAtItems] = useState<PathCompletionItem[]>([])
  const atDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kept in sync every render (not just via the effect below) so toggleRecording's async
  // transcription branch can tell, once the network call resolves, whether the user has since
  // switched to a different session — `isRecording()` alone can't catch this: the recorder is
  // already cleared before stopRecordingAndTranscribe's network await even starts.
  const currentSessionIdRef = useRef(storedSessionId)

  currentSessionIdRef.current = storedSessionId

  useEffect(() => {
    const draft = composerDraft(storedSessionId)

    setText(draft.text)
    setAttachments(draft.attachments)

    // Switching sessions abandons any in-progress recording for the previous one — the mic
    // button is per-composer-instance, not per-session state worth preserving across a switch.
    if (isRecording()) {
      void cancelRecording()
      setRecording(false)
    }
  }, [storedSessionId])

  useEffect(() => {
    setComposerDraft(storedSessionId, { attachments, text })
  }, [storedSessionId, text, attachments])

  useEffect(() => {
    if (slashDebounce.current) {
      clearTimeout(slashDebounce.current)
    }

    if (!text.startsWith('/')) {
      setSlashItems([])

      return
    }

    slashDebounce.current = setTimeout(() => {
      completeSlash(text)
        .then(setSlashItems)
        .catch(() => setSlashItems([]))
    }, 150)

    return () => {
      if (slashDebounce.current) {
        clearTimeout(slashDebounce.current)
      }
    }
  }, [text])

  useEffect(() => {
    if (atDebounce.current) {
      clearTimeout(atDebounce.current)
    }

    const word = activeAtWord(text)

    if (!word) {
      setAtItems([])

      return
    }

    atDebounce.current = setTimeout(() => {
      completePath(word)
        .then(setAtItems)
        .catch(() => setAtItems([]))
    }, 150)

    return () => {
      if (atDebounce.current) {
        clearTimeout(atDebounce.current)
      }
    }
  }, [text])

  const selectAtCompletion = (replacement: string) => {
    setText(current => current.replace(/(^|\s)@\S*$/, `$1${replacement} `))
    setAtItems([])
  }

  const clearComposer = () => {
    setText('')
    setAttachments([])
    clearComposerDraft(storedSessionId)
  }

  const runSlashCommand = async (command: string) => {
    const surface = mobileCommandSurface(firstWord(command))
    const arg = restOfCommand(command)

    if (surface.kind === 'unavailable') {
      notify({
        durationMs: 4000,
        id: `slash-unavailable-${storedSessionId}`,
        kind: 'info',
        message: mobileCommandUnavailableMessage(surface.reason),
        title: 'Not available',
        type: 'notify'
      })

      return
    }

    if (surface.kind === 'navigate') {
      clearComposer()
      router.push(surface.route)

      return
    }

    if (surface.kind === 'rpc') {
      if (surface.rpc === 'session.interrupt') {
        await stopTurn(storedSessionId)
      } else if (surface.rpc === 'session.compress') {
        await compressSession(storedSessionId)
      } else if (surface.rpc === 'session.title') {
        await renameSession(storedSessionId, arg)
      } else {
        await askBtw(storedSessionId, arg)
      }

      clearComposer()

      return
    }

    const output = await execSlashCommand(storedSessionId, command)

    clearComposer()

    if (output) {
      notify({
        durationMs: 6000,
        id: `slash-output-${storedSessionId}`,
        kind: 'info',
        message: output,
        title: command,
        type: 'notify'
      })
    }
  }

  const send = async () => {
    const trimmed = text.trim()

    if (!trimmed && attachments.length === 0) {
      return
    }

    hapticSubmit()
    setSending(true)

    try {
      if (trimmed.startsWith('/')) {
        await runSlashCommand(trimmed)

        return
      }

      if (busy) {
        await steerTurn(storedSessionId, trimmed)
      } else {
        const fileRefs = attachments.map(attachment => attachment.ref).filter(Boolean)

        await submitPrompt(storedSessionId, trimmed, fileRefs)
      }

      clearComposer()
    } catch (error) {
      notify({
        id: `send-failed-${storedSessionId}`,
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        title: 'Send failed',
        type: 'notify'
      })
    } finally {
      setSending(false)
    }
  }

  const stop = async () => {
    await stopTurn(storedSessionId).catch(() => undefined)
  }

  const attachImage = async () => {
    setAttaching(true)

    try {
      const attachment = await pickAndAttachImage(storedSessionId)

      if (attachment) {
        setAttachments(current => [...current, attachment])
      }
    } catch (error) {
      notify({
        id: `attach-failed-${storedSessionId}`,
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        title: 'Attachment failed',
        type: 'notify'
      })
    } finally {
      setAttaching(false)
    }
  }

  const attachDocument = async () => {
    setAttaching(true)

    try {
      const attachment = await pickAndAttachDocument(storedSessionId)

      if (attachment) {
        setAttachments(current => [...current, attachment])
      }
    } catch (error) {
      notify({
        id: `attach-failed-${storedSessionId}`,
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        title: 'Attachment failed',
        type: 'notify'
      })
    } finally {
      setAttaching(false)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(current => current.filter((_, i) => i !== index))
  }

  const toggleRecording = async () => {
    if (recording) {
      const recordedForSessionId = storedSessionId

      setRecording(false)
      setTranscribing(true)

      try {
        const { transcript } = await stopRecordingAndTranscribe()

        // The user may have switched sessions while transcription was in flight — this
        // composer instance is reused across sessions (see the storedSessionId effect above),
        // so an unguarded setText here would insert text recorded for one session into
        // whichever session's draft happens to be current when the network call resolves.
        // See dictation-guard.ts for the (unit-tested) regression this guards against.
        if (transcript && shouldApplyDictationResult(recordedForSessionId, currentSessionIdRef.current)) {
          setText(current => (current ? `${current.trim()} ${transcript}` : transcript))
        }
      } catch (error) {
        if (shouldApplyDictationResult(recordedForSessionId, currentSessionIdRef.current)) {
          notify({
            id: `dictate-failed-${recordedForSessionId}`,
            kind: 'error',
            message: error instanceof Error ? error.message : String(error),
            title: 'Dictation failed',
            type: 'notify'
          })
        }
      } finally {
        setTranscribing(false)
      }

      return
    }

    try {
      await startRecording()
      setRecording(true)
    } catch (error) {
      notify({
        id: `record-failed-${storedSessionId}`,
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        title: 'Could not start recording',
        type: 'notify'
      })
    }
  }

  const speakLastReply = async () => {
    setSpeaking(true)

    try {
      const spoke = await speakUnspokenReply(storedSessionId, session?.messages ?? [], speak)

      if (!spoke) {
        notify({
          durationMs: 3000,
          id: `speak-nothing-${storedSessionId}`,
          kind: 'info',
          message: 'No new reply to read out.',
          title: 'Nothing to speak',
          type: 'notify'
        })
      }
    } catch (error) {
      notify({
        id: `speak-failed-${storedSessionId}`,
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        title: 'Speech failed',
        type: 'notify'
      })
    } finally {
      setSpeaking(false)
    }
  }

  return (
    <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
      <View style={[styles.container, { backgroundColor: tokens.background, borderTopColor: tokens.border }]}>
        {atItems.length > 0 ? (
          <CompletionList onSelect={selectAtCompletion} rows={atItems} />
        ) : slashItems.length > 0 ? (
          <SlashPalette items={slashItems} onSelect={setText} />
        ) : null}
        {attachments.length > 0 ? (
          <View style={styles.attachmentRow}>
            {attachments.map((attachment, index) => (
              <TouchableOpacity
                accessibilityLabel={`Remove ${attachment.label}`}
                accessibilityRole="button"
                hitSlop={12}
                key={index}
                onPress={() => removeAttachment(index)}
                style={[styles.attachmentChip, { backgroundColor: tokens.muted, borderColor: tokens.border }]}
              >
                <Text style={[styles.attachmentText, { color: tokens.mutedForeground }]}>{attachment.label}</Text>
                <X color={tokens.mutedForeground} size={12} />
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <View style={styles.row}>
          <TouchableOpacity
            accessibilityLabel="Attach image"
            accessibilityRole="button"
            disabled={attaching}
            onPress={() => void attachImage()}
            style={styles.iconButton}
          >
            <ImageIcon color={tokens.foreground} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Attach document"
            accessibilityRole="button"
            disabled={attaching}
            onPress={() => void attachDocument()}
            style={styles.iconButton}
          >
            <FileText color={tokens.foreground} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={recording ? 'Stop recording' : 'Record voice message'}
            accessibilityRole="button"
            disabled={transcribing}
            onPress={() => void toggleRecording()}
            style={styles.iconButton}
          >
            {transcribing ? (
              <ActivityIndicator color={tokens.foreground} size="small" />
            ) : recording ? (
              <MicOff color={tokens.destructive} size={20} />
            ) : (
              <Mic color={tokens.foreground} size={20} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Read last reply aloud"
            accessibilityRole="button"
            disabled={speaking}
            onPress={() => void speakLastReply()}
            style={styles.iconButton}
          >
            {speaking ? (
              <ActivityIndicator color={tokens.foreground} size="small" />
            ) : (
              <Volume2 color={tokens.foreground} size={20} />
            )}
          </TouchableOpacity>
          <TextInput
            multiline
            onChangeText={setText}
            placeholder="Message Hermes…"
            placeholderTextColor={tokens.mutedForeground}
            style={[styles.input, { color: tokens.foreground }]}
            value={text}
          />
          {busy ? (
            <TouchableOpacity
              onPress={() => void stop()}
              style={[styles.sendButton, { backgroundColor: tokens.diffRemoveBackground }]}
            >
              <Text style={[styles.sendButtonText, { color: tokens.destructive }]}>Stop</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            disabled={sending || (!text.trim() && attachments.length === 0)}
            onPress={() => void send()}
            style={[styles.sendButton, { backgroundColor: tokens.primary }]}
          >
            {sending ? (
              <ActivityIndicator color={tokens.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.sendButtonText, { color: tokens.primaryForeground }]}>
                {busy ? 'Steer' : 'Send'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardStickyView>
  )
}

const styles = StyleSheet.create({
  attachmentChip: {
    alignItems: 'center',
    borderRadius: radius.control,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
    marginRight: 6,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  attachmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    paddingTop: 6
  },
  attachmentText: {
    ...type.caption
  },
  container: {
    borderTopWidth: StyleSheet.hairlineWidth
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 6,
    paddingVertical: 8
  },
  input: {
    ...type.body,
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 8
  },
  row: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: radius.full,
    justifyContent: 'center',
    marginLeft: 4,
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  sendButtonText: {
    ...type.label,
    fontWeight: '600'
  }
})
