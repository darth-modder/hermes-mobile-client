/**
 * Runtime capability check for the JS engine this app is running on (Hermes
 * on Android). The gateway client and websocket-url builder assume `URL`,
 * `URLSearchParams`, `AbortSignal` and `WebSocket` exist as globals, and
 * json-rpc-gateway.ts's request()/abort path used to assume `DOMException`
 * (patched out in sync-upstream.mjs — see AGENTS.md — precisely because it
 * can't be assumed).
 *
 * This module only detects; it doesn't polyfill. Once `app/runtime-check.tsx`
 * has run on a real device and recorded which globals are actually missing,
 * add `react-native-url-polyfill` as a dependency and import
 * 'react-native-url-polyfill/auto' at the top of index.ts (before
 * 'expo-router/entry') — only for the globals the on-device check found
 * missing, not speculatively.
 */

export interface RuntimeCapabilities {
  AbortSignal: boolean
  DOMException: boolean
  URL: boolean
  URLSearchParams: boolean
  WebSocket: boolean
}

export function checkRuntimeCapabilities(): RuntimeCapabilities {
  return {
    AbortSignal: typeof AbortSignal !== 'undefined',
    DOMException: typeof DOMException !== 'undefined',
    URL: typeof URL !== 'undefined',
    URLSearchParams: typeof URLSearchParams !== 'undefined',
    WebSocket: typeof WebSocket !== 'undefined'
  }
}
