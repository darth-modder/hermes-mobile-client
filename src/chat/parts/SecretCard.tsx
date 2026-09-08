import { usePreventScreenCapture } from 'expo-screen-capture'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { respondSecret } from '../../gateway/session-connection'
import type { SecretRequest } from '../../gateway/session-stream-reducer'

export interface SecretCardProps {
  storedSessionId: string
  request: SecretRequest
}

/**
 * A skill credential capture (tools/skills_tool.py). The value is never
 * persisted anywhere in this app (not in the composer draft, not in
 * `messages`, not logged) and screenshots are blocked for as long as this
 * card is mounted — `expo-screen-capture`'s `usePreventScreenCapture` (M06
 * task line).
 */
export function SecretCard({ storedSessionId, request }: SecretCardProps) {
  usePreventScreenCapture('secret-card')

  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    setSending(true)

    try {
      await respondSecret(storedSessionId, request.requestId, value)
      setValue('')
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{request.envVar || 'Secret requested'}</Text>
      {request.prompt ? <Text style={styles.prompt}>{request.prompt}</Text> : null}
      <View style={styles.row}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending}
          onChangeText={setValue}
          onSubmitEditing={() => void submit()}
          placeholder="Value"
          placeholderTextColor="#5a5a66"
          secureTextEntry
          style={styles.input}
          value={value}
        />
        <TouchableOpacity disabled={sending || !value} onPress={() => void submit()} style={styles.button}>
          {sending ? <ActivityIndicator color="#f2f2f5" size="small" /> : <Text style={styles.buttonText}>Send</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '600'
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
  prompt: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 8
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  title: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  }
})
