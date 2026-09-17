# Hermes Mobile

An [Expo](https://expo.dev) / React Native **thin client** for
[Hermes Agent](https://github.com/NousResearch/hermes-agent). An independent, open-source client
for Hermes Agent. Not affiliated with or endorsed by Nous Research.

The phone dials a remote `hermes serve` over WebSocket JSON-RPC (`/api/ws`) and REST (`/api/*`).
No agent logic runs on the device — see [AGENTS.md](AGENTS.md) for the invariants that follow from
that, and `project-planning/implementation-plan/` for the milestone plan and its status.

## Status

Work in progress. Milestones M00–M03 and M05 are complete and independently verified; M04, M06 and
M07 are in progress. Progress is tracked in
[project-planning/implementation-plan/README.md](project-planning/implementation-plan/README.md),
where every milestone carries its own exit criteria and a verification log.

## Getting started

```bash
npm install
npm run check     # typecheck + tests + lint + format check
npm run start     # Metro, for an installed dev-client build
```

Toolchain, device and backend-connection recipes — including the WSL2 build path this project uses
on Windows — are in [docs/CONNECTING.md](docs/CONNECTING.md).

## Vendored code

`src/upstream/` contains 23 files copied verbatim (plus mechanical import rewrites and a small
set of asserted patches) from **[NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent)**,
which is licensed under the MIT License, © 2025 Nous Research. Its licence text travels with the
copy in [src/upstream/LICENSE.upstream](src/upstream/LICENSE.upstream).

That directory is owned entirely by `scripts/sync-upstream.mjs` and must never be hand-edited; the
script reads each file from the upstream git object at the commit pinned in
[src/upstream/UPSTREAM.json](src/upstream/UPSTREAM.json) (currently `b973068c60ae`) and re-running it
against an unchanged upstream is byte-for-byte idempotent.

## Licence

MIT — see [LICENSE](LICENSE). The vendored upstream code remains under its own MIT licence as above.
