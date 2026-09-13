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

## Registration and aggregation

AgentDeck (src/registry.ts): registers multiple gateways, shares one consent ledger, and
`sessions()` aggregates every session across agents. Products above it (console/board) only face these three surfaces.

## Tests (no model / no real CLI)

packages/agentdeck/test/agentdeck.test.ts (7 cases): config normalization, dialect model field
mapping, the whole consent ledger flow, effect gateway with a scripted Model, cli gateway with a
fake executable, and registry aggregation across gateways.
