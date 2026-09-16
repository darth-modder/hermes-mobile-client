// Dev-only screen for M15 round 9's hold-to-dictate device verification, in
// the same `app/dev/` namespace (and with the same dev-only-by-convention
// status) as `primitives.tsx`. Not a ported screen — no `Replicates:` comment.
//
// Exists because the emulator has no scriptable microphone, so the only way to
// drive the auto-send path on device is to seed the transcript that
// `/api/audio/transcribe` would have returned. The real guard is in
// `src/voice/dev-transcript-seam.ts`, which is inert outside `__DEV__` — this
// screen is only the way to reach it from `adb`:
//
//   adb shell am start -a android.intent.action.VIEW \
//     -d "hermes-android://dev/dictation-seam?text=hello%20there"
//
// `?clear=1` removes the override and puts real transcription back.
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { devTranscriptOverride, setDevTranscriptOverride } from '../../src/voice/dev-transcript-seam'

export default function DictationSeamScreen() {
  const { clear, text } = useLocalSearchParams<{ clear?: string; text?: string }>()
  const [applied, setApplied] = useState<null | string>(null)

  useEffect(() => {
    setDevTranscriptOverride(clear === '1' ? null : (text ?? null))
    setApplied(devTranscriptOverride())
  }, [clear, text])

  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Dictation transcript seam (__DEV__)</Text>
      <View style={styles.row}>
        <Text style={styles.label}>override</Text>
        <Text style={styles.value}>{applied === null ? '(none — real transcription)' : JSON.stringify(applied)}</Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    opacity: 0.6
  },
  root: {
    gap: 12,
    padding: 16
  },
  row: {
    gap: 4
  },
  title: {
    fontSize: 16,
    fontWeight: '600'
  },
  value: {
    fontSize: 14
  }
})
