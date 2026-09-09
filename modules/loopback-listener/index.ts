// Typed wrapper over the native module — see android/.../LoopbackListenerModule.kt for the
// protocol. Android-only (expo-module.config.json declares no "apple" platform); iOS is M12.
//
// Not a bare-specifier npm package (this app is its only consumer) — imported by relative path
// from src/net/auth/loopback-listener.ts, which is why there's no dependency entry for it in
// the root package.json. Metro transforms it like any other project TypeScript file because it
// lives outside node_modules.

import { requireNativeModule } from 'expo-modules-core'

interface LoopbackListenerNativeModule {
  /** Binds a ServerSocket to 127.0.0.1 on a random free port; returns the port. */
  start(): Promise<number>
  /** Blocks (2-minute lifetime) for the browser's single GET, then resolves with its raw
   *  query parameters. Throws ERR_LOOPBACK_TIMEOUT / ERR_LOOPBACK_CANCELLED / ERR_LOOPBACK_REQUEST
   *  / ERR_LOOPBACK_NOT_STARTED — see native-login.ts for how callers should treat each. */
  waitForCallback(): Promise<Record<string, string>>
  /** Closes the listener early — cancels a pending waitForCallback() with ERR_LOOPBACK_CANCELLED. */
  stop(): Promise<void>
}

export default requireNativeModule<LoopbackListenerNativeModule>('LoopbackListener')
