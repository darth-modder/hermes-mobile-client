// Vitest alias target for 'react-native'. Pure logic under test (transport, reducers) must never
// need real react-native APIs; anything imported from here should fail loudly rather than run
// against a fake implementation.
const fail = (name: string) => () => {
  throw new Error(`react-native.${name} was called from a unit test — pure logic must not depend on react-native`)
}

export const Platform = { OS: 'android', select: fail('Platform.select') }
export const NativeModules = {}
export const AppState = { addEventListener: fail('AppState.addEventListener'), currentState: 'active' }
