# effect-agent

Agents compose from connections; agents are connections. Effect-TS all the
way down: the session log lives in Refs, the injection is an Effect, the
executable agent is a Context.Tag service provided through a Layer, and
every operation is an Effect with typed errors.

## The two abstractions

### Connection (the layered abstraction)

A **Connection** is the injectable unit: a named surface of tools (JSON-Schema
input/output, MCP-native) plus optional notation. An agent architecture
declares HOW it accepts connections - the six declaration modes, declared
**before** its shape:

| mode | declaration | matching |
|---|---|---|
| any | `any("mcp__")` | accepts any connection; tools take the fixed prefix |
| named | `named("grafana")` | accepts a connection by name; the name is the tool prefix (`grafana__`) |
| shaped | `shaped(shape)` | verifies the connection's tools against declared schemas (fails loud) |
| named + shaped | `namedShaped([...], shape)` | both |
| cascade | `cascade([...])` | a connection of connections; members flatten recursively to `stack__member__tool` |
| notated | `notation` on the connection | model-facing prose resolves from the notation store |

There is **no LLM concept**. The model is a connection: a built-in
**provider connection** carrying the generate capability
(`openaiProvider(config)`, `anthropicProvider(config)` - zero dependencies,
plain fetch under `Effect.tryPromise`). The MCP adapter (`mcpConnection`)
brings any MCP server in as an ordinary connection.

### Agent architecture (a blueprint, not a runnable thing)

`architect` defines what the agent IS - its connections, the architectures
it is built from, its prompt as a **notation target** (never resolved prose).
Defining what an agent does is not design; the architecture is. Only after
notation is injected does the architecture become a truly executable agent:

```ts
// 1. the architecture - inert
const lead = architect({
  name: "ops-lead",
  connections: { dashboards: named("grafana"), monitoring: any(), stack: cascade([]) },
  agents: [reviewer],                      // mix-build: architectures compose architectures
  prompt: "ops-lead/prompt",               // a notation TARGET
  maxSteps: 8
})

// 2. the injection - notation + provider connection + connection pool
const program = Effect.gen(function* () {
  const leadAgent = yield* inject(lead, {
    notation: store,                       // THE injection: prose resolves now
    model: openaiProvider({ apiKey, model }),
    connections: [grafana, prometheus, github, stack]
  })

  // 3. run - everything is an Effect
  yield* leadAgent.applyTools([grafana, github, stack])   // real-time rebind
  const reply = yield* leadAgent.invokeMessage("latency is spiking")
  const turns  = yield* leadAgent.listTurns
})
```

The executable agent carries the base shape:

```ts
applyTools(connections)      // Effect<void, BindError> - re-bindable in real time
updateSystemPrompt(prompt)   // Effect<void>
invokeMessage(content)       // Effect<string, AgentError> - the loop to an assistant reply
listTurns / listMessages     // Effects over the Ref-backed session log
asConnection                 // the agent as a connection (<name>__invokeMessage)
```

The service view: `Agent` is a Context.Tag; `layer(architecture, activation)`
provides it - architectures compose as Layers.

## All natural language flows through notation

Definitions reference targets, never prose (`src/notation.ts`). The
architecture is inert prose-free data; the notation store injected at
activation is the single prose source.

## The definition-time code ban

An architecture is PURE DATA. `architect()` enforces it on two layers:

1. **Types**: `architect()` takes `ArchitectureInput` - `agents` accepts only
   other blueprints, the connection spec accepts only the six pure-data
   declaration modes. A ready agent (all closures) or a Connection with
   `execute` functions cannot even typecheck into a slot.
2. **Runtime guard**: a deep inert-walk (`Reflect.ownKeys`) rejects
   functions, non-plain objects (console/Date/node namespaces), accessor
   properties (getters run on read), and non-data primitives - fail-loud
   with the precise path, e.g.
   `architecture "bad": architecture.io is not a plain object`.

Code enters the system only through connections at ACTIVATION (a tool's
`execute`) - the definition stays inert.

## Verify

```
bun test && npx tsc --noEmit
bun run examples            # auto-discovers examples/*.ts (offline ones)
bun run examples --live     # include the live ones (real provider, spends tokens)
bun run examples 01         # a single example by filename fragment
```

Examples self-describe: a filename containing `-live` runs against the real
provider and is skipped unless `--live` is passed.
