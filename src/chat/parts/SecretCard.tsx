import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { respondSecret } from '../../gateway/session-connection'
import type { SecretRequest } from '../../gateway/session-stream-reducer'
import { hapticSubmit } from '../../lib/haptics'
import { t } from '../../lib/t'
import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

export interface SecretCardProps {
  request: SecretRequest
}

/**
 * A skill credential capture (tools/skills_tool.py). Split into Body/Actions
 * (D25) — the value field and Send button live in Actions, which
 * InputDock.tsx keeps outside the scrollable area. The value is never
 * persisted anywhere in this app (not in the composer draft, not in
 * `messages`, not logged).
 */
export function SecretCardBody({ request }: SecretCardProps) {
  const tokens = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.border }]}>
      <Text style={[styles.title, { color: tokens.foreground }]}>{request.envVar || t.prompts.secretTitle}</Text>
      {request.prompt ? <Text style={[styles.prompt, { color: tokens.mutedForeground }]}>{request.prompt}</Text> : null}
    </View>
  )
}

export interface SecretCardActionsProps extends SecretCardProps {
  storedSessionId: string
}

export function SecretCardActions({ storedSessionId, request }: SecretCardActionsProps) {
  const tokens = useTheme()
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    hapticSubmit()
    setSending(true)

    try {
      await respondSecret(storedSessionId, request.requestId, value)
      setValue('')
    } finally {
      setSending(false)
    }
  }

  return (
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
        style={[styles.input, { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }]}
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
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    ...type.label,
    fontWeight: '600'
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
  prompt: {
    ...type.caption
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  title: {
    ...type.label,
    fontWeight: '700'
  }
})
