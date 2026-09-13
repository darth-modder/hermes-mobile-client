import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { respondClarify } from '../../gateway/session-connection'
import type { ClarifyQuestion, ClarifyRequest } from '../../gateway/session-stream-reducer'
import { hapticSubmit } from '../../lib/haptics'
import {
  CLARIFY_CARD_ANSWER_PLACEHOLDER,
  CLARIFY_CARD_BATCH_TITLE,
  CLARIFY_CARD_SINGLE_TITLE
} from '../../lib/strings.mobile'
import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

interface OneClarifyQuestionProps {
  storedSessionId: string
  requestId: string
  question: ClarifyQuestion
  lockedAnswer?: string
}

function OneClarifyQuestion({ storedSessionId, requestId, question, lockedAnswer }: OneClarifyQuestionProps) {
  const tokens = useTheme()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const locked = lockedAnswer !== undefined

  const respond = async (answer: string) => {
    hapticSubmit()
    setSending(true)

    try {
      await respondClarify(storedSessionId, requestId, answer, question.qid)
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.question}>
      <Text style={[styles.questionText, { color: tokens.foreground }]}>{question.question}</Text>
      {locked ? (
        <Text style={[styles.lockedAnswer, { color: tokens.semantic.green }]}>✓ {lockedAnswer}</Text>
      ) : question.choices?.length ? (
        <View style={styles.row}>
          {question.choices.map(choice => (
            <TouchableOpacity
              disabled={sending}
              key={choice}
              onPress={() => void respond(choice)}
              style={[styles.choiceButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={[styles.choiceText, { color: tokens.primaryForeground }]}>{choice}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.row}>
          <TextInput
            editable={!sending}
            onChangeText={setText}
            onSubmitEditing={() => text.trim() && void respond(text.trim())}
            placeholder={CLARIFY_CARD_ANSWER_PLACEHOLDER}
            placeholderTextColor={tokens.mutedForeground}
            style={[
              styles.input,
              { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
            ]}
            value={text}
          />
          <TouchableOpacity
            disabled={sending || !text.trim()}
            onPress={() => void respond(text.trim())}
            style={[styles.sendButton, { backgroundColor: tokens.primary }]}
          >
            {sending ? (
              <ActivityIndicator color={tokens.primaryForeground} size="small" />
            ) : (
              <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

export interface ClarifyCardProps {
  storedSessionId: string
  request: ClarifyRequest
}

/** A clarify question (or batch of them) blocking the agent thread until
 *  `clarify.respond` answers every one. */
export function ClarifyCard({ storedSessionId, request }: ClarifyCardProps) {
  const tokens = useTheme()
  const isBatch = request.questions.length > 0

  return (
    <View style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.border }]}>
      <Text style={[styles.title, { color: tokens.foreground }]}>
        {isBatch ? CLARIFY_CARD_BATCH_TITLE : CLARIFY_CARD_SINGLE_TITLE}
      </Text>
      {isBatch ? (
        request.questions.map(question => (
          <OneClarifyQuestion
            key={question.qid}
            lockedAnswer={request.lockedAnswers?.[question.qid]}
            question={question}
            requestId={request.requestId}
            storedSessionId={storedSessionId}
          />
        ))
      ) : (
        <OneClarifyQuestion
          question={{ choices: request.choices, multiSelect: request.multiSelect, qid: '', question: request.question }}
          requestId={request.requestId}
          storedSessionId={storedSessionId}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  buttonText: {
    ...type.label,
    fontWeight: '600'
  },
  choiceButton: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  choiceText: {
    ...type.label
  },
  container: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginVertical: 6,
    padding: 12
  },
  input: {
    borderRadius: radius.control,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  lockedAnswer: {
    ...type.label
  },
  question: {
    marginVertical: 4
  },
  questionText: {
    ...type.bodySmall,
    marginBottom: 6
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sendButton: {
    alignItems: 'center',
    borderRadius: radius.full,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  title: {
    ...type.label,
    fontWeight: '700',
    marginBottom: 6
  }
})
