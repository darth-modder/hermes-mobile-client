import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { setActiveConnection } from '../../src/connections/registry'
import { setConnectionToken } from '../../src/connections/secure'
import type { MobileConnection } from '../../src/connections/types'
import { probeStatus } from '../../src/net/auth/probe'

/** Scans a `hermes-android://connect?url=...&token=...` QR payload (the
 *  dashboard-generated connect code) and connects in token mode directly —
 *  the same shape app/connect/index.tsx's manual token flow produces. */
export default function ScanScreen() {
  const router = useRouter()
  const [permission, requestPermission] = useCameraPermissions()
  const [status, setStatus] = useState('Point the camera at a connection QR code.')
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
      setStatus('Not a valid connect code.')
      setHandled(false)

      return
    }

    if (parsed.protocol !== 'hermes-android:' || parsed.host !== 'connect') {
      setStatus('Not a Hermes connect code.')
      setHandled(false)

      return
    }

    const url = parsed.searchParams.get('url')
    const token = parsed.searchParams.get('token')

    if (!url || !token) {
      setStatus('Connect code is missing url or token.')
      setHandled(false)

      return
    }

    setStatus('Connecting…')

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
      setStatus(`Connect failed: ${error instanceof Error ? error.message : String(error)}`)
      setHandled(false)
    }
  }

  if (!permission) {
    return <View style={styles.container} />
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.status}>Camera access is needed to scan a connect code.</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
          <Text style={styles.buttonText}>Grant camera access</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <CameraView
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handled ? undefined : onScanned}
        style={styles.camera}
      />
      <Text style={styles.status}>{status}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  buttonText: {
    color: '#f2f2f5',
    fontSize: 14,
    fontWeight: '600'
  },
  camera: {
    flex: 1
  },
  container: {
    backgroundColor: '#0b0b0f',
    flex: 1,
    justifyContent: 'center',
    padding: 16
  },
  status: {
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 13,
    padding: 16,
    textAlign: 'center'
  }
})
