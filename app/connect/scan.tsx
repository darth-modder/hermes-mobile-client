import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { setActiveConnection } from '../../src/connections/registry'
import { setConnectionToken } from '../../src/connections/secure'
import type { MobileConnection } from '../../src/connections/types'
import {
  CONNECT_CAMERA_ACCESS_NEEDED,
  CONNECT_GRANT_CAMERA_ACCESS,
  CONNECT_SCAN_INVALID_CODE,
  CONNECT_SCAN_MISSING_FIELDS,
  CONNECT_SCAN_NOT_HERMES,
  CONNECT_SCAN_PROMPT
} from '../../src/lib/strings.mobile'
import { t } from '../../src/lib/t'
import { probeStatus } from '../../src/net/auth/probe'
import { useTheme } from '../../src/theme/provider'
import { radius, type } from '../../src/theme/type'

// Replicates: no desktop counterpart — QR-pairing is a mobile-only shortcut
// for app/connect/index.tsx's manual token flow (docs/desktop-prototypes/
// e-overlays/onboarding.html's remote form has no camera step at all; the
// desktop has no camera to scan with). Kept as its own screen rather than
// folded into connect/index.tsx since that's this app's own pre-existing
// shape; only the copy is vendored where a shared concept exists
// (Connecting…/failure prefix), the rest is the mobile-only strings named in
// strings.mobile.ts's "app/connect" section.
/** Scans a `hermes-android://connect?url=...&token=...` QR payload (the
 *  dashboard-generated connect code) and connects in token mode directly —
 *  the same shape app/connect/index.tsx's manual token flow produces. */
export default function ScanScreen() {
  const router = useRouter()
  const tokens = useTheme()
  const [permission, requestPermission] = useCameraPermissions()
  const [status, setStatus] = useState(CONNECT_SCAN_PROMPT)
  const [handled, setHandled] = useState(false)

  const onScanned = async ({ data }: { data: string }) => {
    if (handled) {
      return
    }

    setHandled(true)

    let parsed: URL

    try {
      parsed = new URL(data)
    } catch {
      setStatus(CONNECT_SCAN_INVALID_CODE)
      setHandled(false)

      return
    }

    if (parsed.protocol !== 'hermes-android:' || parsed.host !== 'connect') {
      setStatus(CONNECT_SCAN_NOT_HERMES)
      setHandled(false)

      return
    }

    const url = parsed.searchParams.get('url')
    const token = parsed.searchParams.get('token')

    if (!url || !token) {
      setStatus(CONNECT_SCAN_MISSING_FIELDS)
      setHandled(false)

      return
    }

    setStatus(t.settings.gateway.cloudConnecting)

    const id = `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const baseUrl = url.replace(/\/+$/, '')

    try {
      const statusBody = await probeStatus(baseUrl, { token })

      await setConnectionToken(id, token)

      const connection: MobileConnection = {
        id,
        kind: 'remote',
        label: baseUrl,
        baseUrl,
        authMode: 'token',
        installId: typeof statusBody.install_id === 'string' ? statusBody.install_id : undefined,
        lastUsedAt: Date.now()
      }

      setActiveConnection(connection)
      router.replace('/')
    } catch (error) {
      setStatus(`${t.settings.connections.saveFailed}: ${error instanceof Error ? error.message : String(error)}`)
      setHandled(false)
    }
  }

  if (!permission) {
    return <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]} />
  }

  if (!permission.granted) {
    return (
      <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
        <Text style={[styles.status, { color: tokens.foreground }]}>{CONNECT_CAMERA_ACCESS_NEEDED}</Text>
        <TouchableOpacity onPress={requestPermission} style={[styles.button, { backgroundColor: tokens.primary }]}>
          <Text style={[styles.buttonText, { color: tokens.primaryForeground }]}>{CONNECT_GRANT_CAMERA_ACCESS}</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: tokens.background }]}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handled ? undefined : onScanned}
        style={styles.camera}
      />
      <Text style={[styles.status, { color: tokens.foreground }]}>{status}</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.control,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  buttonText: {
    ...type.bodySmall,
    fontWeight: '600'
  },
  camera: {
    flex: 1
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16
  },
  status: {
    ...type.mono,
    padding: 16,
    textAlign: 'center'
  }
})
