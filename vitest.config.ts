import path from 'node:path'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'expo-haptics': path.resolve(__dirname, 'src/test/expo-haptics-stub.ts'),
      // React Native's package.json `exports` map blocks Vite/Node from
      // resolving this deep subpath at all under vitest (unlike the bare
      // 'react-native' alias below) — see rct-networking-stub.ts's header.
      'react-native/Libraries/Network/RCTNetworking': path.resolve(__dirname, 'src/test/rct-networking-stub.ts'),
      'react-native': path.resolve(__dirname, 'src/test/react-native-stub.ts')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
