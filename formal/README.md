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
| `Formal/InFlight.lean` | `effect-host/src/dispatch-counts.ts`, `dispatch-point.ts` | a release lands on the target its acquire named, so a target answering a request cannot read as drained; releasing whatever is current lets it read as drained and leaves the captured one never draining; the waiter is woken by the last release and stays quiet while anything is inside |
| `Formal/Lifecycle.lean` | `effect-interface/src/registry.ts` | register and dispose are symmetric, and a stale disposer cannot revoke its replacement |
| `Formal/Match.lean` | `effect-authz/src/match.ts` | a `*` pins the depth, so a grant containing one reaches no further than it was written whatever it targets; a terminal `**` reaches strictly below its head and nothing shallower; a literal-only grant reaches below itself, and a named scheme reaches only its own. Dropping the depth pin lets `ops::*` reach every depth, and reading `**` as inclusive lets a container grant cover itself |
| `Formal/NodeGuard.lean` | `agentd/src/control-guard.ts` | `tokenRequired` and `authorized` are two readings of one fact, so a caller that skips the check and one that runs it cannot be told different things; an armed guard refuses a request that presents no token; writing the arm condition twice instead lets the two readings disagree |
| `Formal/Presence.lean` | `agentd/src/presence-table.ts` | a lease's age is the larger of the two clock readings, so no wall-clock step backwards revives one the monotonic clock has run out on; reading the wall clock alone lets a step back revive a node silent for the length of the step. A step forward only expires leases early, so the maximum is not a trade. A lapsed presence starts over, so "up since" is not the last heartbeat and does not count the downtime as uptime. A nudge renews a presence that exists and has not been withdrawn — read as a plain renewal it puts a withdrawn node back online with no announce |
| `Formal/Queue.lean` | `effect-host/src/queue.ts` | an operation finishing only drops the queue when it is still the tail, so the one queued behind it stays what the next submission waits for; without that check the next submission waits for nothing and runs beside it |
| `Formal/Readout.lean` | `effect-ui/src/readout.ts`, `source-status.ts` | a readout shows exactly when its path carries a value; a failed list never reads as an empty one |
| `Formal/Redact.lean` | `mcp-gateway/src/redaction.ts`, `ai-gateway/src/redaction.ts` | the scrub leaves no field unvisited at any depth, for any vocabulary; a credential-named header is not carried |
| `Formal/Reload.lean` | `effect-server/src/manifest-loader/generation.ts` | a generation number is handed out once, so a spent path is never served again; a commit keeps the serving copy and one rollback target, and discarding the displaced copy loses the rollback |
| `Formal/Resolve.lean` | `mcp-gateway/src/resolve.ts` | the three sources of a principal are read in strict order and a token that does not verify ends the search, so it cannot be downgraded to a claim bag or a forged header — sent back into the weaker sources, a bad token admits its bearer as whoever it named. With a good token present nothing else is read, so reading the claims first lets a valid token be rewritten. Bare headers are read only from a trusted transport; read always, anyone who can reach the port is an operator. Whoever is admitted, the registry has them |
| `Formal/Screen.lean` | `effect-ui/src/screen.ts` | entered screens form a chain back to the root, without repeats |
| `Formal/Slot.lean` | `effect-apps/src/registration/generations.ts` | the rollback target is the generation the live one displaced, not the oldest the slot ever had; a commit that replaces the history instead of joining it leaves nothing to roll back to |
| `Formal/Surface.lean` | `effect-apps/src/registration/surface.ts` | the pairing loop and the removal sweep partition the old surface, so a tool that disappears is reported once and an added tool not at all; without the sweep the dropped tool is not looked at and the upgrade passes. Both sides are read back from the registry, so a tool the new registry refused cannot read as present |
| `Formal/Swap.lean` | `effect-bundle/src/supervisor-swap.ts` | at every moment of a kernel swap the dispatcher points at a kernel that is loaded; stopping the old one first does not |
| `Formal/ToolKey.lean` | `effect-interface/src/tool-key.ts`, `effect-mcp/src/node-server/tools.ts` | a dot-free id splits a flattened tool key into exactly the pair that made it; two tool names can sanitize to one served name, and the surface refuses that instead of dropping a tool |
| `Formal/TreeOrder.lean` | `board/src/tasks/tree-order.ts` | no task is hidden: two tasks pointing at each other are below no root at any depth, so the walk down from the roots never hands them over, and the file's second walk hands over every task — everything handed over is listed. Nothing is listed twice, because an id already listed is not appended again; read without that guard the walk appends everything it is handed, and since the second walk hands over every task each one is listed twice |
| `Formal/Watch.lean` | `effect-server/src/boot/watch.ts` | an event is judged by the file's own time against the last reaction, so the reports a reaction itself causes — a path it only moved — are not edits and do not start the next reload; judging by the event instead makes every copy another reload. A burst for one app leaves one timer armed, carrying the last event, and touches no other app's timer |

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
