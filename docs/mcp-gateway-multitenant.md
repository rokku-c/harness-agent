# MCP Gateway Multi-Tenant Design: One External Tool Surface, user/app/system Identities, and View Projection

> Status: design v0.1 (2026-09-09). This is the implementation contract for the
> gateway identity, authorization, projection, and audit work.

## 1. Problem

The external MCP surface is split across several paths, identity is flat, there is no
credential system, and internal/external authorization use different models.

1. `POST /effect-apps` and `POST /mcp-gateway` both expose tools. `/effect-apps` bypasses
   gateway rules and audit. `/-/(mirror|lui)/<app>/call` is another bypass.
2. `identity.ts` treats `x-agent-id`, `x-session-id`, and `x-request-id` as trusted
   strings. There is no caller kind or view/projection model.
3. There is no token issuance or validation. Any caller can forge the current headers.
4. `effect-planes` and gateway mcpset/rules are parallel authorization systems and will
   drift.

## 2. Decisions

| # | Decision | Result |
|---|---|---|
| D1 | Identity classes | `user`, `app`, and `system`, stored as `principals.kind` |
| D2 | Class semantics | `kind` selects a default projection template. Explicit grants and consents can add or narrow scopes. Everything defaults to deny. Final authorization is `view(principal)`. |
| D3 | Credentials | Token-first: gateway issues opaque bearer tokens, stored as hashes, and resolves them to a principal. Claims are a trusted-internal fallback only. Both paths resolve through the same `principal -> view` model. |
| D4 | View scope | Project `tools/list` by principal, and audit every connection and call by principal. |
| D5 | Call enforcement | Enforce the same view on `tools/call`; a hidden tool must also be denied when called directly. |
| D6 | Data filtering | Out of scope for v1. Row/field filtering requires ownership metadata on task and config data. |
| D7 | External surface | Only `/mcp-gateway` remains externally reachable. `/effect-apps` becomes an internal managed surface. |
| D8 | Audit and authorization | Gateway compiles the view into the same internal grant table used by effect-planes. Do not keep a second authorization path. |

## 3. Goals and Non-Goals

Goals:

- One managed MCP entry point for external agents.
- `user`, `app`, and `system` principals with default surfaces plus explicit grants.
- Per-principal `tools/list`, with direct-call enforcement.
- Per-principal audit for monitor and observe.

Non-goals:

- Row and field level data filtering.
- A custom wire protocol. Keep MCP HTTP, stdio, and in-memory transports.
- Rewriting the in-process home/app authorization model. Reuse effect-planes.

## 4. Model

```text
principal = { kind: user|app|system, id, claims }
                 | kind selects TEMPLATE[kind]
                 | explicit grants/consents add or narrow scopes
                 v
view(principal) = TEMPLATE[kind] + GRANTS(p) - REVOKES(p)
                 | default deny
                 |
       tools/list projection, tools/call enforcement, audit
```

Default templates are implementation data. They should be materialized from the live
mcp-registry topology rather than hard-coded in the gateway.

## 5. Storage

Use the gateway app Config plane or a dedicated `gateway.sqlite` store. The final location
is an implementation decision for P0.

```text
principals(kind, id, display_name, status, created_at)
tokens(token_hash PK, principal_key FK, issued_at, expires_at, revoked_at, last_used_at)
grants(principal_key FK, scope_key, scopes[], source, expires_at)
templates(kind PK, scope_key, scopes[])
audit(call_id, principal_key, action, server_id, tool, decision, args_redacted, ts, duration_ms)
```

Store token hashes, never plaintext tokens. `scope_key` should normalize to either the
effect-planes resource address or the registry server id.

## 6. Identity and Credentials

1. External requests use `Authorization: Bearer ...`. The gateway hashes the token,
   checks expiry and revocation, and resolves the principal.
2. Trusted in-process or authenticated host requests may use `x-*` claim headers. The
   request must carry an explicit trusted boundary; bare headers are never trusted.
   An already-parsed claim bag (`authInfo.extra`) is trusted by construction — the
   caller hands over claims, not headers — so it needs no separate boundary flag.
3. Both paths produce `resolvePrincipal(req) -> { principal, view }`.
4. A request that presents a token which fails verification is denied outright. It must
   not fall through to the weaker sources, or a caller could downgrade by sending a
   token it knows is bad.

## 7. Authorization and View Projection

Add a view resolver inside `mcp-gateway`. It replaces direct agent-to-binding lookup.

```text
resolve(principal):
  effective = {}
  TEMPLATE[kind].forEach(add scopes)
  GRANTS[principal].forEach(add scopes)
  REVOKES[principal].forEach(remove scopes)
  return { visibleServers, tools, canCall(tool) }

list tools -> visible projection only
call tool  -> resolve again, enforce, audit allow or deny
```

Compile successful views into effect-planes grants so internal app calls and external
gateway calls use one authorization point.

### 7.1 Advertised tool surface

The gateway advertises the proxied catalog rather than one multiplexed call, so
`tools/list` is a real per-principal view instead of a constant.

- One flat tool per `(serverId, tool)`: `advertised = "<serverId>.<tool>"`, every
  character outside `[A-Za-z0-9_-]` folded to `_`.
- The advertised name is a **key into the catalog, never parsed back** into its parts —
  a tool whose own name contains the separator cannot be mistaken for another server's.
- Two entries that would advertise the same name is a configuration error and fails
  loudly at load time. Dropping one silently would hide a tool behind a view nobody wrote.
- The catalog is filled by listing each upstream (`McpToolLister`, one call per server).
  Listing is best-effort per server: a failure is reported, not thrown, and the server
  keeps the tools it last advertised. That is the safe direction — a stale entry can only
  lead to a call that enforcement still checks and upstream still rejects.
- A caller that resolves to no principal is advertised nothing. `tools/list` has no
  channel for a refusal; the direct call still answers `no_principal` in full.

## 8. Landing Points

| Area | Change |
|---|---|
| `identity.ts` | Trusted-boundary detection, token validation, claim parsing |
| `contract.ts` | Principal fields, token store, principal registry, view resolver interfaces |
| `sets.ts` | Keep mcpset semantics, resolve through the view resolver |
| `gateway.ts` | Audit principal decisions before and after calls |
| `mcp-server.ts` | Project `tools/list`; enforce view in `tools/call` |
| `apps/mcp-gateway-app` | Wire principals, tokens, grants, SQLite, and recorder |
| `effect-planes` | Export the shared grant enforcement point |
| `apps/effect-server` | Close external access to `/effect-apps` and `/-/.../call` |
| dogfood and README | Connect through `/mcp-gateway` with a system token |

## 9. Rollout

- P0: principals, tokens, hashing, expiry, revocation, trusted claim boundary.
- P1: templates, grants/revokes, view resolver, `tools/list`, `tools/call`, audit.
- P2: close `/effect-apps`, move dogfood to `/mcp-gateway`, close `/-/.../call`.
- P3: console UI for tokens, principals, bindings, view preview, and audit.

## 10. Open Questions

- Config-plane SQLite versus a dedicated `gateway.sqlite`.
- Token lifetime, rotation, and revocation propagation.
- The exact trusted boundary for claim headers.
- How to add ownership metadata before data-level filtering can exist.
- Audit retention and sampling policy for high-volume read calls.
