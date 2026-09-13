# formal/

The Lean model of the mechanisms the product rests on. Each module proves the
invariants one source file owes, and names that file at the top.

Lean core only — no mathlib. `bun run check:proofs` builds the model; the
guards list it alongside the code checks, so a proof that stops holding fails
like a broken test.

| module | models | proves |
|---|---|---|
| `Formal/Authz.lean` | `effect-authz/src/decide.ts` | deny wins wherever it sits, so entry order cannot change a verdict; visibility is the decision, not a second opinion |
| `Formal/Chain.lean` | `effect-ui/src/screen.ts` | the navigation chain names only screens that exist and terminates |
| `Formal/Config.lean` | `effect-config/src/merge.ts` | the provenance names the layer the value came from; a new default cannot move an operator's override |
| `Formal/Derive.lean` | `effect-ui/src/screen-derive.ts` | a derived screen id collides with no other, declared or derived |
| `Formal/Lifecycle.lean` | `effect-interface/src/registry.ts` | register and dispose are symmetric, and a stale disposer cannot revoke its replacement |
| `Formal/Readout.lean` | `effect-ui/src/readout.ts`, `source-status.ts` | a readout shows exactly when its path carries a value; a failed list never reads as an empty one |
| `Formal/Screen.lean` | `effect-ui/src/screen.ts` | entered screens form a chain back to the root, without repeats |

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
