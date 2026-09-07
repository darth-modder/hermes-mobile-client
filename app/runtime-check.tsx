import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'

import { checkRuntimeCapabilities, type RuntimeCapabilities } from '../src/polyfills'

export default function RuntimeCheckScreen() {
  const [capabilities, setCapabilities] = useState<null | RuntimeCapabilities>(null)

  useEffect(() => {
    const result = checkRuntimeCapabilities()

    setCapabilities(result)
    console.log('[runtime-check]', JSON.stringify(result))
  }, [])

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Hermes engine runtime check</Text>
      {capabilities === null ? (
        <Text style={styles.row}>Running…</Text>
      ) : (
        Object.entries(capabilities).map(([name, present]) => (
          <View key={name} style={styles.row}>
            <Text style={[styles.status, present ? styles.present : styles.missing]}>
              {present ? 'PRESENT' : 'MISSING'}
            </Text>
            <Text style={styles.name}>{name}</Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0b0b0f',
    flexGrow: 1,
    padding: 24
  },
  missing: {
    color: '#e5484d'
  },
  name: {
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 15
  },
  present: {
    color: '#3dd68c'
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 6
  },
  status: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    width: 76
  },
  title: {
    color: '#f2f2f5',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16
  }
})
