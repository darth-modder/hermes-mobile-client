import { usePreventScreenCapture } from 'expo-screen-capture'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { respondSudo } from '../../gateway/session-connection'
import type { SudoRequest } from '../../gateway/session-stream-reducer'

export interface SudoCardProps {
  storedSessionId: string
  request: SudoRequest
}

/** A terminal command asked for `sudo` mid-turn — never persisted, never
 *  logged; screenshots are blocked for as long as this card is on screen. */
export function SudoCard({ storedSessionId, request }: SudoCardProps) {
  usePreventScreenCapture('sudo-card')

  const [password, setPassword] = useState('')
  const [sending, setSending] = useState(false)

  const submit = async () => {
    setSending(true)

    try {
      await respondSudo(storedSessionId, request.requestId, password)
      setPassword('')
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sudo password requested</Text>
      <View style={styles.row}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending}
          onChangeText={setPassword}
          onSubmitEditing={() => void submit()}
          placeholder="Password"
          placeholderTextColor="#5a5a66"
          secureTextEntry
          style={styles.input}
          value={password}
        />
        <TouchableOpacity disabled={sending || !password} onPress={() => void submit()} style={styles.button}>
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8
  },
  title: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8
  }
})
