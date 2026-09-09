import { Stack } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SETTINGS_HEADER_OPTIONS } from '../../../src/lib/settings-header'

type PermissionState = 'checking' | 'denied' | 'granted' | 'undetermined'

async function checkMicrophonePermission(): Promise<PermissionState> {
  const Audio = await import('expo-audio')
  const { status } = await Audio.getRecordingPermissionsAsync()

  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined'
}

export default function VoiceSettings() {
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
    <SafeAreaView edges={['bottom']} style={styles.container}>
      <Stack.Screen options={{ ...SETTINGS_HEADER_OPTIONS, title: 'Voice' }} />
      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Dictation</Text>
        <Text style={styles.sectionHint}>
          Tap the mic in the composer to record; releasing it sends the clip to the backend for transcription and
          inserts the text into your message.
        </Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Microphone access</Text>
          <Text style={[styles.status, permission === 'granted' ? styles.statusGranted : styles.statusOther]}>
            {permission === 'checking' ? 'Checking…' : permission === 'granted' ? 'Granted' : 'Not granted'}
          </Text>
        </View>
        {permission !== 'granted' ? (
          <TouchableOpacity onPress={() => void requestPermission()} style={styles.button}>
            <Text style={styles.buttonText}>Grant microphone access</Text>
          </TouchableOpacity>
        ) : null}

        <Text style={styles.sectionTitle}>Spoken replies</Text>
        <Text style={styles.sectionHint}>
          Tap the speaker in the composer to hear the assistant's latest reply, synthesized by the backend and played
          back on this device.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1f6feb',
    borderRadius: 10,
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  buttonText: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center'
  },
  container: {
    backgroundColor: '#0b0b0f',
    flex: 1
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12
  },
  row: {
    alignItems: 'center',
    borderBottomColor: '#2a2a33',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12
  },
  rowLabel: {
    color: '#f2f2f5',
    fontSize: 15
  },
  sectionHint: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 8
  },
  sectionTitle: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    textTransform: 'uppercase'
  },
  status: {
    fontSize: 13,
    fontWeight: '600'
  },
  statusGranted: {
    color: '#3fb950'
  },
  statusOther: {
    color: '#e3b341'
  }
})
