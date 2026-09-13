/**
 * SOUL.md's agent-to-agent messaging protocol section (M15 A round 2, task
 * 2: "Keep the desktop's messaging-protocol handling"). Ported (not
 * vendored — `apps/desktop/src/plugins/hermes-bots/soul.ts` imports
 * `@hermes/plugin-sdk`'s `host`, so the whole file isn't pure) from
 * `soul.ts:16-93`, quoted below where it matters, with `host`-dependent
 * bits (the one-shot `backfillMessagingProtocol` sweep, `soul.ts:98-146`)
 * left out — this app's bot-settings sheet only needs the save-time
 * append, not a background reconciliation pass.
 *
 * `soul.ts:75-78`'s own doc comment: "Idempotent: append the protocol once,
 * never duplicate a custom SOUL that already has it... No-op when the
 * backend injects the protocol into the system prompt itself
 * (bot_mode_protocol) — SOUL.md stays the user's identity text." This app's
 * `BotRosterResponse.bot_mode_protocol` (`src/api/bots.ts`) is exactly that
 * flag — round-1 verification confirmed the throwaway gateway always
 * reports it `true`, but a caller must pass whatever `profiles.list`
 * actually returned, not assume it.
 */

/** `data.ts:957-963`'s `botHandle`, minus the multi-source `bot.handle`
 *  override (`RosterRow.handle`, a registry precompute for a
 *  multi-connection desktop this app doesn't have — every bot here is on
 *  the one active connection, so the profile name IS the handle already).
 *  The 'default' -> 'hermes' remap is the part that matters: the primary
 *  profile's callable alias is 'hermes', so 'default' must never surface as
 *  an @-mention. */
export function botHandle(name: string): string {
  return name.trim().toLowerCase() === 'default' ? 'hermes' : name
}

/** `soul.ts:16-65`'s `messagingProtocolSection`, ported verbatim (the
 *  command block, prefix convention and teammate list are copied
 *  character-for-character — this is instructional text sent to a model,
 *  not UI chrome, so it must match exactly for the `hermes -p <agent-name>
 *  chat --in ~ -c "Bot Chat" --create-if-missing` convention to still work
 *  when a message crosses from a desktop-created bot to one created here,
 *  or back). `teammateNames` replaces the desktop's `RosterRow[]` (this
 *  app's callers only have `BotProfile[]` from `listBots()`, and the
 *  section only ever prints each teammate's name plus its own description —
 *  taking both here would tie this pure function to `BotProfile`'s shape
 *  for no reason a caller can't already resolve itself). */
export function messagingProtocolSection(
  name: string,
  teammates: ReadonlyArray<{ description?: string; name: string }>
): string {
  const others = teammates.filter(b => b.name !== name)
  const handle = botHandle(name)

  return [
    '## Messaging other agents',
    '',
    'You work alongside other named agents. Every agent (including you) has',
    'ONE canonical conversation titled "Bot Chat" — created with the agent,',
    'so it always exists. Agent-to-agent messages are delivered straight',
    'into it, like a DM. To message a teammate, run:',
    '',
    '```',
    'hermes -p <agent-name> chat --in ~ -c "Bot Chat" --create-if-missing -Q -q "Message from 🤖 ' +
      handle +
      ' (@' +
      handle +
      '): your message"',
    '',
    'Run the send with background=true and notify_on_complete=true on the',
    'terminal tool, then finish your turn — the reply arrives later as a',
    'background process notification. Never block waiting for it.',
    '```',
    '',
    '(`--in ~ -c "Bot Chat" --create-if-missing` resumes their canonical',
    'conversation in the home workspace, creating it if the target has no',
    '"Bot Chat" yet. `-Q` keeps output clean. Always open with the',
    '"Message from 🤖 ' + handle + ' (@' + handle + '):" prefix so they know',
    'who is talking (the @handle lets the app show your avatar to them).',
    'Their reply prints to stdout — relay the relevant part back to the',
    'user, and say which agent it came from.)',
    '',
    'If a message in YOUR chat starts with "Message from 🤖 <name>", it is',
    'a teammate messaging you, not the user. Answer it directly — your reply',
    'reaches them via their own delivery — and use the same command if you',
    'need to start a conversation yourself.',
    '',
    'When the user writes @<agent-name> or says "ask <name> to ..." /',
    '"tell <name> ...", that is a handoff: message that agent, wait for the',
    'reply, and report back.',
    '',
    'The roster grows over time — run `hermes profile list` for the LIVE',
    'teammate list before a handoff. Teammates when you were created:',
    ...(others.length
      ? others.map(b => `- \`${b.name}\`${b.description ? ` — ${b.description}` : ''}`)
      : ['- (none yet)'])
  ].join('\n')
}

/** `soul.ts:68-73`'s `hasMessagingProtocol`. */
export function hasMessagingProtocol(soul: null | string | undefined): boolean {
  return /(^|\n)## Messaging other agents(\s|$)/.test(soul || '')
}

/** `soul.ts:79-93`'s `ensureMessagingProtocol`, with `serverInjectsProtocol`
 *  (a module-level mutable the desktop refreshes from its own roster poll,
 *  `data.ts:675`) taken as an explicit `botModeProtocol` argument instead —
 *  this app has no equivalent background poll to refresh a module global
 *  from, and a pure function that takes its one piece of external state as
 *  a parameter is both truthful about the dependency and trivially
 *  testable without faking module state. */
export function ensureMessagingProtocol(
  soul: null | string | undefined,
  name: string,
  teammates: ReadonlyArray<{ description?: string; name: string }>,
  botModeProtocol: boolean
): string {
  const text = (soul || '').trim()

  if (botModeProtocol || hasMessagingProtocol(text)) {
    return text
  }

  const section = messagingProtocolSection(name, teammates)

  return text ? text + '\n\n' + section : section
}
