// Vitest alias target for 'react-native/Libraries/Network/RCTNetworking'
// (cookie-clear.ts, D27). React Native's package.json restricts deep
// imports through its `exports` map, so Vite/Node can't resolve the real
// subpath at all under vitest — unlike a bare 'react-native' import
// (aliased to react-native-stub.ts), which Metro/Node CAN resolve at
// runtime, just not usefully for a unit test. This stub exists purely so
// the module resolves; individual tests override it with vi.mock to assert
// on calls, same as expo-secure-store / react-native-mmkv elsewhere.
export default {
  clearCookies(callback: (result: boolean) => void) {
    callback(true)
  }
}
