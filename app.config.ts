import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Hermes',
  slug: 'hermes-android',
  scheme: 'hermes-android',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  android: {
    package: 'com.nousresearch.hermes.mobile',
    adaptiveIcon: {
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png'
    }
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
