# Events reference

One page for every event this library emits. Consumers subscribe through
`Harness.withHooks` (agent-level) or a `ConnectionRuntime` event stream
(kernel-level). Events are observational: a hook that throws must never corrupt
the run unless the hook is trusted (see Hooks below).

## Agent-level events (`HarnessEvent`, via `Harness.withHooks`)

| Event | Fields | When |
| --- | --- | --- |
| `RunStarted` | `agent`, `context` | the driver run begins |
| `Output` | `agent`, `output` | the run produced its final value |
| `RunFailed` | `agent`, `error: AgentError` | the run failed |
| `RunCompleted` | `agent` | the run finished (after Output or RunFailed) |
| `ToolStarted` | `agent`, `callId`, `tool`, `input` | a binding op is about to execute |
| `ToolCompleted` | `agent`, `callId`, `tool`, `output` | the op returned |
| `ToolFailed` | `agent`, `callId`, `tool`, `error` | the op threw; `ToolStarted`/`ToolCompleted`/`ToolFailed` stay balanced |
| `UsageReported` | `agent`, `usage: UsageReport` | a driver surfaced token usage (see below) |

`ToolStarted`/`ToolFailed`/`ToolCompleted` share `callId`, so a consumer can
pair the three. `Output`/`RunFailed`/`RunCompleted` are emitted by the harness
itself; `Tool*` events wrap binding ops; `UsageReported` is emitted by a driver
after a successful run, before `RunCompleted`.

### Driver events (`DriverEvent`, included in `HarnessEvent`)

| Event | Fields | When |
| --- | --- | --- |
| `DriverPrepared` | `agent`, `runtime`, `details` | a driver finished preparing its runtime (see docs/writable.md for declared writes) |
| `UsageReported` | `agent`, `usage` | a driver reported token usage after a successful run |

### Usage

`UsageReport` is `{ inputTokens, outputTokens, model? }` — raw token counts, all
nullable. `null` means the driver could not produce that number (honest
absence, not zero). Cost conversion is the caller's job (tokens x model price).
Per-driver support today: **vercel** (generateText aggregate usage) and
**codex** (turn.usage) report; **pi** exposes no usage surface in its SDK and
does not emit. **claude-code** exposes per-model usage records
(`SDKResultSuccess.modelUsage`) but no flat aggregate, and the accumulation
semantics across subagents/compaction are not defined yet — v1 does not emit;
a P1 candidate. A run reports at most one `UsageReported`, always before
`RunCompleted`. Failure-run usage (partial tokens) is not reported yet — known
limitation, planned with the unified event protocol.

## Kernel events (`ConnectionEvent`)

`ConnectionRuntime.events()` yields `{ connectionId, adapter, kind, payload? }`:

| kind | Payload | Meaning |
| --- | --- | --- |
| `connection.opened` | — | a connection session was established (single-flight: one per open) |
| `connection.closed` | — | a session was closed |
| `connection.failed` | `{ operation?, cause? }` | a close or invoke failed (never silent) |
| `connection.invoking` | `{ capability }` | an invoke started |
| `connection.invoked` | `{ capability, output }` | an invoke returned |

Adapters may extend the kernel set with adapter-scoped kinds: the **dsh** adapter streams live
runtime notifications as `dsh.*` kinds (`dsh.session.event`, `dsh.session.status`,
`dsh.subagent.started`, ...) — see docs/dsh-connection.md §6 for the namespace contract
(1:1 passthrough, wire order, lossless batch bounds, lineage boundaries).

## Content kinds (`AgentContext` entries)

`Text`, `Thinking`, `ToolCall`, `ToolResult`, `Object` — the `Content`
union carried through a run. Not events, listed here so the vocabulary lives in
one place.

## Hooks

Hooks are trusted Effects: a hook failure aborts the run as
`AgentFailure(hook:<name>)`. `UsageReported` emission is failure-tolerant by
design — a usage hook must never kill a run — but other events follow the
trusted-hook rule. (P12 plans a unified event/pause protocol with run ids and a
canonical event taxonomy; this page stays the source of truth until then.)
