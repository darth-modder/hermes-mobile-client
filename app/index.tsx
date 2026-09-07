import { StyleSheet, Text, View } from 'react-native'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hermes</Text>
      <Text style={styles.subtitle}>Thin client scaffold — M01</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0b0b0f',
    flex: 1,
    justifyContent: 'center'
  },
  subtitle: {
    color: '#8a8a99',
    fontSize: 14,
    marginTop: 8
  },
  title: {
    color: '#f2f2f5',
    fontSize: 28,
    fontWeight: '600'
  }
})
