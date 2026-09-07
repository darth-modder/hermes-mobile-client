import { useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { buildGatewayWsUrl } from '../src/gateway/dial'
import { MobileGateway, PROMPT_SUBMIT_REQUEST_TIMEOUT_MS } from '../src/gateway/mobile-gateway'
import { httpRequest } from '../src/net/http'
import type { GatewayEvent } from '../src/upstream/shared/json-rpc-gateway'

/**
 * M03 connection spike screen. Dev/debug only — not the real chat UI (M06).
 * URL + token inputs, connect/disconnect/reconnect, session.create,
 * prompt.submit, a raw delta log, and a readout of replay_epoch and the
 * per-session seq watermarks so a reconnect/replay can be inspected by eye.
 */
export default function SpikeScreen() {
  const [host, setHost] = useState('127.0.0.1:9119')
  const [token, setToken] = useState('')
  const [promptText, setPromptText] = useState('Reply with exactly: mobile spike ok')
  const [connectionState, setConnectionState] = useState('idle')
  const [statusVersion, setStatusVersion] = useState<null | string>(null)
  const [replayEpoch, setReplayEpoch] = useState<null | string>(null)
  const [seqWatermarks, setSeqWatermarks] = useState<Record<string, number>>({})
  const [sessionId, setSessionId] = useState<null | string>(null)
  const [log, setLog] = useState<string[]>([])
  const [reply, setReply] = useState('')

  const gatewayRef = useRef<MobileGateway | null>(null)
  const replyRef = useRef('')

  const appendLog = (line: string) => setLog(prev => [...prev.slice(-199), line])

  const baseUrl = `http://${host}`

  const checkStatus = async () => {
    try {
      const body = await httpRequest<{ auth_required?: boolean; version?: string }>(baseUrl, '/api/status')

      setStatusVersion(body.version ?? '(no version field)')
      appendLog(`[status] version=${body.version ?? '?'} auth_required=${body.auth_required}`)
    } catch (error) {
      appendLog(`[status] FAILED: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const attach = (gateway: MobileGateway) => {
    gateway.onState(state => setConnectionState(state))
    gateway.onAny((event: GatewayEvent) => {
      if (event.type === 'gateway.ready') {
        const epoch = (event.payload as { replay_epoch?: unknown } | undefined)?.replay_epoch

        if (typeof epoch === 'string') {
          setReplayEpoch(epoch)
          appendLog(`[event] gateway.ready replay_epoch=${epoch}`)
        }

        return
      }

      if (event.type === 'message.delta') {
        const delta = (event.payload as { delta?: unknown; text?: unknown } | undefined) ?? {}
        const chunk = typeof delta.delta === 'string' ? delta.delta : typeof delta.text === 'string' ? delta.text : ''

        replyRef.current += chunk
        setReply(replyRef.current)
        setSeqWatermarks(gateway.getSeqWatermarks())

        return
      }

      if (event.type === 'replay.truncated') {
        appendLog(`[event] replay.truncated ${JSON.stringify(event.payload)}`)

        return
      }

      appendLog(`[event] ${event.type} ${JSON.stringify(event.payload ?? {}).slice(0, 200)}`)
      setSeqWatermarks(gateway.getSeqWatermarks())
    })
  }

  // Reuses the same MobileGateway instance across reconnects — its seq
  // watermarks and replay epoch live on the instance, and connect() itself
  // fires the replay fetch on open, so creating a fresh instance per
  // reconnect would silently disable replay entirely.
  const getOrCreateGateway = (): MobileGateway => {
    if (!gatewayRef.current) {
      const gateway = new MobileGateway()

      attach(gateway)
      gatewayRef.current = gateway
    }

    return gatewayRef.current
  }

  const connect = async () => {
    const gateway = getOrCreateGateway()
    const url = buildGatewayWsUrl({ host, protocol: 'http:' }, { mode: 'token', token })

    try {
      await gateway.connect(url)
      appendLog('[connect] ok')
    } catch (error) {
      appendLog(`[connect] FAILED: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const disconnect = () => {
    gatewayRef.current?.close()
    appendLog('[disconnect] closed')
  }

  const reconnect = async () => {
    disconnect()
    await connect()
  }

  const createSession = async () => {
    const gateway = gatewayRef.current

    if (!gateway) {
      appendLog('[session.create] not connected')

      return
    }

    try {
      const result = await gateway.request<{ id?: string; session_id?: string; sid?: string }>('session.create', {
        close_on_disconnect: false,
        source: 'android'
      })

      const sid = result.session_id ?? result.sid ?? result.id ?? null

      setSessionId(sid)
      appendLog(`[session.create] sid=${sid}`)
    } catch (error) {
      appendLog(`[session.create] FAILED: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const sendPrompt = async () => {
    const gateway = gatewayRef.current

    if (!gateway || !sessionId) {
      appendLog('[prompt.submit] no session — create one first')

      return
    }

    replyRef.current = ''
    setReply('')

    try {
      await gateway.request(
        'prompt.submit',
        { session_id: sessionId, text: promptText },
        PROMPT_SUBMIT_REQUEST_TIMEOUT_MS
      )
      appendLog('[prompt.submit] ack')
    } catch (error) {
      appendLog(`[prompt.submit] FAILED: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Gateway connection spike</Text>

      <Text style={styles.label}>Host:port</Text>
      <TextInput autoCapitalize="none" onChangeText={setHost} style={styles.input} value={host} />

      <Text style={styles.label}>Session token</Text>
      <TextInput autoCapitalize="none" onChangeText={setToken} secureTextEntry style={styles.input} value={token} />

      <View style={styles.row}>
        <Button label="Check /api/status" onPress={checkStatus} />
        <Button label="Connect" onPress={connect} />
        <Button label="Disconnect" onPress={disconnect} />
        <Button label="Reconnect" onPress={reconnect} />
      </View>

      <Text style={styles.readout}>
        state={connectionState} version={statusVersion ?? '?'}
      </Text>
      <Text style={styles.readout}>replay_epoch={replayEpoch ?? '(none yet)'}</Text>
      <Text style={styles.readout}>watermarks={JSON.stringify(seqWatermarks)}</Text>
      <Text style={styles.readout}>session_id={sessionId ?? '(none)'}</Text>

      <View style={styles.row}>
        <Button label="session.create" onPress={createSession} />
      </View>

      <Text style={styles.label}>Prompt</Text>
      <TextInput onChangeText={setPromptText} style={styles.input} value={promptText} />
      <View style={styles.row}>
        <Button label="prompt.submit" onPress={sendPrompt} />
      </View>

      <Text style={styles.label}>Reply</Text>
      <Text style={styles.reply}>{reply || '(nothing yet)'}</Text>

      <Text style={styles.label}>Log</Text>
      {log.map((line, index) => (
        <Text key={`${index}-${line}`} style={styles.logLine}>
          {line}
        </Text>
      ))}
    </ScrollView>
  )
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button}>
      <Text style={styles.buttonText}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#1f6feb',
    borderRadius: 6,
    marginBottom: 8,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  buttonText: {
    color: '#f2f2f5',
    fontSize: 13,
    fontWeight: '600'
  },
  container: {
    backgroundColor: '#0b0b0f',
    flexGrow: 1,
    padding: 16
  },
  input: {
    backgroundColor: '#17171d',
    borderColor: '#2a2a33',
    borderRadius: 6,
    borderWidth: 1,
    color: '#f2f2f5',
    fontFamily: 'monospace',
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  label: {
    color: '#8a8a99',
    fontSize: 12,
    marginBottom: 4,
    marginTop: 8,
    textTransform: 'uppercase'
  },
  logLine: {
    color: '#8a8a99',
    fontFamily: 'monospace',
    fontSize: 11
  },
  readout: {
    color: '#3dd68c',
    fontFamily: 'monospace',
    fontSize: 12,
    marginBottom: 2
  },
  reply: {
    color: '#f2f2f5',
    fontFamily: 'monospace',
    fontSize: 13,
    marginBottom: 8
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap'
  },
  title: {
    color: '#f2f2f5',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16
  }
})
