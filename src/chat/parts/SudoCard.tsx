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
  const [pending, setPending] = useState<'cancel' | 'send' | null>(null)

  const submit = async () => {
    hapticSubmit()
    setPending('send')

    try {
      await respondSudo(storedSessionId, request.requestId, password)
      setPassword('')
    } finally {
      setPending(null)
    }
  }

  // D26: Cancel sends the SAME sudo.respond RPC with an empty password —
  // upstream (tui_gateway/agent_callbacks.py, apps/desktop's prompt-
  // overlays.tsx) already treats an empty response as a definite "no" (a
  // failed sudo, no command runs), so there's no separate cancel RPC to
  // call. The turn continues — this only resolves the one blocked prompt,
  // it does not stop the agent (that's Stop, a different control).
  const cancel = async () => {
    hapticSubmit()
    setPending('cancel')

    try {
      await respondSudo(storedSessionId, request.requestId, '')
      setPassword('')
    } finally {
      setPending(null)
    }
  }

  const sending = pending !== null

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
        disabled={sending}
        onPress={() => void cancel()}
        style={[styles.button, { backgroundColor: tokens.bgTertiary }]}
      >
        {pending === 'cancel' ? (
          <ActivityIndicator color={tokens.foreground} size="small" />
        ) : (
          <Text style={[styles.buttonText, { color: tokens.foreground }]}>{t.common.cancel}</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity
        disabled={sending || !password}
        onPress={() => void submit()}
        style={[styles.button, { backgroundColor: tokens.primary }]}
      >
        {pending === 'send' ? (
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
