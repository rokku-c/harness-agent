# Writing a driver (author guide)

This is the guide for **driver authors** - people wiring a runtime (an SDK, a
CLI, a local model) into effect-agent as a `Driver`. It documents the contract
and the shared run skeleton; it is not a library abstraction you extend. A
driver is a plain object:

```ts
const driver: Driver = {
  id: "my-runtime",
  capabilities: { /* honest declaration - see below */ },
  run: <A, R>(request: RunRequest<A, R>) => runToCompletion(request, {
    id: "my-runtime",
    capabilities,
    generate: (materialized) => /* your runtime's complete execution */
  })
}
```

## 1. The Driver contract

- **`id`** identifies the driver in errors (`AgentFailure.agent`) and events.
- **`capabilities`** are an *honest declaration* of what the runtime can do:
  `granularity` (run/turn/event), `thinking`, `tools`/`toolCalls`
  (`"none" | "observe" | "intercept"`), `structuredOutput`, `cancel`/`pause`/
  `resume`/`fork`, `sandbox`. The skeleton's `requireUntil` rejects an `Until`
  the capabilities cannot serve *before anything runs* - declaring more than
  the runtime delivers is the classic drift bug (B3a lesson): a declared
  thinking channel that never emits makes agent programs hang, not fail.
- **`run`** receives a `RunRequest { context, until, access, report? }` and
  returns `Effect<A, AgentError, R | RD>`. Delegate it to
  `runToCompletion` - do not re-implement the frame.
- **Error events**: failures are `AgentFailure { agent, cause, message? }` -
  keep `cause` as the original error (callers introspect it) and use
  `message` only for runtime-specific context worth reading (e.g. which
  binary/home dir failed). `report` emits `DriverEvent`s (`UsageReported`,
  `DriverPrepared`, ...) to the caller's hook; a failing or defective hook
  must never kill the run (the skeleton wraps usage reporting in
  `catchAllCause`; your own `report` calls should do the same).

## 2. The run-loop convention (`runToCompletion`)

`runToCompletion(request, contract)` (from `src/driver.ts`) owns the frame
every driver repeats; `generate` owns the runtime-specific execution:

``	s
runToCompletion(request, {
  id, capabilities,
  generate: (materialized) => Effect<DriverGenerate, AgentError, R | RD>
})
```

Skeleton order (do not reorder in `generate` without cause):

1. `requireUntil` - capability negotiation; rejects unsupported `Until` first.
2. `materialize` - the declared `access` bindings are read and appended to the
   context; `generate` receives the materialized request (render
   `materialized.context`, filter ops by `materialized.access`).
3. `generate` - **the driver's complete execution**, tool loop included. The
   four tool-loop variants (native tool APIs, binding.ops injection, MCP
   config-driven tools, fail-early SDKs with no tool channel) are *not*
   unified - they stay inside each driver's `generate`.
4. usage - if `generate` returned a `usage`, the skeleton reports
   `UsageReported` **exactly once, on success** (wrapped in
   `catchAllCause`). Omit the field when the runtime exposes no usage
   surface - nulls are honest data, absence is honest silence.
5. Until dispatch - `Text`/`Stop` return `raw`; `Thinking` returns
   `reasoningText`; `ToolCall` is the unreachable P1-only branch for
   `toolCalls: "observe"` drivers; `Schema` decodes `raw` against
   `until.schema` and commits (`commitSchemaResult`) uniformly.

**The `generate` result is normalized**: `{ raw, reasoningText?, toolCall?,
usage? }` where `raw` is the *already-parsed* value for `Schema` (vercel
takes `result.output`, codex `JSON.parse`s the final response, pi captures
the output-tool argument, claude-code takes `structured_output`) and the
assistant text for `Text`/`Stop`. One decode+commit lives in the skeleton -
without this normalization the Schema branch degenerates into a four-way
`if`, and the skeleton would be fake.

A driver whose run needs a scope (resource finalizers, e.g. aborting a
session) wraps the whole call: `runToCompletion(...).pipe(Effect.scoped)` -
`Effect.addFinalizer` inside `generate` attaches to that boundary.

## 3. Usage mapping and error layering

- **Usage** (`UsageReport { inputTokens, outputTokens, model }`): map the
  runtime's accounting verbatim - snake_case fields map by name, aggregate
  fields the SDK already sums are taken as-is (never re-read a `.total`), and
  a runtime with no accounting returns nothing (or honest nulls when the SDK
  declares the field but the turn produced none).
- **Tool errors** (B3b): a failing tool op becomes a structured, model-visible
  tool result (`toolErrorJson`) so the turn can retry; only
  `onError: "fail"` ops escape to fail the run as `AgentFailure`.
- **Run errors**: everything else fails as `AgentFailure { agent, cause }` -
  the skeleton's Schema branch attributes decode failures to
  `agent: "schema"`; your runtime failures carry your `id` and the original
  `cause`.

See `examples/10-custom-driver.ts` for a complete minimal driver, and the
composed drivers (`src/composed/*.ts`, `src/vercel.ts`) - all four are
migrated to the skeleton and are the reference implementations.
