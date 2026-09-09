import { useStore } from '@nanostores/react'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { KeyboardStickyView } from 'react-native-keyboard-controller'

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
import { mobileCommandSurface, mobileCommandUnavailableMessage } from '../lib/mobile-slash-commands'
import { clearComposerDraft, type ComposerAttachment, composerDraft, setComposerDraft } from '../store/composer'
import { notify } from '../store/notifications'
import { $sessionStates } from '../store/session-states'
import { cancelRecording, isRecording, startRecording, stopRecordingAndTranscribe } from '../voice/recorder'
import { speakUnspokenReply } from '../voice/speech-progress'
import { speak } from '../voice/tts'

import { CompletionList } from './CompletionList'
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

export function Composer({ storedSessionId }: ComposerProps) {
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
      setRecording(false)
      setTranscribing(true)

      try {
        const { transcript } = await stopRecordingAndTranscribe()

        if (transcript) {
          setText(current => (current ? `${current.trim()} ${transcript}` : transcript))
        }
      } catch (error) {
        notify({
          id: `dictate-failed-${storedSessionId}`,
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
          title: 'Dictation failed',
          type: 'notify'
        })
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
    <KeyboardStickyView>
      <View style={styles.container}>
        {atItems.length > 0 ? (
          <CompletionList onSelect={selectAtCompletion} rows={atItems} />
        ) : slashItems.length > 0 ? (
          <SlashPalette items={slashItems} onSelect={setText} />
        ) : null}
        {attachments.length > 0 ? (
          <View style={styles.attachmentRow}>
            {attachments.map((attachment, index) => (
              <TouchableOpacity key={index} onPress={() => removeAttachment(index)} style={styles.attachmentChip}>
                <Text style={styles.attachmentText}>{attachment.label} ✕</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
        <View style={styles.row}>
          <TouchableOpacity disabled={attaching} onPress={() => void attachImage()} style={styles.iconButton}>
            <Text style={styles.iconText}>🖼️</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={attaching} onPress={() => void attachDocument()} style={styles.iconButton}>
            <Text style={styles.iconText}>📄</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={transcribing} onPress={() => void toggleRecording()} style={styles.iconButton}>
            {transcribing ? (
              <ActivityIndicator color="#f2f2f5" size="small" />
            ) : (
              <Text style={[styles.iconText, recording ? styles.iconTextActive : null]}>🎤</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity disabled={speaking} onPress={() => void speakLastReply()} style={styles.iconButton}>
            {speaking ? <ActivityIndicator color="#f2f2f5" size="small" /> : <Text style={styles.iconText}>🔊</Text>}
          </TouchableOpacity>
          <TextInput
            multiline
            onChangeText={setText}
            placeholder="Message Hermes…"
            placeholderTextColor="#5a5a66"
            style={styles.input}
            value={text}
          />
          {busy ? (
            <TouchableOpacity onPress={() => void stop()} style={[styles.sendButton, styles.stopButton]}>
              <Text style={styles.sendButtonText}>Stop</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            disabled={sending || (!text.trim() && attachments.length === 0)}
            onPress={() => void send()}
            style={styles.sendButton}
          >
            {sending ? (
              <ActivityIndicator color="#f2f2f5" size="small" />
            ) : (
              <Text style={styles.sendButtonText}>{busy ? 'Steer' : 'Send'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardStickyView>
  )
}

const styles = StyleSheet.create({
  attachmentChip: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 14,
    borderWidth: 1,
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
    color: '#8a8a99',
    fontSize: 12
  },
  container: {
    backgroundColor: '#0b0b0f',
    borderTopColor: '#2a2a33',
    borderTopWidth: StyleSheet.hairlineWidth
  },
  iconButton: {
    paddingHorizontal: 6,
    paddingVertical: 8
  },
  iconText: {
    fontSize: 18
  },
  iconTextActive: {
    opacity: 0.5
  },
  input: {
    color: '#f2f2f5',
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
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
    backgroundColor: '#1f6feb',
    borderRadius: 18,
    marginLeft: 4,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  sendButtonText: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '600'
  },
  stopButton: {
    backgroundColor: '#3a1f24'
  }
})
