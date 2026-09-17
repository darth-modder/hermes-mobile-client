import type { ExpoConfig } from 'expo/config'

import { APP_NAME, APP_SLUG } from './src/lib/app-identity.ts'

// D18's hide switch (M14 Deviation 9 / D18): a public build removes the six
// inert screens' drawer and settings rows (src/components/drawer-rows.ts,
// settings-rows.ts read this the same way); an internal build (dev, Play
// internal track equivalent, tester APKs) keeps them visible. Read in this
// one place only, via `extra.audience`. Defaults to 'internal' so a plain
// `expo start`/`expo run:android` keeps every screen visible; the release
// build script sets `APP_AUDIENCE=public` explicitly (scripts/build-release-
// apk.sh, docs/RELEASING.md).
const audience: 'internal' | 'public' = process.env.APP_AUDIENCE === 'public' ? 'public' : 'internal'

const config: ExpoConfig = {
  name: APP_NAME,
  slug: APP_SLUG,
  scheme: 'hermes-android',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.symbyotic.hermes.mobile',
    predictiveBackGestureEnabled: true,
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png'
    }
  },
  ios: {
    bundleIdentifier: 'com.symbyotic.hermes.mobile'
  },
  extra: {
    audience
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    'expo-secure-store',
    'expo-web-browser',
    'expo-document-picker',
    'expo-file-system',
    'expo-sharing',
    'expo-font',
    [
      'expo-camera',
      {
        cameraPermission: 'Hermes uses the camera to scan a connection QR code.'
      }
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Hermes uses your photos to attach images to a chat message.'
      }
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0B0B0F'
      }
    ],
    [
      'expo-notifications',
      {
        color: '#0B0B0F'
      }
    ],
    [
      'expo-audio',
      {
        microphonePermission: 'Hermes uses the microphone to transcribe voice messages.'
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  }
}

export default config
