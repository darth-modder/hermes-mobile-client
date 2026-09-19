// React Native internal modules that ship no type declarations of their
// own. Kept to exactly the members this app actually calls.

// src/net/auth/cookie-clear.ts (D27): the only way to clear the native
// cookie jar without adding a new native module — see that file's header.
declare module 'react-native/Libraries/Network/RCTNetworking' {
  const RCTNetworking: {
    clearCookies(callback: (result: boolean) => void): void
  }

  export default RCTNetworking
}
