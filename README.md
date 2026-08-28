# effect-agent

Agents compose from connections; agents are connections. Effect-native:
the Llm port, tool execution, and agent invocation are all Effects - so
agent composition is Effect composition, and the connection surface and
the program surface are one.

## The two abstractions

### Connection (the layered abstraction)

A **Connection** is the injectable unit: a named surface of tools (JSON-Schema
input/output, MCP-native) plus optional notation. An agent declares HOW it
accepts connections - the six declaration modes, declared **before** its shape:

| mode | declaration | matching |
|---|---|---|
| any | `any("mcp__")` | accepts any connection; tools take the fixed prefix |
| named | `named("grafana")` | accepts a connection by name; the name is the tool prefix (`grafana__`) |
| shaped | `shaped(shape)` | verifies the connection's tools against declared schemas (fails loud) |
| named + shaped | `namedShaped([...], shape)` | both |
| cascade | `cascade([...])` | a connection of connections; members flatten to `stack__member__tool` |
| notated | `notation` on the connection | model-facing prose resolves from the notation store |

### Agent (an agent is a connection)

The **base agent is the LLM** - we never define a model; a runtime adapts into
the `Llm` port. Every agent carries the base shape (customizable):

```ts
applyTools(connections)      // bind connections now - re-bindable in real time
updateSystemPrompt(prompt)   // notation-injected text
invokeMessage(content)       // run the loop to an assistant reply
listTurns() / listMessages() // the session log (the log is the truth)
```

An agent depends on other agents through the same connection mechanism: a
dependent agent surfaces as `<name>__invokeMessage` in the parent's tool
surface. The session log is append-only; turns are its slices.

## Definition order

```ts
const lead = defineAgent({
  name: "ops-lead",
  connections: {                     // 1. connections FIRST
    dashboards: named("grafana"),
    monitoring: any(),               // MCP-like
    stack: cascade([])
  },
  agents: [reviewer],                // agent dependencies (static composition)
  prompt: { store, target: "ops-lead/prompt" },  // 2. then the shape
  maxSteps: 8
}, llm)                              // the base: an adapted LLM

lead.applyTools([grafana, stack, github]) // 3. runtime injection
await lead.invokeMessage("...")
```

All natural-language text reaching a model flows through **notation** -
definitions reference targets, never prose (`src/notation.ts`).

## Verify

```
bun test && npx tsc --noEmit
bun run examples/01-connections.ts
```
