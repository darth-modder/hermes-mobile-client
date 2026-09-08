import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { respondClarify } from '../../gateway/session-connection'
import type { ClarifyQuestion, ClarifyRequest } from '../../gateway/session-stream-reducer'

interface OneClarifyQuestionProps {
  storedSessionId: string
  requestId: string
  question: ClarifyQuestion
  lockedAnswer?: string
}

function OneClarifyQuestion({ storedSessionId, requestId, question, lockedAnswer }: OneClarifyQuestionProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const locked = lockedAnswer !== undefined

  const respond = async (answer: string) => {
    setSending(true)

    try {
      await respondClarify(storedSessionId, requestId, answer, question.qid)
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.question}>
      <Text style={styles.questionText}>{question.question}</Text>
      {locked ? (
        <Text style={styles.lockedAnswer}>✓ {lockedAnswer}</Text>
      ) : question.choices?.length ? (
        <View style={styles.row}>
          {question.choices.map(choice => (
            <TouchableOpacity
              disabled={sending}
              key={choice}
              onPress={() => void respond(choice)}
              style={styles.choiceButton}
            >
              <Text style={styles.choiceText}>{choice}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.row}>
          <TextInput
            editable={!sending}
            onChangeText={setText}
            onSubmitEditing={() => text.trim() && void respond(text.trim())}
            placeholder="Type an answer…"
            placeholderTextColor="#5a5a66"
            style={styles.input}
            value={text}
          />
          <TouchableOpacity
            disabled={sending || !text.trim()}
            onPress={() => void respond(text.trim())}
            style={styles.sendButton}
          >
            {sending ? <ActivityIndicator color="#f2f2f5" size="small" /> : <Text style={styles.buttonText}>Send</Text>}
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
  const isBatch = request.questions.length > 0

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{isBatch ? 'A few questions' : 'Question'}</Text>
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
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '600'
  },
  choiceButton: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  choiceText: {
    color: '#f2f2f5',
    fontSize: 13
  },
  container: {
    backgroundColor: '#14181c',
    borderColor: '#2a2a33',
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
    padding: 12
  },
  input: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 6,
    borderWidth: 1,
    color: '#f2f2f5',
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  lockedAnswer: {
    color: '#3dd68c',
    fontSize: 13
  },
  question: {
    marginVertical: 4
  },
  questionText: {
    color: '#f2f2f5',
    fontSize: 14,
    marginBottom: 6
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  sendButton: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  title: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6
  }
})
