import { useStore } from '@nanostores/react'
import { FlashList, type FlashListRef } from '@shopify/flash-list'
import { memo, useEffect, useMemo, useRef } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

import { $clarifyRequests } from '../store/clarify'
import { $approvalRequests, $secretRequests, $sudoRequests } from '../store/prompts'
import { $scrollToBottomRequests } from '../store/scroll'
import { $todosBySession } from '../store/todos'
import type { ChatMessage, ChatMessagePart } from '../upstream/lib/chat-messages'

import { ApprovalCard } from './parts/ApprovalCard'
import { ClarifyCard } from './parts/ClarifyCard'
import { ReasoningDisclosure } from './parts/ReasoningDisclosure'
import { SecretCard } from './parts/SecretCard'
import { SudoCard } from './parts/SudoCard'
import { TextPart } from './parts/TextPart'
import { TodoPanel } from './parts/TodoPanel'
import { ToolCallCard } from './parts/ToolCallCard'

function MessagePart({ part }: { part: ChatMessagePart }) {
  if (part.type === 'text' || part.type === 'reasoning') {
    return part.type === 'reasoning' ? <ReasoningDisclosure text={part.text} /> : <TextPart text={part.text} />
  }

  if (part.type === 'tool-call') {
    return (
      <ToolCallCard
        part={{
          args: part.args,
          completedAt: part.completedAt,
          isError: part.isError,
          result: part.result,
          toolCallId: part.toolCallId,
          toolName: part.toolName
        }}
      />
    )
  }

  return null
}

function roleStyleFor(role: ChatMessage['role']): { bubble: object; row: object } {
  if (role === 'user') {
    return { bubble: styles.userBubble, row: styles.userRow }
  }

  if (role === 'system') {
    return { bubble: styles.systemBubble, row: styles.systemRow }
  }

  return { bubble: styles.assistantBubble, row: styles.assistantRow }
}

/**
 * Per-message render counts, dev-only — the structural half of M06's perf
 * criterion ("tail-only re-render on streaming deltas") needs instrumented
 * counts, not "it looked smooth" (Opus's M06 review). `MessageBubble` is
 * `memo`'d on `message` identity, and the reducer only ever produces a NEW
 * object reference for the message actually being mutated (every other
 * entry in `session.messages` keeps its old reference across a flush) — so
 * an already-settled message's count should stay flat while only the
 * streaming tail's count climbs. Logged (not just counted) so it shows up
 * in `adb logcat` during a live on-device session without needing a
 * debugger attached.
 */
export const messageRenderCounts: Record<string, number> = {}

const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const roleStyle = roleStyleFor(message.role)

  if (__DEV__) {
    messageRenderCounts[message.id] = (messageRenderCounts[message.id] ?? 0) + 1
    console.log(`[render-count] ${message.id} -> ${messageRenderCounts[message.id]}`)
  }

  return (
    <View style={roleStyle.row}>
      <View style={[styles.bubble, roleStyle.bubble]}>
        {message.parts.map((part, index) => (
          <MessagePart key={index} part={part} />
        ))}
        {message.attachmentRefs?.length ? (
          <Text style={styles.attachments}>{message.attachmentRefs.join('  ')}</Text>
        ) : null}
        {message.pending ? <ActivityIndicator color="#8a8a99" size="small" style={styles.pendingSpinner} /> : null}
        {message.error ? <Text style={styles.error}>{message.error}</Text> : null}
      </View>
    </View>
  )
})

export interface TranscriptProps {
  storedSessionId: string
  messages: ChatMessage[]
}

/**
 * The message list: inverted FlashList so new content appears at the visual
 * bottom without re-measuring the whole scroll range, plus the per-session
 * blocking-input cards and todo panel anchored just above the composer
 * (`ListHeaderComponent` — inverted, so "header" is the visual bottom edge).
 */
export function Transcript({ storedSessionId, messages }: TranscriptProps) {
  const listRef = useRef<FlashListRef<ChatMessage>>(null)

  const clarify = useStore($clarifyRequests)[storedSessionId]
  const approval = useStore($approvalRequests)[storedSessionId]
  const sudo = useStore($sudoRequests)[storedSessionId]
  const secret = useStore($secretRequests)[storedSessionId]
  const todos = useStore($todosBySession)[storedSessionId] ?? []
  const scrollRequestCount = useStore($scrollToBottomRequests)[storedSessionId] ?? 0

  // Inverted list: index 0 is the visual bottom (newest), so `data` is the
  // reverse of message order — matches every other inverted chat list.
  const data = useMemo(() => [...messages].reverse(), [messages])

  useEffect(() => {
    if (scrollRequestCount > 0) {
      listRef.current?.scrollToOffset({ animated: true, offset: 0 })
    }
  }, [scrollRequestCount])

  return (
    <FlashList
      contentContainerStyle={styles.content}
      data={data}
      inverted
      keyExtractor={message => message.id}
      ListHeaderComponent={
        secret || sudo || approval || clarify || todos.length > 0 ? (
          <View>
            {secret ? <SecretCard request={secret} storedSessionId={storedSessionId} /> : null}
            {sudo ? <SudoCard request={sudo} storedSessionId={storedSessionId} /> : null}
            {approval ? <ApprovalCard request={approval} storedSessionId={storedSessionId} /> : null}
            {clarify ? <ClarifyCard request={clarify} storedSessionId={storedSessionId} /> : null}
            <TodoPanel todos={todos} />
          </View>
        ) : null
      }
      maintainVisibleContentPosition={{ autoscrollToBottomThreshold: 0.2 }}
      ref={listRef}
      renderItem={({ item }) => <MessageBubble message={item} />}
    />
  )
}

const styles = StyleSheet.create({
  assistantBubble: {
    backgroundColor: '#17171d'
  },
  assistantRow: {
    alignItems: 'flex-start'
  },
  attachments: {
    color: '#58a6ff',
    fontSize: 12,
    marginTop: 4
  },
  bubble: {
    borderRadius: 10,
    maxWidth: '92%',
    padding: 10
  },
  content: {
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  error: {
    color: '#e06c75',
    fontSize: 13,
    marginTop: 4
  },
  pendingSpinner: {
    alignSelf: 'flex-start',
    marginTop: 4
  },
  systemBubble: {
    backgroundColor: 'transparent'
  },
  systemRow: {
    alignItems: 'center'
  },
  userBubble: {
    backgroundColor: '#1f3a5f'
  },
  userRow: {
    alignItems: 'flex-end'
  }
})
