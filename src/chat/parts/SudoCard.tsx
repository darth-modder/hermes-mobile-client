import { usePreventScreenCapture } from 'expo-screen-capture'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { respondSudo } from '../../gateway/session-connection'
import type { SudoRequest } from '../../gateway/session-stream-reducer'
import { hapticSubmit } from '../../lib/haptics'
import { useTheme } from '../../theme/provider'
import { type } from '../../theme/type'

export interface SudoCardProps {
  storedSessionId: string
  request: SudoRequest
}

/** A terminal command asked for `sudo` mid-turn — never persisted, never
 *  logged; screenshots are blocked for as long as this card is on screen. */
export function SudoCard({ storedSessionId, request }: SudoCardProps) {
  usePreventScreenCapture('sudo-card')

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
    <View style={[styles.container, { backgroundColor: tokens.widgetSurface, borderColor: tokens.border }]}>
      <Text style={[styles.title, { color: tokens.foreground }]}>Sudo password requested</Text>
      <View style={styles.row}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          placeholder="Password"
          placeholderTextColor={tokens.mutedForeground}
          secureTextEntry
          style={[
            styles.input,
            { backgroundColor: tokens.input, borderColor: tokens.border, color: tokens.foreground }
          ]}
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
    ...type.label,
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  title: {
    ...type.label,
    fontWeight: '700',
    marginBottom: 8
  }
})
