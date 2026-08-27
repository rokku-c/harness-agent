# effect-agent

A declarative agent programming model on Effect. **An agent is a description**: typed input and
output, a set of connections it may use, and one entry — a connection capability or a local LLM
behavior. Execution runs through honest capability negotiation and one invoke lifecycle.

```ts
import { Agent, AgentContext, Until } from "effect-agent"
import { ClaudeCode } from "effect-agent" // drivers are exported from the root entry

const review = Agent.define("review", (input: string) =>
  AgentContext.text("Review this PR:\n\n" + input)
).returns(Until.text).implementedBy(ClaudeCode.make())

// Effect.runPromise(review.run(input)) -> the agent's final response
```

## Repository map

- `packages/core` — connection kernel: the canonical `AgentIR` (serializable connection graph),
  `compile`, `ConnectionRuntime` with capability negotiation and failover.
- `src/` — the typed model: `Agent`, `Until`/`Capabilities`, `Binding`/`Op`, `BehaviorSpec`
  compilation, and the drivers (Vercel, Claude Code, Codex, Pi).
- `packages/builtin` — host adapters: dsh as a Connection (`dsh.agent.run`), MCP
  (client/server/streamable-HTTP), a Claude Code connection, provider and notation contracts.
  See `packages/README.md` for the inventory.
- `chan/` — the other direction: effect-agent as a dsh plugin.
- `test/` — unit/integration tests plus the gated real-runtime dsh smoke test.

## Status

Pre-release, private, and Bun-only. This is not a publishable package: consume it by
cloning the repository and wiring the `tsconfig` `paths` aliases (`@effect-agent/core`,
`@effect-agent/builtin`) rather than installing a tarball. `ClaudeCode.make()` requires a
locally authenticated Claude Code CLI. On `Until`: `Until.stop` runs the agent to
completion and returns the final text. `Until.text` and `Until.stop` are
observational aliases under run-to-completion semantics (text is a hint that only text
is needed, never a pause-at-hit); the negotiation matrix in
`test/capability-matrix.test.ts` pins this.

## Docs

Start with **ARCHITECTURE.md** (English spine). `DRAFT.md` is the detailed vision/spec
(Chinese), `IMPLEMENTATION.md` the implementation notes, `docs/` the design records.
