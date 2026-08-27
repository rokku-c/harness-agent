# Writable Design (DRAFT 6.4, completeness item 1)

> Status: settled after review (group effect-agent-writable board v2). Implements the
> missing DRAFT 6.4 Binding capability: committing deterministic results to external systems.

## 1. Current facts (verified)

- `Binding = { uri, read?, typed?, ops? }` — no `write`; the four DRAFT capability traits
  (Readable/Typed/Operable/Writable) are collapsed into one optional-field interface.
- `Agent.define(...).writes(b)` only flips `access.write` to true; it does not require the
  binding to actually be writable (a type-level lie). Zero callers today, so tightening is free.
- Driver tool injection already filters ops by access (vercel/cc/pi; codex has no injection),
  so "undeclared writes" cannot reach the tool loop. No hole; a regression test is missing.
- `materialize` is read-only (read -> content into context); there is no write path.
- DRAFT 11.4 mount authorization is not implemented: claude-code's `cwd`/`permissionMode`
  come entirely from user options and ignore access declarations, so `writes()` currently has
  zero runtime effect.

## 2. Decisions

- **D1** — `Binding` gains `write?: (value: A) => Effect.Effect<void, E, R>` where `A` is the
  typed value type (DRAFT 6.4, verbatim). Writable = deterministic commit to an external system,
  distinct from `Op.write` (a named tool call chosen by the model inside the run).
- **D2** — `AgentBuilder.writes(b)` takes a `WritableBinding` (`Binding & { write: (value: A) =>
  Effect.Effect<void, E, R> }`), so passing a non-writable binding fails at compile time.
  Negative cases use `@ts-expect-error` and are covered by `bun run typecheck` (tsc --noEmit),
  since bun test does not type-check.
- **D3** — the commit point: after the `Until.schema` branch decodes successfully, commit the
  deterministic output to every declared-write binding via `binding.write(output)`. A shared
  helper `commitSchemaResult(request, value)` in `src/core.ts` is used by all four drivers
  (vercel `result.output` / pi object / codex parsed finalResponse / cc structured output).
  Multiple write bindings each receive the same output (documented; usually one). A failing
  `write` fails the run wrapped as `AgentFailure`. Text/stop outputs have no deterministic
  structure and are not committed (P1 candidate: text-output commit).
- **D4** — permission semantics, split by what is real. **Semantic clarification:**
  `writes()` neither grants nor denies file access for a ComposedAgent today (DRAFT 11.4 is not
  implemented); Claude Code's file capability is entirely decided by the user's
  `permissionMode`/`tools` configuration. Do not read `writes(Workspace)` as granting write
  permissions to the external agent.
  - op-injection gating: already implemented; add a regression test (pi test covers it).
  - claude-code mount gate (DRAFT 11.3 "undeclared writes -> read-only"): **not expressible in
    the current SDK** — verified `PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions'
    | 'plan' | 'dontAsk' | 'auto'` (sdk.d.ts:2171); there is no read-only mode. The implemented
    substitute is honest observability: the driver reports `declaredWrites` in the
    DriverPrepared details and keeps the permission defaults untouched. Structural safety today:
    built-in tools default to hidden and injected ops are filtered by access (both tested).
    Real enforcement is a P1 candidate via a default `PermissionRequest` hook that denies
    write-class tool requests when no write access is declared (SDK supports deny decisions);
    binding-to-cwd mapping is likewise P1. Recorded in Known-Limitation, not faked.
    (`'plan'` mode exists but is a behavioral mode that changes what the agent does, not an
    enforcement gate; it was considered and rejected for this purpose.)
    Verify-once note: the structural claim "built-in tools default to hidden" depends on the SDK
    semantics of an empty `tools: []`; confirm in the gated real-runtime smoke.
- **D5** — the written value is a *commit record of the deterministic output*: serializable, so
  it can feed a state projection later (goal: full-chain persistence; soft constraint only,
  hard schema validation is P1).

## 3. Boundaries

- No splitting of the four traits into distinct types (PR_REVIEW aspirational API, P2).
- No cross-process event replay (known gap).
- No binding-to-cwd mapping / full Container authorization matrix (DRAFT 11.4, P1).
- BehaviorSpec `resources` access is not wired into uses/writes today (compileBehavior only
  validates existence) — recorded as a P2 gap ahead of ResourceRef/Resolver.

## 4. Acceptance

1. `writes(writableBinding)` compiles; `writes(nonWritableBinding)` fails via `@ts-expect-error`
   under `bun run typecheck`.
2. `commitSchemaResult` wired into all four drivers' Schema branches; unit tests: mock write
   invoked with the decoded value, error propagates as `AgentFailure`, multiple bindings each
   receive the output.
3. claude-code gate (observational, per D4): no declared write -> `declaredWrites: 0` in the
   DriverPrepared details and permissionMode/defaults untouched; declared write -> count reported
   and an explicit user `permissionMode` is respected. (No read-only mode exists in the SDK;
   the record above documents the substitute and the P1 enforcement candidate.)
4. Access-filter regression test for the three injecting drivers.
5. `bun run typecheck` + `bun test` all green; no behavior regression in the non-schema paths.

## 5. Files (expected)

- `src/core.ts` — `Binding.write?`, `WritableBinding`, `commitSchemaResult`.
- `src/agent.ts` — `AgentBuilder.writes` parameter type.
- `src/vercel.ts`, `src/composed/claude-code.ts`, `src/composed/codex.ts`,
  `src/composed/pi.ts` — call `commitSchemaResult` after decode in the Schema branch;
  claude-code readOnly gate in run options.
- `test/` — new writable tests + access-filter regression + negative type cases.
- `docs/writable.md` — this record.
