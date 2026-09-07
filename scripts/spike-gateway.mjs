// M03 connection spike: prove the thin-client premise against a real
// `hermes serve` gateway from any Node >= 22 machine (global fetch +
// WebSocket, zero deps) — before wiring the same five steps into the Expo
// app (app/spike.tsx). Adapted from the prior Capacitor spike at
// ../hermes-agent/apps/mobile/scripts/spike-gateway.mjs.
//
//   node scripts/spike-gateway.mjs --url http://127.0.0.1:9119 --token <SESSION_TOKEN> \
//        [--prompt "Say hi in one word"] [--profile default] [--timeout 120]
//
// What it validates, in order:
//   1. Public /api/status reachability (what the phone's first probe does).
//   2. WS JSON-RPC dial at /api/ws?token=...  -> gateway.ready.
//   3. session.create with source="android" (the session-surface rule: the
//      backend needs no env hint to know who is asking).
//   4. prompt.submit streaming: message.delta ... message.complete (or the
//      backend's error event -- surfaced, not swallowed).
//   5. Reconnect replay: redial and replay via session.events.since.
//
// Never logs the token or any URL containing it — only static markers.

const args = process.argv.slice(2)

function argValue(name) {
  const i = args.indexOf(`--${name}`)

  return i >= 0 && args[i + 1] ? args[i + 1] : null
}

const rawUrl = argValue('url')
const token = argValue('token')
const profile = argValue('profile')
const promptText = argValue('prompt') ?? 'Reply with exactly: mobile spike ok'
const turnTimeoutMs = Number(argValue('timeout') ?? 120) * 1000

if (!rawUrl || !token) {
  console.error('Usage: node scripts/spike-gateway.mjs --url http://host:port --token <SESSION_TOKEN> [--prompt ...]')
  process.exit(2)
}

const baseUrl = rawUrl.replace(/\/+$/, '')

let rpcId = 0
const pending = new Map()

function sendRpc(ws, method, params) {
  const id = ++rpcId

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} timed out after 30s`))
    }, 30_000)

    pending.set(id, { method, reject, resolve, timer })
    ws.send(JSON.stringify({ id, jsonrpc: '2.0', method, params }))
  })
}

// Event observer, shared by every socket (original + reconnect): a reconnect
// must see its own RPC responses, so routing can't be bound to socket #1.
let onFrame = null

function connectWs() {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/ws', baseUrl)

    url.protocol = url.protocol.replace(/^http/, 'ws')
    url.searchParams.set('token', token)

    if (profile) {
      url.searchParams.set('profile', profile)
    }

    const ws = new WebSocket(url)

    ws.addEventListener('message', event => {
      const frame = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString())

      if (frame.id !== undefined && pending.has(frame.id)) {
        const entry = pending.get(frame.id)

        pending.delete(frame.id)
        clearTimeout(entry.timer)

        if (frame.error) {
          entry.reject(new Error(`${entry.method} error ${frame.error.code}: ${frame.error.message}`))
        } else {
          entry.resolve(frame.result)
        }

        return
      }

      onFrame?.(frame)
    })
    ws.addEventListener('open', () => resolve(ws), { once: true })
    ws.addEventListener('error', () => reject(new Error('WebSocket dial failed (see /api/status output above)')), {
      once: true
    })
  })
}

function fail(step, error) {
  console.error(`✗ ${step}: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}

const status = await fetch(`${baseUrl}/api/status`).catch(error => fail('1. /api/status reachability', error))

if (!status.ok) {
  fail('1. /api/status reachability', `HTTP ${status.status}`)
}

const statusBody = await status.json()

console.log(
  `✓ 1. /api/status reachable — version=${statusBody.version ?? '?'} auth_required=${statusBody.auth_required}`
)

const ws = await connectWs().catch(error => fail('2. WebSocket dial', error))

console.log('✓ 2. WebSocket dial ok (/api/ws?token=...)')

const deltas = []
const seenEvents = new Set()
let completePayload = null
let settleTurn = () => {}
const turnSettled = new Promise(resolve => {
  settleTurn = resolve
})

onFrame = frame => {
  // Wire contract (src/upstream/shared/json-rpc-gateway.ts): server events
  // ride method: "event" with the event name in params.type and data in payload.
  const name = frame.method === 'event' ? frame.params?.type : frame.method
  const payload = frame.params?.payload ?? {}

  if (name) {
    seenEvents.add(name)
  }

  if (name && name !== 'message.delta') {
    console.log(`  [event] ${name} ${JSON.stringify(payload).slice(0, 220)}`)
  }

  if (!name && frame.error) {
    console.log(`  [rpc-error] ${JSON.stringify(frame.error).slice(0, 220)}`)
  }

  if (name === 'message.delta') {
    deltas.push(payload.delta ?? payload.text ?? '')
  }

  if (name === 'message.complete') {
    completePayload = payload
    settleTurn()
  }

  if (name === 'error') {
    settleTurn()
  }
}

await sendRpc(ws, 'gateway.ping', {}).catch(() => null)

// close_on_disconnect: false keeps the session alive across the reconnect
// below, so the replay step targets a live session instead of an
// orphan-reaped one. Never send close_on_disconnect: true (see AGENTS.md).
const created = await sendRpc(ws, 'session.create', {
  close_on_disconnect: false,
  source: 'android',
  ...(profile ? { profile } : {})
}).catch(error => fail('3. session.create', error))

const sid = created?.session_id ?? created?.sid ?? created?.id

if (!sid) {
  fail('3. session.create', `no session id in result: ${JSON.stringify(created).slice(0, 200)}`)
}

console.log(`✓ 3. session.create ok — sid=${sid} source=android`)

await sendRpc(ws, 'prompt.submit', { session_id: sid, text: promptText }).catch(error =>
  fail('4. prompt.submit', error)
)

const timer = setTimeout(
  () =>
    fail(
      '4. streaming turn',
      `no message.complete within ${turnTimeoutMs / 1000}s; events seen: ${[...seenEvents].join(', ') || 'NONE'}`
    ),
  turnTimeoutMs
)

await turnSettled
clearTimeout(timer)

const full = deltas.join('')

console.log(`✓ 4. turn settled — ${deltas.length} deltas, ${full.length} chars`)
console.log(`   reply: ${full.slice(0, 200) || JSON.stringify(completePayload).slice(0, 200)}`)

// Reconnect replay: same watermark contract the app's gateway client uses to
// survive a tunnel drop (session.events.since + per-session seq).
ws.close()
await new Promise(resolve => setTimeout(resolve, 250))
const ws2 = await connectWs().catch(error => fail('5. reconnect', error))
const replay = await sendRpc(ws2, 'session.events.since', { last_seen: 0, session_id: sid }).catch(error =>
  fail('5. session.events.since replay', error)
)

const names = (replay?.events ?? []).map(frame => frame.event ?? frame.method ?? '?')

console.log(
  `✓ 5. replay ok — ${replay?.count ?? 0} events, latest_seq=${replay?.latest_seq}, ` +
    `epoch=${replay?.epoch}, truncated=${replay?.truncated}`
)
console.log(`   events: ${names.slice(0, 12).join(', ')}${names.length > 12 ? ' ...' : ''}`)

if (!replay?.count) {
  fail('5. replay', 'empty replay window — events were not retained')
}

ws2.close()
console.log('\nPASS — thin-client premise validated: dial, android-source session, streaming, replay.')
process.exit(0)
