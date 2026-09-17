import Constants from 'expo-constants'

// D18's hide switch. `app.config.ts`'s own header comment: "Read in one
// place... so drawer and settings rows can't disagree" — this is that one
// place. `drawer-rows.ts` and `settings-rows.ts` only need the `Audience`
// type (a type-only import erases at compile time), never this module's
// runtime `expo-constants` read, so their own vitest tests stay
// framework-free the same way `register.ts` stays free of `expo-constants`
// itself (see that file's header) even though its sibling `usePushRegistration.ts` reads it.
export type Audience = 'internal' | 'public'

export function getAudience(): Audience {
  return Constants.expoConfig?.extra?.audience === 'public' ? 'public' : 'internal'
}
