// Every custom font this app bundles, loaded once via expo-font. Mounted in
// app/_layout.tsx, which renders nothing until this resolves — a local TTF
// loads in well under a frame, so gating the first paint on it is cheaper
// than a flash of tofu-box icons or the system fallback mono face.
//
// 'JetBrainsMono' (regular) and 'JetBrainsMono-Bold' are two distinct family
// names, not one family with a bold variant: React Native does not
// synthesise a bold weight for a custom font from fontWeight alone the way
// it does for system fonts, so src/theme/type.ts's `mono` role picks between
// them directly rather than setting fontWeight on a single family.

import { isLoaded, useFonts } from 'expo-font'
import { useEffect } from 'react'

export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    codicon: require('../../assets/fonts/codicon.ttf'),
    'JetBrainsMono-Bold': require('../../assets/fonts/JetBrainsMono-Bold.ttf'),
    JetBrainsMono: require('../../assets/fonts/JetBrainsMono-Regular.ttf')
  })

  // M13 exit criterion (D15.2, reworded): a direct, logcat-visible read of
  // the same fact a screenshot glyph check was standing in for.
  useEffect(() => {
    if (loaded && __DEV__) {
      console.log(`fonts: Font.isLoaded('JetBrainsMono') = ${isLoaded('JetBrainsMono')}`)
    }
  }, [loaded])

  return loaded
}
