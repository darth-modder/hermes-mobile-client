import { useStore } from '@nanostores/react'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
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
import { hapticArmed, hapticSubmit } from '../lib/haptics'
import { FileText, ImageIcon, Mic, MicOff, Volume2, X } from '../lib/icons'
import { mobileCommandSurface, mobileCommandUnavailableMessage } from '../lib/mobile-slash-commands'
import {
  COMPOSER_ATTACH_DOCUMENT_LABEL,
  COMPOSER_ATTACH_IMAGE_LABEL,
  COMPOSER_ATTACHMENT_FAILED_TITLE,
  COMPOSER_AUTO_SEND_ARMED_HINT,
  COMPOSER_AUTO_SEND_LABEL,
  COMPOSER_COULD_NOT_START_RECORDING_TITLE,
  COMPOSER_DICTATION_FAILED_TITLE,
  COMPOSER_EDIT_BEFORE_SENDING_LABEL,
  COMPOSER_HOLD_TO_AUTO_SEND_HINT,
  COMPOSER_NO_REPLY_TO_READ_MESSAGE,
  COMPOSER_NOT_AVAILABLE_TITLE,
  COMPOSER_NOTHING_TO_SPEAK_TITLE,
  COMPOSER_PLACEHOLDER,
  COMPOSER_READ_LAST_REPLY_LABEL,
  COMPOSER_RECORD_VOICE_LABEL,
  COMPOSER_SEND_FAILED_TITLE,
  COMPOSER_SPEECH_FAILED_TITLE,
  COMPOSER_STEER_LABEL,
  COMPOSER_STOP_RECORDING_LABEL
} from '../lib/strings.mobile'
import { t } from '../lib/t'
import { $composePrefillRequests } from '../store/compose-request'
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
import { EffortChip } from './EffortChip'
import {
  AUTO_SEND_GRACE_MS,
  type DictationEffect,
  type DictationEvent,
  type DictationState,
  HOLD_AUTO_SEND_MS,
  initialDictationState,
  isCapturing,
  reduceDictation,
  showsAutoSendState,
  showsEditEscape
} from './hold-to-dictate'
import { ModelChip } from './ModelChip'
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
  const [dictation, setDictation] = useState<DictationState>(initialDictationState)
  const [transcribing, setTranscribing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [slashItems, setSlashItems] = useState<SlashCompletionItem[]>([])
  const slashDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [atItems, setAtItems] = useState<PathCompletionItem[]>([])
  const atDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<TextInput>(null)
  const lastAppliedPrefillId = useRef(0)
  const prefillRequest = useStore($composePrefillRequests)[storedSessionId]

  // Kept in sync every render (not just via the effect below) so toggleRecording's async
  // transcription branch can tell, once the network call resolves, whether the user has since
  // switched to a different session — `isRecording()` alone can't catch this: the recorder is
  // already cleared before stopRecordingAndTranscribe's network await even starts.
  const currentSessionIdRef = useRef(storedSessionId)

  currentSessionIdRef.current = storedSessionId

  // Hold-to-dictate (M15 B) state lives in a ref alongside the useState copy:
  // the auto-send fires from a `setTimeout` whose closure was captured one or
  // more renders earlier, so every dictation decision has to read the *current*
  // machine, not the one that existed when the timer was armed.
  const dictationRef = useRef(dictation)

  dictationRef.current = dictation

  // Same reason, for the text the queued send will submit — `send()` below is
  // invoked from that timer as well as from the Send button.
  const textRef = useRef(text)

  textRef.current = text

  const thresholdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Lets the session-switch effect reach the dispatcher without listing a
  // per-render closure in its dependency array (which would re-run the
  // session reset on every render).
  const dispatchDictationRef = useRef<(event: DictationEvent) => void>(() => undefined)

  const clearThresholdTimer = useCallback(() => {
    if (thresholdTimer.current) {
      clearTimeout(thresholdTimer.current)
      thresholdTimer.current = null
    }
  }, [])

  const clearGraceTimer = useCallback(() => {
    if (graceTimer.current) {
      clearTimeout(graceTimer.current)
      graceTimer.current = null
    }
  }, [])

  useEffect(() => {
    const draft = composerDraft(storedSessionId)

    setText(draft.text)
    setAttachments(draft.attachments)

    // Switching sessions abandons any in-progress recording for the previous one — the mic
    // button is per-composer-instance, not per-session state worth preserving across a switch.
    // A queued auto-send is abandoned for the same reason (`cancel` from `pending` clears the
    // grace timer rather than stopping a recorder that already stopped).
    dispatchDictationRef.current({ type: 'cancel' })
  }, [storedSessionId])

  // M15 B "Edit-and-resend": a message's long-press Edit action calls
  // requestComposePrefill (src/store/compose-request.ts) rather than writing
  // the draft store directly — this composer owns `text` as local state
  // (typing must never round-trip through a store subscription), so an
  // external write needs a one-shot signal to apply, keyed by `requestId` so
  // a second edit while one is already pending is still observable.
  useEffect(() => {
    if (!prefillRequest || prefillRequest.requestId === lastAppliedPrefillId.current) {
      return
    }

    lastAppliedPrefillId.current = prefillRequest.requestId
    setText(prefillRequest.text)
    inputRef.current?.focus()
  }, [prefillRequest])

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
        title: COMPOSER_NOT_AVAILABLE_TITLE,
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
    // `textRef`, not `text`: the queued auto-send fires from a timer whose
    // closure predates the transcript landing in the composer.
    const trimmed = textRef.current.trim()

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
        title: COMPOSER_SEND_FAILED_TITLE,
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
        title: COMPOSER_ATTACHMENT_FAILED_TITLE,
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
        title: COMPOSER_ATTACHMENT_FAILED_TITLE,
        type: 'notify'
      })
    } finally {
      setAttaching(false)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(current => current.filter((_, i) => i !== index))
  }

  /**
   * Stops the recorder, transcribes, and puts the result in the composer.
   * `queueSend` is true only for a release that crossed the hold threshold —
   * it starts the grace window the "Edit before sending" escape lives in.
   *
   * This is M11's dictation body, unchanged in what it does on the tap path:
   * same `stopRecordingAndTranscribe`, same cross-session guard
   * (`dictation-guard.ts`), same "empty transcript inserts nothing".
   */
  const finishDictation = async (queueSend: boolean) => {
    const recordedForSessionId = storedSessionId

    setTranscribing(true)

    try {
      const { transcript } = await stopRecordingAndTranscribe()

      // The user may have switched sessions while transcription was in flight — this
      // composer instance is reused across sessions (see the storedSessionId effect above),
      // so an unguarded setText here would insert text recorded for one session into
      // whichever session's draft happens to be current when the network call resolves.
      // See dictation-guard.ts for the (unit-tested) regression this guards against.
      if (!shouldApplyDictationResult(recordedForSessionId, currentSessionIdRef.current)) {
        return
      }

      if (!transcript) {
        // Silence. M11 saw exactly this on the emulator; nothing goes in the
        // composer, and a queued auto-send is dropped rather than firing empty.
        dispatchDictationRef.current({ type: 'transcript-empty' })

        return
      }

      const next = textRef.current ? `${textRef.current.trim()} ${transcript}` : transcript

      // Written through the ref as well as state so the queued send below sees
      // it even if the timer beats the re-render.
      textRef.current = next
      setText(next)

      if (queueSend) {
        clearGraceTimer()
        graceTimer.current = setTimeout(() => {
          graceTimer.current = null
          dispatchDictationRef.current({ type: 'grace-elapsed' })
        }, AUTO_SEND_GRACE_MS)
      }
    } catch (error) {
      dispatchDictationRef.current({ type: 'transcript-empty' })

      if (shouldApplyDictationResult(recordedForSessionId, currentSessionIdRef.current)) {
        notify({
          id: `dictate-failed-${recordedForSessionId}`,
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
          title: COMPOSER_DICTATION_FAILED_TITLE,
          type: 'notify'
        })
      }
    } finally {
      setTranscribing(false)
    }
  }

  /** Runs what `hold-to-dictate.ts` decided. It owns no decisions of its own. */
  const runDictationEffect = async (effect: DictationEffect) => {
    switch (effect) {
      case 'start-recording': {
        try {
          await startRecording()
        } catch (error) {
          dispatchDictationRef.current({ type: 'cancel' })
          notify({
            id: `record-failed-${storedSessionId}`,
            kind: 'error',
            message: error instanceof Error ? error.message : String(error),
            title: COMPOSER_COULD_NOT_START_RECORDING_TITLE,
            type: 'notify'
          })
        }

        return
      }

      case 'haptic-armed':
        hapticArmed()

        return

      case 'stop-and-fill':
        await finishDictation(false)

        return

      case 'stop-and-queue':
        await finishDictation(true)

        return

      case 'send':
        await send()

        return

      case 'cancel-send':
        // The transcript stays in the composer, editable — only the send is off.
        clearGraceTimer()

        return

      case 'abandon':
        clearGraceTimer()

        if (isRecording()) {
          await cancelRecording()
        }

        return

      default:
        return
    }
  }

  const dispatchDictation = (event: DictationEvent) => {
    const { effect, next } = reduceDictation(dictationRef.current, event)

    dictationRef.current = next
    setDictation(next)
    void runDictationEffect(effect)
  }

  dispatchDictationRef.current = dispatchDictation

  const onMicPressIn = () => {
    clearThresholdTimer()
    // Drives only the *visible* armed state and its haptic — `release` measures
    // the hold itself, so a starved timer cannot lose an auto-send.
    thresholdTimer.current = setTimeout(() => {
      thresholdTimer.current = null
      dispatchDictationRef.current({ type: 'threshold' })
    }, HOLD_AUTO_SEND_MS)
    dispatchDictation({ at: Date.now(), type: 'press' })
  }

  const onMicPressOut = () => {
    clearThresholdTimer()
    dispatchDictation({ at: Date.now(), type: 'release' })
  }

  useEffect(() => clearThresholdTimer, [clearThresholdTimer])
  useEffect(() => clearGraceTimer, [clearGraceTimer])

  const speakLastReply = async () => {
    setSpeaking(true)

    try {
      const spoke = await speakUnspokenReply(storedSessionId, session?.messages ?? [], speak)

      if (!spoke) {
        notify({
          durationMs: 3000,
          id: `speak-nothing-${storedSessionId}`,
          kind: 'info',
          message: COMPOSER_NO_REPLY_TO_READ_MESSAGE,
          title: COMPOSER_NOTHING_TO_SPEAK_TITLE,
          type: 'notify'
        })
      }
    } catch (error) {
      notify({
        id: `speak-failed-${storedSessionId}`,
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
        title: COMPOSER_SPEECH_FAILED_TITLE,
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
        {/* M15 B, task 1, Deviation: docs/mobile-prototypes/chat.html:333-334
            puts the model/effort chips inline with the composer's other
            controls, but this composer's row already holds four icon
            buttons (M06/M11) — adding two more there would squeeze the
            TextInput below its placeholder's width, the same wrapping
            M14-screen-layouts.md's Deviation 15 moved Stop/Steer out for.
            The chips get their own row instead, above the input, so both
            keep their full 48dp targets and the input's width is untouched. */}
        {/* M15 B: the visible "Auto-send" state. Armed (finger still down) it
            reads "Release to send"; once the transcript is in the composer and
            editable, the escape replaces that hint. */}
        {showsAutoSendState(dictation) ? (
          <View style={[styles.autoSendRow, { backgroundColor: tokens.muted, borderColor: tokens.border }]}>
            <Text style={[styles.autoSendLabel, { color: tokens.primary }]}>{COMPOSER_AUTO_SEND_LABEL}</Text>
            {showsEditEscape(dictation) ? (
              <Pressable
                accessibilityLabel={COMPOSER_EDIT_BEFORE_SENDING_LABEL}
                accessibilityRole="button"
                onPress={() => dispatchDictation({ type: 'escape' })}
                style={styles.autoSendEscape}
              >
                <Text style={[styles.autoSendEscapeText, { color: tokens.foreground }]}>
                  {COMPOSER_EDIT_BEFORE_SENDING_LABEL}
                </Text>
              </Pressable>
            ) : (
              <Text style={[styles.autoSendHint, { color: tokens.mutedForeground }]}>
                {COMPOSER_AUTO_SEND_ARMED_HINT}
              </Text>
            )}
          </View>
        ) : null}
        <View style={styles.chipRow}>
          <ModelChip
            model={session?.model ?? ''}
            provider={session?.provider ?? ''}
            storedSessionId={storedSessionId}
          />
          <EffortChip reasoningEffort={session?.reasoningEffort ?? ''} storedSessionId={storedSessionId} />
        </View>
        <View style={styles.row}>
          <TouchableOpacity
            accessibilityLabel={COMPOSER_ATTACH_IMAGE_LABEL}
            accessibilityRole="button"
            disabled={attaching}
            onPress={() => void attachImage()}
            style={styles.iconButton}
          >
            <ImageIcon color={tokens.foreground} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={COMPOSER_ATTACH_DOCUMENT_LABEL}
            accessibilityRole="button"
            disabled={attaching}
            onPress={() => void attachDocument()}
            style={styles.iconButton}
          >
            <FileText color={tokens.foreground} size={20} />
          </TouchableOpacity>
          {/* M15 B hold-to-dictate: press-in/press-out rather than onPress, so
              the same button carries both gestures. A short tap still hands
              off to M11's toggle (first tap keeps recording, second stops and
              fills); only a hold past HOLD_AUTO_SEND_MS arms the auto-send.
              The decision is hold-to-dictate.ts's, not this handler's. */}
          <Pressable
            accessibilityHint={COMPOSER_HOLD_TO_AUTO_SEND_HINT}
            accessibilityLabel={isCapturing(dictation) ? COMPOSER_STOP_RECORDING_LABEL : COMPOSER_RECORD_VOICE_LABEL}
            accessibilityRole="button"
            disabled={transcribing}
            onPressIn={onMicPressIn}
            onPressOut={onMicPressOut}
            style={styles.iconButton}
          >
            {transcribing ? (
              <ActivityIndicator color={tokens.foreground} size="small" />
            ) : isCapturing(dictation) ? (
              <MicOff color={tokens.destructive} size={20} />
            ) : (
              <Mic color={tokens.foreground} size={20} />
            )}
          </Pressable>
          <TouchableOpacity
            accessibilityLabel={COMPOSER_READ_LAST_REPLY_LABEL}
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
            placeholder={COMPOSER_PLACEHOLDER}
            placeholderTextColor={tokens.mutedForeground}
            ref={inputRef}
            style={[styles.input, { color: tokens.foreground }]}
            value={text}
          />
          {busy ? null : (
            <TouchableOpacity
              disabled={sending || (!text.trim() && attachments.length === 0)}
              onPress={() => void send()}
              style={[styles.sendButton, { backgroundColor: tokens.primary }]}
            >
              {sending ? (
                <ActivityIndicator color={tokens.primaryForeground} size="small" />
              ) : (
                <Text style={[styles.sendButtonText, { color: tokens.primaryForeground }]}>{t.composer.send}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        {busy ? (
          // Stop and Steer alongside the four utility icons would squeeze the
          // input below its placeholder's width, wrapping it mid-word (see
          // M14-screen-layouts.md's verification log). Its own row keeps the
          // input's line free instead.
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={() => void stop()}
              style={[styles.sendButton, { backgroundColor: tokens.diffRemoveBackground }]}
            >
              <Text style={[styles.sendButtonText, { color: tokens.destructive }]}>{t.composer.stop}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={sending || (!text.trim() && attachments.length === 0)}
              onPress={() => void send()}
              style={[styles.sendButton, { backgroundColor: tokens.primary }]}
            >
              {sending ? (
                <ActivityIndicator color={tokens.primaryForeground} size="small" />
              ) : (
                <Text style={[styles.sendButtonText, { color: tokens.primaryForeground }]}>{COMPOSER_STEER_LABEL}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </KeyboardStickyView>
  )
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
    paddingBottom: 8,
    paddingHorizontal: 8
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 6
  },
  autoSendEscape: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12
  },
  autoSendEscapeText: {
    ...type.label,
    fontWeight: '600'
  },
  autoSendHint: {
    ...type.caption,
    paddingHorizontal: 12
  },
  autoSendLabel: {
    ...type.label,
    fontWeight: '600'
  },
  autoSendRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: 12
  },
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
    minHeight: 48,
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
