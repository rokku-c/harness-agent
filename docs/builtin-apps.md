# Built-In Apps: Product Portfolio and Completeness Contract

> Status: design v0.1 (2026-09-10).
>
> This document defines the first-party application portfolio for the
> effect-agent platform. It is the product boundary between the host, the SDK,
> built-in apps, examples, and third-party apps.

## 1. Decision Summary

The platform ships **8 product built-in apps**:

| App id | Display name | Primary responsibility |
|---|---|---|
| `board` | Board | Shared work graph for tasks, dependencies, status, and history |
| `mantis` | Mantis | Human-agent conversations, workspace records, memory, and approvals |
| `deckconsole` | Agents | Control room for heterogeneous agent sessions and launchers |
| `ui-host` | Canvas | Declarative UI, component catalogs, bindings, and renderer hosting |
| `mcp-registry` | Registry | Inventory of MCP servers, capabilities, leases, and health |
| `mcp-gateway` | Access | Agent-facing MCP entry point, projection, policy, and audit |
| `ai-gateway` | Models | Provider catalog, routing, credentials, usage, and failure policy |
| `agentd` | Machines | Nodes, agents, MCP configuration, and deployment state |

The platform also ships **2 system apps**:

| App id | Display name | Primary responsibility |
|---|---|---|
| `settings` | Settings | Aggregated schema-driven configuration for every app and the host |
| `activity` | Activity | Cross-app running state, approvals, audit, events, and failures |

The Console home, Dock, All Apps screen, status strip, and navigation stack are
host chrome. They are not apps. Settings and Activity are installed system apps
because users can open, search, navigate, and act in them.

`playground` is an example, not a built-in product app. The host planes
`config`, `console`, `effect-apps`, and `monitor` are infrastructure, not
counted as apps. The `effect-server` itself is the host.

## 2. Why These Apps Are Built In

An app belongs in the built-in portfolio only when at least one of these is
true:

1. It owns a platform invariant that every node must interpret the same way.
2. It is required to make an otherwise complete product workflow usable.
3. It is the reference implementation of a public SDK contract.

The portfolio follows that rule:

### Platform invariants

- **Board** owns the durable work graph. Agents and humans must not each invent
  task, dependency, status, or history semantics.
- **Registry** owns MCP topology. A server has one discoverable record for
  capability, transport, endpoint, ownership, and health.
- **Access** owns the external MCP surface. Projection, policy, and audit must
  be decided at one point.
- **Models** owns model-provider routing. Provider selection, credentials,
  fallback, usage, and redaction must not be duplicated by every agent.
- **Machines** owns node and agent configuration. Runtime placement and config
  distribution must not live in individual domain apps.

### Complete workflows

- **Mantis** is the reference human-agent workbench: conversation, tools,
  workspace state, memory, and operator approval in one loop.
- **Agents** is the reference cross-runtime control room: one model for
  in-process, SDK, CLI, and custom agents.
- **Canvas** is the reference declarative UI host: definitions, bindings,
  renderers, themes, and agent-authored surfaces.

### System experience

- **Settings** is required because configuration is a platform-wide contract,
  not an app-specific page.
- **Activity** is required because users need one place to answer what is
  running, what is waiting, what failed, and what changed.

## 3. Non-Goals

The built-in portfolio must not keep growing by promotion:

- A workflow that can be a third-party app stays third-party unless it owns a
  platform invariant.
- A deployment-specific channel is not an app. DingTalk, web, MCP, and future
  channels are hosts over the same app model.
- A generic storage browser is not automatically an app. Files become a
  built-in app only when files are a first-class shared object model with
  stable agent and human semantics.
- A separate Logs, Audit, Approvals, Jobs, or Notifications app is not needed
  while Activity can own those projections.
- An App Store is not required for the first complete portfolio. App install,
  update, and rollback belong to host lifecycle plus Settings until a marketplace
  product is explicitly designed.
- `playground` remains a runnable example and acceptance aid. It must not be
  registered as a shipped app.

## 4. Portfolio Model

Every built-in app is described on four independent axes:

| Axis | Values | Meaning |
|---|---|---|
| distribution | `built-in`, `first-party`, `third-party` | Who ships the artifact |
| activation | `required`, `default`, `optional` | Whether the host enables it |
| presentation | `home`, `settings-only`, `hidden` | Where users reach it |
| surface | `human`, `agent`, `config`, `events` | Planes the app exposes |

Distribution does not imply activation, and activation does not imply Home
visibility. A control-plane app can be enabled by default while being
settings-first if it has no useful human object view.

The target activation is:

| App | Distribution | Activation | Presentation |
|---|---|---|---|
| Board | built-in | default | Home and Dock |
| Mantis | built-in | optional | Home |
| Agents | built-in | default | Home |
| Canvas | built-in | default | Home |
| Registry | built-in | default | Home and Settings |
| Access | built-in | default | Home and Settings |
| Models | built-in | default | Home and Settings |
| Machines | built-in | default | Home and Settings |
| Settings | built-in system | required | Dock and Home |
| Activity | built-in system | required | Dock and Home |

Optional means installed and fully usable, with providers, channels, or
credentials configured before its primary workflow starts.

## 5. App Contracts

### Board

Purpose: the durable work graph shared by humans and agents.

Required capabilities:

- create, read, update, delete, move, and query work items;
- parent/child structure, dependencies, blockers, assignee, priority, and
  status;
- immutable event history and provenance;
- table, tree, and board projections over the same data;
- agent tools with the same operations and validation as the human UI.

Owns: work items, relations, status history, Board events.

Does not own: agent scheduling, machine access, model credentials, or runtime
launch policy.

Complete when a user can plan a tree, run an agent against a leaf, observe
progress, resolve a blocker, and inspect history without leaving Board.

### Mantis

Purpose: the reference human-agent workbench.

Required capabilities:

- conversations with durable memory and visible tool activity;
- a shared workspace of records with human and agent provenance;
- an approval inbox that blocks protected operations;
- configurable model, tool supply, and approval policy;
- channel hosts for web and external messaging over the same session model.

Owns: conversations, workspace records, agent memory, approval state.

Does not own: MCP topology, provider selection, or machine deployment.

Complete when the web console can create a conversation, use a real model,
write durable records, request approval, resume after restart, and render the
same app through its descriptor.

### Agents

Purpose: operate heterogeneous agent runtimes as one fleet.

Required capabilities:

- discover launchers and supported agent kinds;
- open, send, inspect, interrupt, and close sessions;
- normalize runtime configuration without losing raw settings;
- show consent and approval state per session;
- persist launcher groups and restore session metadata after restart.

Owns: runtime sessions and launcher metadata, not product work items.

Does not own: model-provider configuration, MCP tool policy, or durable
workspace records.

Complete when in-process, SDK, CLI, and custom-agent sessions can all be
observed and controlled through the same UI and tool surface.

### Canvas

Purpose: host declarative UI and agent-authored surfaces.

Required capabilities:

- catalog components, canvases, props schemas, slots, and versions;
- navigate between canvases with scoped parameters;
- read and mutate bindings through audited commands;
- select renderers and themes without changing app semantics;
- run sandboxed scripts only through injected capabilities.

Owns: UI definitions, canvas instances, bindings, and renderer selection.

Does not own: business data or domain authorization.

Complete when a user can create a canvas, bind live data, interact with it,
change its theme, and reopen it after restart without hand-written per-app
renderer code.

### Registry

Purpose: the authoritative MCP server inventory.

Required capabilities:

- register and withdraw servers with owner identity;
- store transport, endpoint, command, capabilities, apps, and era;
- heartbeat, lease expiry, health, and offline detection;
- search, filter, inspect, and preview `ui://` resources;
- expose inventory operations to agents through stable tools.

Owns: server records, leases, health, and capability metadata.

Does not own: client bindings or per-agent access policy.

Complete when a server can register, become visible, report health, provide a
UI resource, lose its lease, and disappear from reachable topology with an
auditable reason.

### Access

Purpose: the single governed MCP entry point for agents.

Required capabilities:

- resolve identity and bind one agent to sets;
- project `tools/list` and enforce `tools/call` from the same view;
- support proxy and native tool surfaces;
- apply allow/deny rules and re-authorize calls after list;
- record principal, decision, upstream, latency, and redacted arguments;
- preview effective access per agent and explain every denial.

Owns: sets, bindings, projection, decisions, and MCP audit.

Does not own: server health or model routing.

Complete when one agent can see only its projected tools, a hidden tool cannot
be called directly, the decision is auditable, and the server can be withdrawn
without leaving stale access.

### Models

Purpose: one provider and policy layer for every model call.

Required capabilities:

- named providers, API types, endpoints, credentials, and headers;
- routing rules by agent, workload, model, or priority;
- retries, fallback policy, and failure classification;
- usage accounting and request/response metadata;
- secret redaction and safe diagnostics;
- live test and health status per provider.

Owns: provider catalog, routing policy, credentials, usage, and gateway audit.

Does not own: agent prompts, tool approval, or workspace memory.

Complete when a caller can select a logical route rather than a provider URL,
fallback is observable, credentials never leak, and provider health changes
without restarting the host.

### Machines

Purpose: node, agent, and MCP configuration control.

Required capabilities:

- register machines and their capabilities;
- register agent identities and supported runtimes;
- register MCP servers and define machine or agent sets;
- bind agents to sets and generate compatible runtime configuration;
- show desired versus applied revision and connection status;
- revoke access and rotate registration credentials.

Owns: node inventory, agent identity, desired configuration, and deployment
revision.

Does not own: MCP request authorization itself or launch scheduling owned by
Board or a future scheduler app.

Complete when a node can enroll, receive configuration, report application
status, reconnect after a restart, and be revoked without editing local files
by hand.

## 6. Completeness Contract

An app is not "complete" because its route returns HTML. Every built-in app
must satisfy this contract:

### Manifest

- stable `id`, title, description, category, and icon;
- explicit activation and presentation metadata;
- declared routes, egress policy, dependencies, and storage ownership;
- one portable descriptor usable by every runtime target.

### Human surface

- openable from Home when declared as `home`, otherwise discoverable through
  Settings or All Apps;
- loading, empty, error, permission, and offline states;
- a primary workflow that can be completed without developer tools;
- responsive behavior at phone, tablet, and desktop widths;
- no dead placeholder buttons or static fake data.

### Agent surface

- every meaningful operation has a typed tool or command contract;
- human and agent operations share validation and authorization;
- denied operations explain why and produce an audit record;
- tool metadata is visible in Activity and Settings where relevant.

### Configuration

- schema is registered through the app descriptor;
- defaults, YAML, override, apply, and restart semantics are explicit;
- invalid values fail clearly without partially applying state.

### Data

- one owner for every durable entity;
- no app reads another app's storage file directly;
- restart preserves committed state;
- replacement or rollback does not strand data in an unreadable format.

### Lifecycle

- enable, disable, reload, and failure rollback are symmetric;
- routes, tools, UI resources, listeners, and background work are withdrawn;
- compatible hot updates preserve the app's public contract.

### Observation

- app health, active operations, failures, approvals, and audit are visible;
- every event has app id, operation, actor, correlation id, and timestamp.

### Acceptance

Each app keeps automated coverage for its primary workflow and failure path,
plus a real browser or host smoke test for its shipped surface. Placeholder UI
tests do not count as completion.

## 7. Current To Target

| App | Current state | Main gap |
|---|---|---|
| Board | Real CRUD, tree, events, SQLite, web and MCP | Scheduling workflow and cross-app Activity integration |
| Mantis | Real worker and web UI, declarative facade is not live | Descriptor must expose the real hosted console and durable platform config |
| Agents | Real standalone control room and launchers | Embedded lifecycle, durable runtime restoration, Activity integration |
| Canvas | Real host with canvases, renderers, activity store, and UI bridge | Full editor workflow and agent command parity |
| Registry | Real registry, leases, and config UI | UI is a static summary; add live catalog, health, register, withdraw |
| Access | Real gateway pipeline and config UI | Native list aggregation and principal-aware policy/audit UI |
| Models | Real proxy, providers, routing, rules, and tests | No first-class dashboard for providers, routes, health, usage, and secrets |
| Machines | Real control model and tools | No real UI or durable desired/applied configuration workflow |

The next implementation order is:

1. Add explicit built-in app metadata and make Home, Dock, All Apps, and
   Settings derive from it.
2. Make Settings and Activity complete system apps before adding any new
   built-in app.
3. Replace static app summaries with live Registry, Access, Models, and
   Machines dashboards.
4. Make Mantis expose its real hosted console through the standard descriptor.
5. Bring every app to the completeness contract one app at a time, with a
   browser smoke and an agent-operation test for each.

