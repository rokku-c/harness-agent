# formal/

The Lean model of the mechanisms the product rests on. Each module proves the
invariants one source file owes, and names that file at the top.

Lean core only — no mathlib. `bun run check:proofs` builds the model; the
guards list it alongside the code checks, so a proof that stops holding fails
like a broken test.

`Formal.lean` imports every module, and the check fails if one is missing:
`lake build` compiles that root's import closure and nothing else, so a module
absent from the list would be counted here while never being compiled.

| module | models | proves |
|---|---|---|
| `Formal/AppLayer.lean` | `apps/effect-server/src/boot/app-layer.ts` | suspending an app keeps its place, so teardown still runs in reverse load order; removing and appending it instead moves it to the front of teardown |
| `Formal/Authz.lean` | `effect-authz/src/decide.ts` | deny wins wherever it sits, so entry order cannot change a verdict; visibility is the decision, not a second opinion |
| `Formal/Chain.lean` | `effect-ui/src/screen.ts` | the navigation chain names only screens that exist and terminates |
| `Formal/Compat.lean` | `effect-compat/src/assess.ts` | a level that did not change is never adjudicated; the violations are exactly the changed levels |
| `Formal/Config.lean` | `effect-config/src/merge.ts` | the provenance names the layer the value came from; a new default cannot move an operator's override |
| `Formal/Consent.lean` | `agentdeck/src/consent.ts` | the first answer to an ask is the answer; a write runs exactly when the operator approved it |
| `Formal/Derive.lean` | `effect-ui/src/screen-derive.ts` | a derived screen id collides with no other, declared or derived |
| `Formal/Egress.lean` | `effect-network/src/policy.ts` | the exit a write leaves by is the one the policy chose and it was reachable; an unmet preference fails instead of borrowing another policy's exit |
| `Formal/Generation.lean` | `effect-apps/src/registration/install.ts` | every refusal path leaves the displaced generation serving; forgetting the restore leaves the app down |
| `Formal/Lifecycle.lean` | `effect-interface/src/registry.ts` | register and dispose are symmetric, and a stale disposer cannot revoke its replacement |
| `Formal/Readout.lean` | `effect-ui/src/readout.ts`, `source-status.ts` | a readout shows exactly when its path carries a value; a failed list never reads as an empty one |
| `Formal/Redact.lean` | `mcp-gateway/src/redaction.ts`, `ai-gateway/src/redaction.ts` | the scrub leaves no field unvisited at any depth, for any vocabulary; a credential-named header is not carried |
| `Formal/Screen.lean` | `effect-ui/src/screen.ts` | entered screens form a chain back to the root, without repeats |
| `Formal/Swap.lean` | `effect-bundle/src/supervisor-swap.ts` | at every moment of a kernel swap the dispatcher points at a kernel that is loaded; stopping the old one first does not |
| `Formal/ToolKey.lean` | `effect-interface/src/registry.ts`, `effect-mcp/src/node-server/tools.ts` | a dot-free id splits a flattened tool key into exactly the pair that made it; two tool names can sanitize to one served name, and the surface refuses that instead of dropping a tool |

## What this is not

The model is of the *rule*, not of the code that applies it: each module states
the invariant a file owes and proves it about a small idealisation of that file,
with the idealisation noted where it matters. A proof here means the rule holds,
and it means a change to the rule that breaks it fails `check:proofs` — not that
the TypeScript is verified.

Most of the repository is not modelled. The rule of thumb for what to add: a
mechanism whose correctness is a claim in a comment, where the wrong answer is
silent — a provenance that lies, a chain that loops, a disposer that revokes the
wrong registration. A mechanism that fails loudly when it is wrong needs a test,
not a proof.
