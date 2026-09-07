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
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0B0B0F'
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  }
}

export default config
