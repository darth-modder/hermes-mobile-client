// M06 exit criterion: "Desktop and phone on the same session: session.reclaimed
// handled without a stuck composer." Substituted here with a second Node
// WebSocket client (Deviation, M06-chat-screen.md) — the real desktop app
// lives in the read-only ../hermes-agent checkout and a concurrent session
// was editing apps/desktop/src/** at the time, so building/running it would
// have written into that checkout. This script drives BOTH branches of the
// reclaim the app's `hydrate` effect (src/gateway/session-connection.ts) has
// to handle:
//
//   node scripts/second-client-reclaim.mjs --url http://127.0.0.1:9119 \
//        --token $(cat /path/to/scratch-token) --gap long
//   node scripts/second-client-reclaim.mjs --url http://127.0.0.1:9119 \
//        --token $(cat /path/to/scratch-token) --gap short
//
//   --gap long  (default 25s > ws_orphan_reap_grace_s's 20s default):
//     the reconnect happens AFTER the grace period, so the orphaned runtime
//     socket is reaped and `session.reclaimed` fires with reason
//     `ws_orphan_reap` — the reducer's lifecycle.ts rebinds the runtime id to
//     the stored id and (if this was the active session) emits a `hydrate`
//     effect. This is the branch that is easy to remember to test.
//
//   --gap short (default 9s < the grace period):
//     the reconnect happens BEFORE the grace period elapses, so NO reclaim
//     fires at all — client B's own `session.resume` is what re-attaches it.
//     This is the branch most likely to leave a composer stuck if the app
//     only handles the explicit `session.reclaimed` broadcast and never
//     re-checks state after a plain resume; it's invisible if you only test
//     the long gap (per M06's task brief).
//
// Never logs the token or a URL containing it — only static markers.

const args = process.argv.slice(2)

function argValue(name, fallback = null) {
  const i = args.indexOf(`--${name}`)

  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const rawUrl = argValue('url')
const token = argValue('token')
const gapKind = argValue('gap', 'long')
const gapSeconds = Number(argValue('gap-seconds', gapKind === 'short' ? 9 : 25))

if (!rawUrl || !token) {
  console.error('Usage: node scripts/second-client-reclaim.mjs --url http://host:port --token <SESSION_TOKEN> --gap long|short')
  process.exit(2)
}

const baseUrl = rawUrl.replace(/\/+$/, '')

function fail(step, error) {
  console.error(`✗ ${step}: ${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
}

function connectWs(onEvent) {
  let rpcId = 0
  const pending = new Map()

  return new Promise((resolve, reject) => {
    const url = new URL('/api/ws', baseUrl)

    url.protocol = url.protocol.replace(/^http/, 'ws')
    url.searchParams.set('token', token)

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

      const name = frame.method === 'event' ? frame.params?.type : null

      if (name) {
        onEvent(name, frame.params?.payload ?? {})
      }
    })

    ws.addEventListener(
      'open',
      () => {
        resolve({
          close: () => ws.close(),
          request: (method, params) => {
            const id = ++rpcId

            return new Promise((res, rej) => {
              const timer = setTimeout(() => {
                pending.delete(id)
                rej(new Error(`${method} timed out after 30s`))
              }, 30_000)

              pending.set(id, { method, reject: rej, resolve: res, timer })
              ws.send(JSON.stringify({ id, jsonrpc: '2.0', method, params }))
            })
          }
        })
      },
      { once: true }
    )
    ws.addEventListener('error', () => reject(new Error('WebSocket dial failed')), { once: true })
  })
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const eventsA = []
const clientA = await connectWs((name, payload) => eventsA.push({ name, payload })).catch(error =>
  fail('client A: dial', error)
)

if (!clientA) {
  process.exit(1)
}

const created = await clientA
  .request('session.create', { close_on_disconnect: false, source: 'android' })
  .catch(error => fail('client A: session.create', error))

if (!created) {
  process.exit(1)
}

const storedSessionId = created.stored_session_id ?? created.session_id

console.log(`✓ client A: session.create ok — runtime=${created.session_id} stored=${storedSessionId}`)

// A session with no turn ever run has no DB row (tui_gateway/methods_session.py:
// "we intentionally do NOT persist a DB row here... created lazily on the
// first prompt") — session.resume would 404 on it regardless of the reclaim
// mechanism. Run one trivial turn first so there is something real to resume.
await clientA
  .request('prompt.submit', { session_id: created.session_id, text: 'Reply with exactly: ok' })
  .catch(error => fail('client A: prompt.submit', error))

const turnDeadline = Date.now() + 60_000

while (!eventsA.some(e => e.name === 'message.complete' || e.name === 'error')) {
  if (Date.now() > turnDeadline) {
    fail('client A: turn', 'no message.complete within 60s')
    process.exit(1)
  }

  await sleep(200)
}

console.log('✓ client A: turn settled — session now has a persisted row')

// session.reclaimed is a GLOBAL broadcast (session_lifecycle.py's
// _broadcast_global_event) sent to whatever sockets are connected the moment
// the server's reap Timer fires — not a targeted reply to whoever eventually
// reconnects. Client B must already be connected and listening BEFORE the
// grace period elapses, exactly like the app's own gateway socket would be
// (it dials once and stays connected; it isn't the act of resuming that
// triggers the broadcast). Dialing it only after the gap (as a naive test
// would) misses the broadcast entirely, whether or not a reclaim happened.
const eventsB = []
const clientB = await connectWs((name, payload) => eventsB.push({ name, payload })).catch(error =>
  fail('client B: dial', error)
)

if (!clientB) {
  process.exit(1)
}

console.log('✓ client B: dialed and listening')

clientA.close()
console.log(`  client A disconnected — waiting ${gapSeconds}s (gap: ${gapKind})…`)
await sleep(gapSeconds * 1000)

const resumed = await clientB
  .request('session.resume', { session_id: storedSessionId })
  .catch(error => fail('client B: session.resume', error))

if (!resumed) {
  process.exit(1)
}

console.log(`✓ client B: session.resume ok — runtime=${resumed.session_id}`)

// A reclaim broadcast can arrive slightly after the resume RPC resolves —
// give it a short window before deciding it didn't fire.
await sleep(2000)

// Filter to THIS test's own runtime id: session.reclaimed is a global
// broadcast, so a long-running server that has answered earlier test runs
// (each with its own pending reap Timer) can still be delivering one of
// THEIR reclaims during this run's listening window otherwise.
const isThisRun = e => e.name === 'session.reclaimed' && e.payload?.session_id === created.session_id
const reclaimed = eventsB.find(isThisRun) ?? eventsA.find(isThisRun)

if (gapKind === 'long') {
  if (reclaimed) {
    console.log(`✓ PASS (long gap): session.reclaimed fired — reason=${reclaimed.payload?.reason}`)
  } else {
    fail('long gap', `expected session.reclaimed (reason ws_orphan_reap) but saw: ${[...eventsA, ...eventsB].map(e => e.name).join(', ') || 'NONE'}`)
  }
} else if (reclaimed) {
  fail('short gap', `expected NO session.reclaimed within the grace period, but saw one — reason=${reclaimed.payload?.reason}`)
} else {
  console.log('✓ PASS (short gap): no session.reclaimed fired, as expected — client B\'s own session.resume is what must re-attach it')
}

clientB.close()
process.exitCode ??= 0
