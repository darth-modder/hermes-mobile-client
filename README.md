# Hermes Mobile

An Android client for [Hermes Agent](https://github.com/NousResearch/hermes-agent), built with
[Expo](https://expo.dev) and React Native. Independent and open source. Not affiliated with or
endorsed by Nous Research.

Your phone connects to a `hermes serve` gateway you run yourself, over WebSocket JSON-RPC
(`/api/ws`) and REST (`/api/*`). It is a **thin client**: no agent logic, no model calls and no
tools run on the device. Everything happens on your gateway, and the app shows it and answers it.

What you can do from the phone: connect to a gateway by URL and sign in, chat with a real model,
answer approval, sudo, secret and clarify prompts, manage sessions, bots and tasks, and get a
notification when something needs you while the app is in the background.

## You need a gateway first

The app does nothing on its own. Before installing it, have a working Hermes gateway:

```bash
hermes serve --host 0.0.0.0 --port 9128
```

Two things matter for a phone:

- **Bind to `0.0.0.0`, not loopback.** A gateway on `127.0.0.1` is unreachable from another device.
- **Set an auth secret.** With `HERMES_DASHBOARD_BASIC_AUTH_SECRET` unset, the gateway signs
  sessions with a random per-process key, so every restart signs every client out. Set it once and
  keep it.

The app refuses `127.0.0.1` and `localhost` as gateway addresses, because on a phone those point at
the phone. Use the machine's LAN address (`http://192.168.x.x:9128`), a tunnel or VPN hostname, or
`http://10.0.2.2:9128` from an Android emulator, which is the emulator's alias for its host.

Plain `http://` works and the app warns you about it: your session token and messages cross the
network in the clear. Fine on a LAN you trust, not over the internet — put TLS in front of the
gateway for that.

## Requirements to build

|             |                                                             |
| ----------- | ----------------------------------------------------------- |
| Node        | 24.x (the version this project builds with)                  |
| JDK         | 21 (Temurin works; Gradle needs `JAVA_HOME` set)             |
| Android SDK | platform-tools, build-tools 36.0.0, platform android-36      |
| Device      | Android 7.0 (API 24) or newer; the app targets API 36        |

The build shells out to `node` from Gradle, so `node` must be on the `PATH` Gradle inherits, not
only in your interactive shell.

## Build and run

```bash
npm ci
npm run check          # typecheck, tests, plugin tests, lint, format check
```

**A development build**, which is what you want while working on the app:

```bash
npm run android        # builds a dev client and installs it on a device or emulator
npm run start          # Metro, once the dev client is installed
```

**A release APK**, signed with your own key:

```bash
export HERMES_KEYSTORE_PATH=/path/to/your.jks
export HERMES_KEY_ALIAS=your-alias
export HERMES_KEYSTORE_PASSWORD=...   # better prompted than stored; see docs/RELEASING.md
export HERMES_KEY_PASSWORD=...
bash scripts/build-release-apk.sh
```

The script prebuilds the native project, runs `assembleRelease`, and prints the APK path and its
sha256. It refuses to finish if the APK lacks `arm64-v8a`, so an emulator-only build cannot be
mistaken for a distributable one. [docs/RELEASING.md](docs/RELEASING.md) covers signing keys and the
versionCode rule: an integer that only ever goes up, once per APK that leaves your machine.

There is no CI in this repo. `npm run check` is the gate, and it is expected to pass before a merge.

## How the code is arranged

```
app/                 expo-router screens and layouts
src/
  gateway/           the socket, the session stream reducer, RPC calls
  chat/              transcript, composer, approval/sudo/secret/clarify cards
  connections/       the gateway registry, secure storage, sign-in routing
  net/               http, the auth ladder, URL guards
  api/               typed REST calls
  store/             app state
  theme/             tokens, light and dark
  voice/             dictation, recorded on the phone, transcribed by the gateway
  push/              local notifications
  upstream/          vendored from hermes-agent, never hand-edited
modules/             loopback-listener, a small native module for the OAuth redirect
plugins/             Expo config plugins: release signing, cleartext traffic
server-plugin/       an optional push plugin for the gateway side
scripts/             release build, upstream sync, icon generation
docs/                connecting, releasing, parity and design against the desktop app
project-planning/    the milestone plan, verification logs and decisions
```

Two files are worth reading before changing anything:

- **[AGENTS.md](AGENTS.md)** — the invariants. The device never runs agent logic, reauth happens
  only on a confirmed 401/403, the vendored directory is off limits, and so on. Most surprising
  review comments trace back to one of these.
- **[project-planning/DECISIONS.md](project-planning/DECISIONS.md)** — why the app is built the way
  it is. Each entry records what was decided, what was checked, and what was still unverified at the
  time. When something looks odd, the reason is usually in here.

## Vendored upstream code

`src/upstream/` holds files copied verbatim from
[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) (MIT, © 2025 Nous
Research), with mechanical import rewrites and a small set of asserted patches. Its licence travels
with the copy in [src/upstream/LICENSE.upstream](src/upstream/LICENSE.upstream).

Never hand-edit that directory. It is owned by `scripts/sync-upstream.mjs`, which reads each file
from the upstream git object at the commit pinned in
[src/upstream/UPSTREAM.json](src/upstream/UPSTREAM.json). Re-running it against an unchanged upstream
produces no diff; if you need a change there, change it upstream or add a patch the script asserts.

```bash
HERMES_AGENT_ROOT=../hermes-agent node scripts/sync-upstream.mjs
```

## Status

0.1.0 is a first build, not a polished release.

- Verified extensively on an Android emulator against throwaway gateways: connecting and signing in,
  chat, approval Run and Reject, sudo, secret and clarify prompts, sign-out, session recovery after
  a disconnect, and background notifications.
- The first real-hardware pass has been run by the maintainer.
- iOS is not built. Nothing here is iOS-specific by design, but no one has tried it.
- Server-pushed notifications are not configured: what you get are local notifications, raised by
  the app while it is running in the background.

Milestones, exit criteria and verification logs live in
[project-planning/implementation-plan/README.md](project-planning/implementation-plan/README.md).
Each milestone states what was proven and how, including what was left open.

## Contributing

Issues and pull requests are welcome. A few things that will make a change land easily:

- Run `npm run check` and have it green.
- Keep `src/upstream/` untouched.
- Match the surrounding code: the project favours explanatory comments about _why_, small pure
  modules with unit tests, and no new dependency without a reason.
- If you change behaviour a milestone claims to have verified, say how you re-verified it. Claims
  about device behaviour in this project are expected to name what was run and on which build.

## Licence

MIT — see [LICENSE](LICENSE). Vendored upstream code remains under its own MIT licence.
