# AI Gateway architecture

AI Gateway sits between the Agent/Model and the model provider, proxying requests and providing unified observation, recording and behavior control.
It does not enter the Agent loop, does not depend on the UI, and does not replace the provider SDK.

## Layers and packages

1. `@effect-agent/ai-gateway`: the embeddable control pipeline.
   - `contract`: request context, audit events, upstream and recording ports.
   - `rules`: declarative control rules matched by agent/session/model/path.
   - `injection`: system prompt injection after protocol adaptation; every modification is auditable.
   - `redaction`: redact before recording; never persist Authorization.
   - `gateway`: a fixed execution order, containing no product rules.
2. `apps/ai-gateway`: the deployment shell.
   - OpenAI/Anthropic HTTP routes, identity extraction, config loading, health checks.
   - Assembles rules, upstreams and recorders; writes to SQLite through TypeORM by default.
3. `@effect-agent/storage-typeorm`: a general dynamic storage adapter layer.
   - Implements the existing `StoreService`, using the TypeORM `sqljs` SQLite driver by default.
   - Supports appending `EntitySchema` at run time, and also accepts other TypeORM `DataSourceOptions`.
   - Reusable by checkpoint, memory, UI and Gateway; it does not enter the domain core.
4. The existing `@effect-agent/model`: keeps its model-client responsibility; you only point `baseURL` at the Gateway.

## Request chain

`identity extraction → protocol parsing → rule decision → auditable injection → upstream proxy → response observation → redacted recording`

Pass-through is allowed by default; controls such as denial, rerouting and rate limiting come from explicit rules. Injection rules must have a stable `ruleId`,
and must record the matched rule, the insertion position and a content digest. Raw credentials never enter an event; whether request/response bodies are recorded is decided by the deployment config.

## Not put into the core

- FastMCP, Gradio: unrelated to model HTTP proxying.
- Product-specific prompts, tenant lists, billing plans: these belong to app config.
- Agent tool execution approval: still `@effect-agent/gate`'s job; the Gateway only controls the model-call boundary.
- UI canvas permissions: still the UI host/agent adapter's.

## Evolution order

1. OpenAI-compatible non-streaming proxy, rule injection, JSONL audit.
2. SSE streaming pass-through, usage/latency/error metrics, request correlation IDs.
3. Anthropic adapter, routing/fallback/retry, token and cost budgets.
4. A dynamic rule control plane; versioned rules with canary rollout and rollback.
