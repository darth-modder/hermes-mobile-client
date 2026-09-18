import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { respondSudo } from '../../gateway/session-connection'
import type { SudoRequest } from '../../gateway/session-stream-reducer'
import { hapticSubmit } from '../../lib/haptics'
import { t } from '../../lib/t'
import { useTheme } from '../../theme/provider'
import { radius, type } from '../../theme/type'

export interface SudoCardProps {
  request: SudoRequest
}

/** A terminal command asked for `sudo` mid-turn. Split into Body/Actions
 *  (D25) — the password field and Send button live in Actions, which
 *  InputDock.tsx keeps outside the scrollable area. */
export function SudoCardBody(_props: SudoCardProps) {
  const tokens = useTheme()

  return (
    <View style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.border }]}>
      <Text style={[styles.title, { color: tokens.foreground }]}>{t.prompts.sudoTitle}</Text>
    </View>
  )
}

export interface SudoCardActionsProps extends SudoCardProps {
  storedSessionId: string
}

export function SudoCardActions({ storedSessionId, request }: SudoCardActionsProps) {
  const tokens = useTheme()
  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    hapticSubmit()
    setSending(true)

    try {
      await respondSudo(storedSessionId, request.requestId, password)
      setPassword('')
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
        onChangeText={setPassword}
        onSubmitEditing={() => void submit()}
        placeholder={t.prompts.sudoPlaceholder}
        placeholderTextColor={tokens.mutedForeground}
        secureTextEntry
        style={[styles.input, { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }]}
        value={password}
      />
      <TouchableOpacity
        disabled={sending || !password}
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
