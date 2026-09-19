# Hermes Mobile 0.1.0 — release notes

For testers. Plain description of what this build does and doesn't do, not a pitch.

## What this is

An independent, open-source Android client for a self-hosted **Hermes Agent** gateway
(`hermes serve`). **It is not affiliated with, endorsed by, or produced by Nous Research.** This app
has no AI model and no backend of its own — you connect it to a `hermes serve` instance you (or
someone you trust) already runs, and everything the app does goes through that gateway.

## What works

Verified this round, live, on a signed release build (identical code to what ships; see the
verification log for exact sha256s), unless marked otherwise:

- **Connecting by URL.** Type a gateway address (including a plain LAN or Tailscale address) into
  "Enter a URL," detect its auth mode, and sign in with a username and password.
- **Chatting with a real model.** Sending a message and getting a real, streamed reply back —
  tested against `mimo-v2.5` and `deepseek-v4-flash`.
- **Approvals.** When the agent wants to run something that needs your say-so, a card appears with
  Run / Allow this session / Always allow / Reject. **Run and Reject are confirmed working this
  round; Allow this session and Always allow have not been re-tested since the app's visual
  redesign** — use Run or Reject if you want a result you can rely on.
- **A notification while the app is running in the background.** If an approval comes in while
  you've switched away from the app, you get a system notification while the app is still running
  in the background. If your phone has been asleep for a while you may not get one; open the app
  to check. The app asks for notification permission once, the first time you send a message —
  never at launch, before it has anything to notify you about.

The rest of the app — Sessions, Bots, Tasks, and most of Settings — is implemented and covered by
automated tests, and was exercised on-device earlier this month before this round's changes; it was
not independently re-verified as part of this specific release build. If something there looks or
behaves oddly, that's exactly the kind of thing worth reporting.

## What is not in this build

- **Tailscale pairing from inside the app.** The guided pairing card isn't built yet. You can still
  connect to a Tailscale address the same way as any other — type it into "Enter a URL" (see
  `docs/CONNECTING.md` for how to find it).
- **Push notifications.** The project has no Expo/EAS push project configured yet, so there's no
  server-delivered notification when the app is fully closed. The in-app notification described
  above (while the app is running or recently backgrounded) is a separate, working mechanism.
- **Six settings/management screens** — Chat, Safety, Memory & Context, Billing, Command center, and
  Agents — are hidden in this build. They exist in the code but aren't wired up to do anything real
  yet, so they're turned off rather than shown half-finished.

## About `http://` gateways

This app allows connecting to a gateway over plain, unencrypted `http://` on purpose — the gateway
software itself (`hermes serve`) has no built-in TLS option, so refusing `http://` outright would
mean the app couldn't connect to anything most people run. If you connect this way, **your login
token and everything you send or receive cross the network in the clear** — not just the chat text.

Only use a plain `http://` gateway on a network you trust, such as your own home Wi-Fi. Never on
public Wi-Fi. For an encrypted connection instead: Tailscale (see `docs/CONNECTING.md`) carries
plain `http://` over an encrypted tunnel, or you can put a reverse proxy with a real TLS certificate
in front of your gateway.

## Keeping the gateway itself stable

If whoever hosts the gateway hasn't set `HERMES_DASHBOARD_BASIC_AUTH_SECRET`, every restart of
`hermes serve` signs every connected phone out — the app's only symptom is a 401 that looks like an
expired password. This is the single most common way to end up locked out mid-test. See
`docs/CONNECTING.md`'s "Keeping `hermes serve` running on the host" section for why and how to set
it once.

## Testing status

**This build has only ever been tested on an Android emulator.** It has never been installed on a
real physical phone. If you're one of the first people running it on real hardware, please report
anything — install problems, layout issues, performance, battery behavior — that an emulator
wouldn't show.

## Installing and connecting

1. Open the APK file you were given — this is a closed test handed to you directly, not a public
   download — and your phone will ask permission to install from this source once; allow it.
2. Open the app. It lands on the connect screen.
3. Get your gateway's address (see `docs/CONNECTING.md` if you need help finding it) and type it
   into "Enter a URL."
4. Tap "Detect auth mode," then sign in if prompted.
5. Send a message.

If anything here is wrong or missing, that's useful to know too — this document describes what was
actually seen working, not what's supposed to work.
