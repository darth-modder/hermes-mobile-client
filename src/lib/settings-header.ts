// Shared native-header look for every screen under app/(main)/settings/**.
// The (main) stack hides headers by default (app/(main)/_layout.tsx:
// `screenOptions={{ headerShown: false }}`) — a settings sub-screen needs its
// own header restored explicitly (`headerShown: true`) to get a visible
// title and back affordance, styled to match the app's dark theme rather
// than the platform default.

export const SETTINGS_HEADER_OPTIONS = {
  headerShown: true,
  headerStyle: { backgroundColor: '#0b0b0f' },
  headerTintColor: '#f2f2f5'
} as const
