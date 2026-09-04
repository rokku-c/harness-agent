/**
 * agent/make.ts - ASSEMBLING one mantis session agent.
 *
 * Concept: wire options into a driver: the default mantis supply registry
 * (from the capability manifest), a fresh ToolSupply pre-enabled with the
 * session's surface, the notes/ops bindings, the EffectAgent driver with
 * context economy (planTools = visible surface) and reflection, hooks, and
 * the program defined over the FinalReply contract via the final_answer
 * tool (declared here in the agent layer, not the core).
 */
import { Effect } from "effect"
import {
  Agent, AgentContext, eaUri, Harness, Until, type Binding
} from "@effect-agent/core"
import { EffectAgent } from "@effect-agent/builtin"
import { FinalReply } from "../final.ts"
import { noApproval } from "../approval.ts"
import { supplyFromCapabilities, ToolSupply } from "../supply.ts"
import { MANTIS_CAPABILITIES } from "../capabilities.ts"
import { makeMantisOps, NotesStore } from "../tools.ts"
import { MANTIS_INSTRUCTIONS, REFLECT_PROMPT } from "./persona.ts"
import type { Mantis, MantisOptions } from "./options.ts"

/** the mantis tool tiers, derived from the capability manifest (single source of truth) */
export const mantisSupply = supplyFromCapabilities(MANTIS_CAPABILITIES)

export const makeMantis = (options: MantisOptions): Mantis => {
  const supply = new ToolSupply(mantisSupply)
  for (const name of options.initialEnabled ?? []) supply.enable(name)
  const notes = options.notes ?? new NotesStore()
  const approvals = options.approvals ?? noApproval
  const ops = makeMantisOps({ supply, notes, approvals, ui: options.ui, onEnabled: options.onEnabled })
  const toolsBinding: Binding = { uri: eaUri("svc", "mantis", "tools"), ops }

  const driver = EffectAgent.make({
    model: options.model,
    instructions: options.instructions ?? MANTIS_INSTRUCTIONS,
    maxSteps: options.maxSteps,
    // context economy: the model sees only the planned (grown) surface
    planTools: () => supply.visible() as ReadonlyArray<string>,
    // reflection: one short prompt after a failed tool step
    reflect: (state) => (state.lastToolError === undefined ? undefined : REFLECT_PROMPT),
    maxReflections: options.maxReflections ?? 2
  })

  const hooked = options.hooks !== undefined && options.hooks.length > 0
    ? Harness.withHooks(driver, ...options.hooks)
    : driver
  let agent = Agent
    .define<string>("mantis.session", (message) => AgentContext.text(message))
    .returns(Until.schema(FinalReply, {
      name: "final_answer",
      description: "Mantis session final result: call it exactly once when done; its input schema is the FinalReply contract"
    }))
    .writes(toolsBinding)
  for (const binding of options.bindings ?? []) agent = agent.uses(binding)
  const program = agent.implementedBy(hooked)

  return { agent: program, supply, notes, approvals }
}

/** run a mantis session to its FinalReply (convenience for demos/tests) */
export const runMantis = (mantis: Mantis, message: string) => Effect.runPromise(mantis.agent.run(message))
