import { useStore } from '@nanostores/react'
import { Stack } from 'expo-router'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { SETTINGS_HEADER_OPTIONS } from '../../../src/lib/settings-header'
import { $backendSkins } from '../../../src/theme/backend-skin'
import { useTheme } from '../../../src/theme/provider'
import {
  $modeOverride,
  $skinName,
  listAllSkins,
  type ModeOverride,
  resolveSkinTheme,
  setModeOverride,
  setSkinName
} from '../../../src/theme/skin-selection'
import type { DesktopTheme } from '../../../src/upstream/themes/types'

const MODE_OPTIONS: { label: string; value: ModeOverride }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' }
]

function Swatch({ color }: { color: string }) {
  return <View style={[styles.swatch, { backgroundColor: color }]} />
}

function SkinRow({ active, theme }: { active: boolean; theme: DesktopTheme }) {
  const tokens = useTheme()
  const preview = theme.colors

  return (
    <TouchableOpacity
      accessibilityLabel={`Select ${theme.label} skin`}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      onPress={() => setSkinName(theme.name)}
      style={[styles.skinRow, { borderColor: tokens.border }]}
    >
      <View style={styles.swatches}>
        <Swatch color={preview.background} />
        <Swatch color={preview.card} />
        <Swatch color={preview.primary} />
        <Swatch color={preview.userBubble ?? preview.secondary} />
      </View>
      <View style={styles.skinLabels}>
        <Text style={[styles.skinLabel, { color: tokens.foreground }]}>{theme.label}</Text>
        <Text style={[styles.skinDescription, { color: tokens.mutedForeground }]}>{theme.description}</Text>
      </View>
      {active ? <Text style={[styles.checkmark, { color: tokens.primary }]}>✓</Text> : null}
    </TouchableOpacity>
  )
}

export default function AppearanceSettings() {
  const tokens = useTheme()
  const skinName = useStore($skinName)
  const modeOverride = useStore($modeOverride)
  const backendSkins = useStore($backendSkins)

  const skins = listAllSkins(backendSkins)
  const activeTheme = resolveSkinTheme(skinName, backendSkins)

  return (
    <SafeAreaView edges={['bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <Stack.Screen options={{ ...SETTINGS_HEADER_OPTIONS, title: 'Appearance' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionTitle, { color: tokens.mutedForeground }]}>Appearance mode</Text>
        <View style={[styles.modeRow, { borderColor: tokens.border }]}>
          {MODE_OPTIONS.map(option => {
            const selected = option.value === modeOverride

            return (
              <TouchableOpacity
                accessibilityLabel={`${option.label} appearance mode`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                key={option.value}
                onPress={() => setModeOverride(option.value)}
                style={[styles.modeOption, { backgroundColor: selected ? tokens.primary : 'transparent' }]}
              >
                <Text
                  style={[styles.modeOptionLabel, { color: selected ? tokens.primaryForeground : tokens.foreground }]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: tokens.mutedForeground }]}>Skin</Text>
        <Text style={[styles.sectionHint, { color: tokens.mutedForeground }]}>
          Matches the desktop app's skins. The backend's active skin ({activeTheme.label}) applies automatically the
          first time it changes; pick a different one here to override it on this device.
        </Text>
        {skins.map(theme => (
          <SkinRow active={theme.name === skinName} key={theme.name} theme={theme} />
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8
  },
  container: {
    flex: 1
  },
  content: {
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 12
  },
  modeOption: {
    alignItems: 'center',
    borderRadius: 8,
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: 10
  },
  modeOptionLabel: {
    fontSize: 14,
    fontWeight: '600'
  },
  modeRow: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 4,
    marginBottom: 20,
    padding: 4
  },
  sectionHint: {
    fontSize: 12,
    marginBottom: 12
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 20,
    textTransform: 'uppercase'
  },
  skinDescription: {
    fontSize: 12,
    marginTop: 2
  },
  skinLabel: {
    fontSize: 15,
    fontWeight: '600'
  },
  skinLabels: {
    flex: 1
  },
  skinRow: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    minHeight: 48,
    padding: 12
  },
  swatch: {
    borderRadius: 4,
    height: 16,
    width: 16
  },
  swatches: {
    flexDirection: 'row',
    gap: 4
  }
})
