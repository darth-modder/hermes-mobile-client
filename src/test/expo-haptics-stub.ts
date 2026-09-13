// Vitest alias target for 'expo-haptics'. Unlike react-native-stub.ts's
// native-only globals (which pure logic must never touch), a haptic is a
// best-effort side effect that production code paths under test legitimately
// call (session-connection.ts's dispatchEffects, Composer's send(),
// ApprovalCard's respond(), notify()'s error path) — importing the real
// package pulls in expo-modules-core, which references the RN/Metro global
// `__DEV__` at import time and throws under plain Node. These succeed
// silently instead of failing loudly, so exercising those code paths in a
// test doesn't require mocking every call site individually.

export enum ImpactFeedbackStyle {
  Light = 'light',
  Medium = 'medium',
  Heavy = 'heavy',
  Rigid = 'rigid',
  Soft = 'soft'
}

export enum NotificationFeedbackType {
  Error = 'error',
  Success = 'success',
  Warning = 'warning'
}

export async function impactAsync(): Promise<void> {}

export async function notificationAsync(): Promise<void> {}

export async function selectionAsync(): Promise<void> {}
