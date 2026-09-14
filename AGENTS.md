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
- Do not rewrite or delete old data automatically; reject invalid formats clearly and let the
  operator decide whether to rebuild.
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

## Source files carry no comments

- Write no comments in source or configuration: `.ts`, `.tsx`, `.js`, `.cjs`, `.lean`, `.css`,
  `.sh`, `.yaml`, `.yml`, `.toml`, `.gitignore`. `bun scripts/check-comments.ts` enforces this;
  `bun scripts/check-comments.ts --fix` removes them.
- Good code explains itself. A comment is a symptom with a cause: rename the binding, split the
  function, or move the code so the fact sits where it is read. Fix the cause, then delete the
  comment.
- Do not delete a fact the code depends on. If a comment says something the code cannot be read
  to say, first make the code say it, then remove the comment. A rule that only exists in prose
  is a rule nothing enforces.
- Documents are not comments. `AGENTS.md`, `docs/**`, and `README.md` keep their prose, and a
  fact too large for a name belongs in `docs/`, not beside the code.
- Generated output is exempt: `apps/effect-server/public/` is built from source, and the comments
  inside it belong to its dependencies. Rebuild it (`bun run --cwd apps/effect-server
  build:client`) rather than editing it. The guard skips `public/`, `board-mcp/`, `.agents/`, and
  `.claude/`.

## File size and decomposition (lint enforced)

- Every implementation file under `packages/*/src`, `apps/*/src`, `scripts/`, and `examples/`
  must be at most 100 lines. `bun scripts/check-lines.ts` enforces this.
- Split by concept/layer and dependency direction. Each file owns one cohesive responsibility.
  Do not mechanically split a function by line number.
- If one concept does not fit in 100 lines, it is a layer and must be split again.

Lessons from previous decompositions:

- When moving a file deeper, re-check every `import.meta.dir` resource path.
- Confirm whether an extracted builder returns one Op, an object, or an array before assembling it.
- Avoid helper/member name collisions; alias imports or use `this.member` explicitly.
- Check every relative import after moving files across directory levels. Type-only imports are
  erased at runtime, so use `tsc` for type validation as well as runtime probes.

## No unit tests

- Do not write unit tests. This repository has none, and none are to be added.
- Do not create `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `*.spec.tsx` files, and do not add a
  test-runner step to a `package.json` script or to CI.
- Verify a change by running the real thing and reporting what was observed: the guards
  (`bun scripts/check-lines.ts`, `check-boundary.ts`, `check-ui.ts`, `check-proofs.ts`), a
  typecheck (`bunx tsc --noEmit`), a probe against a running server, or a one-off runtime command.
- Do not propose adding a test, and do not describe a change as “needs a test”. If a behavior
  cannot be demonstrated by running it, say that plainly instead of reaching for a test.
