# AGENTS.md

Conventions for every agent changing this repository (`packages/` and `apps/`).

## English-first product and documentation

- Product UI, user-facing errors, examples, and repository documentation are English-first.
- Do not mix Chinese and English in one UI surface or document. Use consistent terminology.
- Do not add ad-hoc locale branches or inline translations. If another language is supported,
  use a standard i18n mechanism with message keys, complete locale catalogs, locale fallback,
  and locale-aware formatting. English (`en-US`) is the default locale.
- App-provided names may remain data supplied by that app; platform-owned labels must follow
  the English-first rule.

## No backward compatibility

- Evolve the current design directly: by default do **not** preserve old interfaces, config,
  protocols, database structures, or behavior.
- Delete replaced implementations and callers. Do not add compatibility layers, aliases,
  dual paths, legacy fallbacks, migrations, or old-format detection.
- Do not preserve deleted product capabilities for historical tests; update tests to the current
  contract. Do not rewrite or delete old data automatically; reject invalid formats clearly and
  let the operator decide whether to rebuild.
- Make an exception only when the user explicitly requests compatibility, and state its scope
  and removal condition.

## Separate app, network, and access governance

- Built-in apps default to services/handlers without listening ports; apps declare routes through
  the SDK, and the host registers and revokes them with lifecycle symmetry.
- The platform owns listeners, route tables, and egress. Registered ports share one service view
  by default; port differences require explicit configuration.
- An app may own a port, but must create/close it and enforce its access policy itself; never
  disguise it as a platform-managed port.
- App egress uses the SDK egress interface, with explicit local-first, main-first, local-only,
  or main-only policy.
- Egress selection and upstream selection are separate layers; an unavailable egress must not
  implicitly replay a write request that was already sent.
- Board owns board/task data only; it does not own agent scheduling, resource governors, Claude
  configuration, or machine access.
- Machine-agent configuration belongs to the independent agentd center. Agents connect to the
  MCP Gateway through mcpset; apps must not edit local agent configuration.

## Structured output uses native tool calls

When a structured result is needed, express it as a protocol-level tool call instead of asking
for text JSON and manually decoding/retrying it:

- The agent/app layer declares the tool name, description, and input schema through
  `Until.schema(schema, { name, description })` (which produces `asTool`). The core loop only
  exposes and intercepts a declared Schema tool; it must not hard-code product tool names or copy.
- Tool-call failures use the existing tool-error channel with readable diagnostics for model
  correction. Retry malformed arguments within the decode budget, then fail cleanly.
- Never fabricate user messages to scold the model, and never retry with local `JSON.parse` plus
  generic copy.
- Structured results always use protocol-level tool calls. Missing declarations or invalid
  protocol results fail explicitly.
- The decision question is: “Models support tool calls now; why are we reimplementing them?”

## File size and decomposition (lint enforced)

- Every implementation file under `packages/*/src`, `apps/*/src`, `scripts/`, `examples/`, and
  test directories must be at most 100 lines. `bun scripts/check-lines.ts` enforces this.
- Split by concept/layer and dependency direction. Each file owns one cohesive responsibility.
  Do not mechanically split a function by line number.
- If one concept does not fit in 100 lines, it is a layer and must be split again.

Lessons from previous decompositions:

- When moving a file deeper, re-check every `import.meta.dir` resource path.
- Confirm whether an extracted builder returns one Op, an object, or an array before assembling it.
- Avoid helper/member name collisions; alias imports or use `this.member` explicitly.
- Check every relative import after moving files across directory levels. Type-only imports are
  erased at runtime, so use `tsc` for type validation as well as runtime probes.

## Unit tests must protect behavior, not strings

- Assertions must have behavioral meaning: run an action and verify its observable contract,
  values, boundaries, failure path, merge precedence, or register/unregister symmetry.
- Do not assert that a whole HTML/template string contains copy. That locks presentation text
  while missing real bugs.
- Page tests should cover stable HTTP status, content type, endpoint shape, and values. Copy and
  scaffolding belong to browser or manual acceptance, not unit tests.
- Do not use heuristic/count assertions such as “length > 1000” or “it runs, therefore green”.
- Before adding an assertion, ask: does it catch a behavior bug or only a changed string? Delete it
  if it only catches the latter.
