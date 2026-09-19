import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'expo-haptics': path.resolve(__dirname, 'src/test/expo-haptics-stub.ts'),
      'react-native': path.resolve(__dirname, 'src/test/react-native-stub.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
