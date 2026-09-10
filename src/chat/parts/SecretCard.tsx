import { usePreventScreenCapture } from 'expo-screen-capture'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { respondSecret } from '../../gateway/session-connection'
import type { SecretRequest } from '../../gateway/session-stream-reducer'
import { useTheme } from '../../theme/provider'

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

  const tokens = useTheme()
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
    <View style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.border }]}>
      <Text style={[styles.title, { color: tokens.foreground }]}>{request.envVar || 'Secret requested'}</Text>
      {request.prompt ? <Text style={[styles.prompt, { color: tokens.mutedForeground }]}>{request.prompt}</Text> : null}
      <View style={styles.row}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending}
          onChangeText={setValue}
          onSubmitEditing={() => void submit()}
          placeholder="Value"
          placeholderTextColor={tokens.textTertiary}
          secureTextEntry
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
          value={value}
        />
        <TouchableOpacity
          disabled={sending || !value}
          onPress={() => void submit()}
          style={[styles.button, { backgroundColor: tokens.primary }]}
        >
          {sending ? (
            <ActivityIndicator color={tokens.primaryForeground} size="small" />
          ) : (
            <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600'
  },
  container: {
    borderRadius: 8,
    borderWidth: 1,
    marginVertical: 6,
    padding: 12
  },
  input: {
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  prompt: {
    fontSize: 12,
    marginBottom: 8
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4
  }
})
