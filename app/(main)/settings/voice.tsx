import { Stack } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { settingsHeaderOptions } from '../../../src/lib/settings-header'
import { useTheme } from '../../../src/theme/provider'
import { type } from '../../../src/theme/type'

type PermissionState = 'checking' | 'denied' | 'granted' | 'undetermined'

async function checkMicrophonePermission(): Promise<PermissionState> {
  const Audio = await import('expo-audio')
  const { status } = await Audio.getRecordingPermissionsAsync()

  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined'
}

export default function VoiceSettings() {
  const tokens = useTheme()
  const [permission, setPermission] = useState<PermissionState>('checking')

  const refresh = useCallback(() => {
    void checkMicrophonePermission().then(setPermission)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const requestPermission = async () => {
    const Audio = await import('expo-audio')

    await Audio.requestRecordingPermissionsAsync()
    refresh()
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...settingsHeaderOptions(tokens), title: 'Voice' }} />
      <View style={styles.content}>
        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Dictation</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
          Tap the mic in the composer to record; releasing it sends the clip to the backend for transcription and
          inserts the text into your message.
        </Text>
        <View style={[styles.row, { borderBottomColor: tokens.border }]}>
          <Text style={[styles.rowLabel, { color: tokens.foreground }]}>Microphone access</Text>
          <Text
            style={[
              styles.status,
              { color: permission === 'granted' ? tokens.semantic.green : tokens.semantic.yellow }
            ]}
          >
            {permission === 'checking' ? 'Checking…' : permission === 'granted' ? 'Granted' : 'Not granted'}
          </Text>
        </View>
        {permission !== 'granted' ? (
          <TouchableOpacity
            onPress={() => void requestPermission()}
            style={[styles.button, { backgroundColor: tokens.primary }]}
          >
            <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>Grant microphone access</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={[styles.sectionTitle, { color: tokens.foreground }]}>Spoken replies</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
          Tap the speaker in the composer to hear the assistant's latest reply, synthesized by the backend and played
          back on this device.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  buttonText: {
    ...type.bodySmall,
    fontWeight: '600',
    textAlign: 'center'
  },
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  rowLabel: {
    ...type.body
  },
  sectionHint: {
    ...type.caption,
    marginBottom: 8
  },
  sectionTitle: {
    ...type.label,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  status: {
    ...type.label,
    fontWeight: '600'
  }
})
