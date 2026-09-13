> Historical record: this round's migration/three-fixed-protocol-block design has been superseded by `platform-refactor-tasks.md` and `config-providers.md`; it is not the current contract.

# SQLite config and protocol routing: current implementation plan

Date: 2026-09-08. The workspace contains pre-existing uncommitted changes; do not overwrite and do not commit production credentials.

## Deliverables this round

| task | owner | write boundary | acceptance |
|---|---|---|---|
| A Authoritative config | Raman | packages/effect-config | first import, SQLite reopen, sources, invalid save leaves config unchanged, old data migration |
| B Protocol routing | Hypatia | apps/ai-gateway, packages/ai-gateway | independent URL/auth per protocol, deny by default, hot read, old schema migration |
| C Config UI | Pascal | effect-ui forms, console page/client | three provider blocks, correct types, save/apply status |
| D Invocation and lifecycle | Kant | effect-apps, effect-parity mapping | cross-app isolation, validation, load rollback, symmetric unregistration |
| E Wiring existing apps | Halley | Board/UI Host/Deck plugins and Board HTTP layering | injected config, lazy load, web contract |
| F Host integration | main thread | effect-server composition root/config routing/monitor | real Save→route change, restart, migration, composition test |

## Locked contracts

- config schema defaults + effect.yaml config + old override are merged only at initialisation.
- SQLite saves the validated full value, sources and version, and is authoritative thereafter. A YAML change does not implicitly overwrite saved values.
- providers = [{ apiType, baseURL, apiKey? }]; at most one per apiType.
- apiType = openai.chat / openai.responses / anthropic.message.
- Routing is by exact path only. A missing provider returns 503; an unknown path returns 404.
- A provider does not fill values from environment variables or built-in URLs. A key does not reuse the caller's credentials.
- baseURL is an API root or service root and may contain a path prefix; the corresponding protocol path is appended rather than the prefix erased.
- POST /console/api/config/:id: {override, strategy: apply|restart, unset?:string[]}.
- Clearing an optional field uses unset to delete it explicitly; an empty string is not used to fake "unset".
- apply saves and applies; restart only saves, and the old active config stays until an explicit apply or a process restart.
- POST /console/api/config/:id/apply: applies the saved config.
- GET returns the saved value, revision and pendingRestart together; a successful save is not disguised as already in effect at runtime.
- Old JSON and old SQLite overrides are migrated once only, keeping the source file; apps own old-schema migration.

## Not expanded this round

Board single-writer and scheduling state recovery, remote authentication, and full MCP Schema bridging are separate stages.
The boundary fixes this round do not claim multi-tenant or remotely secure deployment capability.

Deckconsole's `startDeckServer` does not yet expose an SQLite disposer; the current plugin `stop` only stops the HTTP listener, so it cannot claim the database connection is closed on apply/reload. SQLite close is left to a separate lifecycle task and is not expanded this round.

## Progress (completed this round)

- A/B/C/D/E workers all completed and closed; the main thread did the integration and review.
- Verified SQLite reopen, migration of both old stores, key-only migration, and YAML import for a late-registered bundle.
- Verified independent routing/auth per protocol, unknown-route rejection, streaming forwarding, and real Save→apply→restart.
- Verified cross-app/namespace spoofing rejection, unified mirror-and-agent validation, registration/unregistration races and failure cleanup.
- Browser: three desktop form blocks, pending restart/explicit apply, and optional boolean clearing pass; no horizontal overflow at 390px.
- All tests use mock upstreams and an isolated config database; no real user config or running instance was migrated/restarted.
- Run instructions: see `docs/config-providers.md`.

## Verification results

- Composition targeted tests this round: 265 pass, 0 fail; not a full-repo test run.
- tsc passes for the affected scope; two read-only array type errors in the chain dependencies were fixed.
- The 100-line check passes for this round's core scope; other historical over-limit files in the repo are not claimed as cleared this round.
- Import boundary: 0 errors, 12 existing warnings about other dependency declarations; the diff whitespace check passes.

## Next batch of tasks (not yet implemented)

1. Board: pin a single state owner; restore resource occupancy/wait queue/Probe commands, and cross-check orphan executions after a restart.
2. Unified runtime config: clean up fields that are "declared but not wired to runtime", such as Board coordinator/captureBodies and the Mantis facade.
3. Lifecycle: explicit close of the Deck database; unify ownership of async persistent resources.
4. Remote capability: trusted identity and authorisation entry, full MCP Schema bridging, real multi-instance namespaces; name-based isolation is not a substitute for authentication.
