# Layered Packages

effect-agent is split into layers along the axis of change: the core algebra stays
minimal and stable; everything else is a replaceable implementation (Tag + Layer)
composed by assembly into a runnable instance.

## Layers & Packages

```
┌────────────────────────────────────────────────────────────┐
│ L5 Application  apps/playground (app-playground)           │ ← swappable: concrete agent apps
├────────────────────────────────────────────────────────────┤
│ Cross-cutting  packages/assembly (@effect-agent/assembly)  │ ← composition: assembleDefault + profile
├────────────────────────────────────────────────────────────┤
│ L4 Orchestration  packages/gate (@effect-agent/gate)       │ ← approval/confirmation (before tool exec)
│                   packages/schedule (@effect-agent/schedule)│ ← timers/reminders/self-triggering
├────────────────────────────────────────────────────────────┤
│ L3 Core  packages/core (@effect-agent/core)                │ ← algebra (stable): Agent/Until/Op/Binding/Driver/
│           packages/builtin (@effect-agent/builtin)         │   Runtime/Session/Checkpoint/Hooks/Coordination
│                                                            │ ← default drivers: EffectAgent/ClaudeCode
├────────────────────────────────────────────────────────────┤
│ L2 State  packages/state (@effect-agent/state)             │ ← Store + EventLog (fact source vs projection)
│            packages/memory (@effect-agent/memory)          │ ← long-term memory (write/retrieve/promote hook)
├────────────────────────────────────────────────────────────┤
│ L1 Base  packages/model (@effect-agent/model)              │ ← Model contract + providers (openai/anthropic)
│           packages/channel (@effect-agent/channel)         │ ← Ingress/Delivery channels
│           packages/tools (@effect-agent/tools)             │ ← tool registry (API-as-data) + MCP adapter
└────────────────────────────────────────────────────────────┘
```

## Dependency Rules

- **core has zero dependencies** (only effect); any package may depend on core, core
  knows nothing about upper layers.
- **Dependencies point upward only**: L4 depends on L3/L2/L1, L2 on L1; L1 packages do
  not depend on each other.
- **assembly is the composition root**: it depends on every package and wires the layers'
  Layers into a runnable instance.
- **Same-layer collaboration goes through interfaces** (Tag), never by importing concrete
  implementations.
- A replaceable element = `Context.Tag` service + default Layer + optional Layer; swapping
  an implementation = swapping the Layer (agenthost pattern).

## Element → Package Map

| Element | Package | Notes |
|---|---|---|
| E1 AgentDefinition / E2 Driver / E3 Capability / E5 Supervision / Until / Hooks | core | pure algebra (existing) |
| E2 default Drivers (EffectAgent/ClaudeCode/Providers) | builtin | default implementations (existing) |
| E6 Model | model | contract + openai/anthropic providers + config catalog |
| E7 Channel | channel | Ingress/Delivery contract + in-memory default |
| E8 ToolTransport | tools | Op registry (API-as-data) + MCP client adapter |
| E4 State + E9 EventLog + E11 Checkpoint storage | state | Store contract + memory/JSONL + checkpoint persistence |
| E10 Memory | memory | memory contract + simple implementation (promote hook) |
| E12 Gate | gate | approval/confirmation (AllowAll/Ask implementations) |
| E13 Scheduler | schedule | timers/reminders (Interval/At triggers) |
| E14 ThoughtRuntime / E15 Attention | (swappable mount) | as Driver variant / prompt layer, outside this layer matrix |
| **self-bootstrapping capability sandbox** | script | scripts compose toolcalls into higher-level tools; closure visibility + content-addressed versions + graded compatibility + one Policy type (see docs/script-sandbox.md) |
| Boundary / Observability / Assembly | core (access) / core (Hooks) + state (EventLog) / assembly | cross-cutting |

## Capability Sandbox (@effect-agent/script) — recursive bootstrap

Tool-level recursion (scripts define tools), version-level recursion (hash locks the
dependency closure), config-level recursion (system/agent share one Policy + derived
narrowing), agent-level recursion (root derivation narrows scope) — the four layers are
one "scope + policy" pattern; see [script-sandbox.md](script-sandbox.md).
