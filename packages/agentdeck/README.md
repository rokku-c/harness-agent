# @effect-agent/agentdeck

The middle abstraction layer (the "engine" behind an agent control panel): it unifies mainstream
agents (claude code / codex / gemini / pi / this framework's own effect runtime / any CLI agent) under one set of control semantics.

## The three unified surfaces (mapping the requirements)

1. **Flow control** `SessionGateway` (src/types.ts)
   - `open / close / send / status / sessions`: open/close a session, run one turn, read status,
     regardless of which agent sits behind it. Adapters: `effectGateway` (in-process EffectAgent),
     `makeCliGateway` (spawn a non-interactive CLI).
2. **session -> consent mapping** `ConsentLedger` (src/consent.ts)
   - one ledger per session: ask (a call that needs operator consent) -> allow/deny, recording
     who decided and when; auto-approve tools land as allow(by auto) directly. `mapping()` gives
     sessionId -> ledger.
3. **config -> unified mapping** `normalizeConfig(kind, raw)` (src/config.ts)
   - any agent's raw config is normalized into `UnifiedAgentConfig` (cwd/model/command/env/
     timeout/consent policy/extra); unrecognized keys are preserved losslessly in extra. CLI presets
     (claude-code `-p`, codex exec, gemini, pi) can be overridden by command/args.

### The door, and how a dialect is told about it

A config may carry `mcp`: the MCP Gateway servers a launch must be able to reach, by the name the
platform knows them by (src/adapters/cli-mcp.ts). `cliInvocation` renders that into words and an
environment per dialect, because the dialects do not agree — `claude` takes one inline
`--mcp-config` word (plus `--strict-mcp-config`, without which it also loads its own home
directory's servers and the set the platform bound is no longer the set the agent can reach),
while `codex` names the door by dotted path and reads the token from an environment variable so the
secret never reaches its argv. Telling nobody is a different state from a dialect that cannot be
told, and only the second is a refusal: `gemini`, `pi` and an explicit command have no route at
all, and a config asking for servers under them is refused rather than started with the servers
dropped — an agent whose every call is turned away reports a *permission* problem, which is not
what it has.

`normalizeConfig` never fills `mcp`, however its raw object was spelled, so a config read back from
a saved launcher or drawn in a console form has none: a secret reaches a process by one route, and
no surface that *draws* a config can be drawing one.

## Registration and aggregation

AgentDeck (src/registry.ts): registers multiple gateways, shares one consent ledger, and
`sessions()` aggregates every session across agents. Products above it (console/board) only face these three surfaces.

## Verification (no model / no real CLI)

Config normalization, dialect model field mapping, the consent ledger flow, the effect gateway
under a scripted Model, the cli gateway under a fake executable, and registry aggregation now
stand unverified — the suite covering them was deleted 2026-09-14 and AGENTS.md forbids new ones.
