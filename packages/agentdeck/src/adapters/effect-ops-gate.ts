/**
 * agentdeck/adapters/effect-ops-gate - the one write op the effect-ops adapter
 * declares, gated by the shared ConsentLedger.
 *
 * The first send raises an ask and aborts with awaiting[]; once the operator (or
 * an auto policy) resolves it, re-sending the same turn actually EXECUTES the
 * op. Denial aborts with a readable cause.
 *
 * A pending op aborts by dying with a prefixed message, and `send` reads the
 * prefix back off the dead turn. Both ends are in this adapter, so the prefixes
 * are constants: renamed on one side alone, the approval card never renders.
 */
import { Effect, Schema } from "effect"
import { Op, notationText } from "@effect-agent/core"
import type { ConsentLedger } from "../consent-types.ts"

export const AWAIT = "DECK_AWAIT:"
export const DENIED = "DECK_DENIED:"

/** find the newest ledger entry for a session+tool, if any */
const entryFor = (ledger: ConsentLedger, sessionId: string, tool: string) =>
  ledger.entries(sessionId).find((e) => e.tool === tool)

export const writeOp = (ledger: ConsentLedger, sessionId: string) =>
  Op.write({
    name: "write_file",
    description: notationText("Write a file at the given path."),
    input: Schema.Struct({ path: Schema.String }),
    output: Schema.Struct({ path: Schema.String, ok: Schema.Boolean }),
    execute: (input: { path: string }) =>
      Effect.gen(function* () {
        const entry = entryFor(ledger, sessionId, "write_file")
        const callId = entry?.callId ?? ledger.ask(sessionId, "write_file", input)
        const current = entryFor(ledger, sessionId, "write_file")
        if (current === undefined || current.decision === "pending")
          return yield* Effect.die(new Error(AWAIT + callId))
        if (current.decision === "deny") return yield* Effect.die(new Error(DENIED + current.callId))
        // operator approved: the write really happens
        return yield* Effect.succeed({ path: input.path, ok: true })
      })
  })
