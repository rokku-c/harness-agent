/**
 * The seven-party development loop, as an effect-agent program (R-D).
 *
 * This repo's own development process - seven roles negotiating design and
 * verdicts on a shared board - expressed with the framework's own primitives:
 * every role is an Agent whose charter lives in notation (no prose in the
 * definitions), parallel reviews are Effect.all, every verdict is a Schema
 * output. A scripted driver per role makes the run deterministic - swap
 * implementedBy for a real driver and the same program drives actual model
 * calls.
 *
 * The loop shape (one iteration, matching the board protocol):
 *   brief (main agent) -> parallel review (think + architect)
 *   -> guard verdict -> short-circuit on "revise" (escalate to the owner)
 */
import { Effect, Schema } from "effect"
import { Agent, AgentContext, memoryNotationStore, Until, withNotation, type Driver, type Until as UntilType } from "../src/index.js"

// ---------------------------------------------------------------------------
// The role charters: the board's role definitions as notation entries. The
// loop program references targets; the prose is data (versioned, injectable).
// ---------------------------------------------------------------------------
const notation = memoryNotationStore([
  {
    target: "dev/loop/main-agent",
    instructions: [
      "You arbitrate and verify. Turn the task into a brief with concrete deliverables. Task: {task}"
    ]
  },
  {
    target: "dev/loop/think",
    instructions: [
      "You predict design corners and critique. Review this brief: name the sharp corners and one suggestion. Brief: {brief}"
    ]
  },
  {
    target: "dev/loop/architect",
    instructions: [
      "You keep every mechanism part of one coherent architecture. Answer only: is one mechanism enough? Give the minimal form and a cut list. Brief: {brief}"
    ]
  },
  {
    target: "dev/loop/guard",
    instructions: [
      "You guard the north star: honest evidence levels, no fake abstractions, minimal honest fixes. Verdict this iteration record: {record}"
    ]
  }
])

// ---------------------------------------------------------------------------
// Verdict schemas: structured outputs, so the loop composes on data.
// ---------------------------------------------------------------------------
const Brief = Schema.Struct({ summary: Schema.String, deliverables: Schema.Array(Schema.String) })
const DesignNote = Schema.Struct({ corners: Schema.Array(Schema.String), suggestion: Schema.String })
const ShapeVerdict = Schema.Struct({ minimalForm: Schema.String, cutList: Schema.Array(Schema.String) })
const GuardVerdict = Schema.Struct({ verdict: Schema.Literal("proceed", "revise"), reasons: Schema.Array(Schema.String) })

// ---------------------------------------------------------------------------
// A scripted driver: returns one canned value - deterministic, no API key.
// A real driver (Providers.agent(), ClaudeCode.make(), ...) drops in unchanged.
// ---------------------------------------------------------------------------
const scripted = (answer: unknown): Driver => {
  const capabilities = {
    provider: { _tag: "Fixed", api: "scripted" }, granularity: "turn", thinking: false,
    cancel: false, pause: false, resume: false, fork: "none",
    tools: "none", toolCalls: "none", structuredOutput: "native", sandbox: "none"
  } as const
  return {
    id: "scripted",
    capabilities,
    run: <A, R>(request: any): any =>
      request.until._tag === "Schema" ? Effect.succeed(answer) : Effect.succeed(JSON.stringify(answer) as A)
  }
}

// One definition shape for every role: id + charter target + output schema.
const role = <I, O>(id: string, target: string, until: UntilType<O>, driver: Driver) =>
  Agent
    .define<I>(id, withNotation(notation, (input: I, nl) => AgentContext.text(nl(target, input as Record<string, unknown>))))
    .returns(until)
    .implementedBy(driver)

// ---------------------------------------------------------------------------
// The loop, composed:
//   brief -> parallel (think + architect) -> guard -> escalate on "revise"
// ---------------------------------------------------------------------------
const program = Effect.gen(function*() {
  const brief = yield* role<{ task: string }, typeof Brief.Type>("main-agent", "dev/loop/main-agent", Until.schema(Brief), scripted({ summary: "Land the notation restriction", deliverables: ["src/notation.ts", "8 rewritten examples"] })).run({ task: "restrict definition-time natural language" })

  // parallel review - both roles see the same brief
  const [note, shape] = yield* Effect.all([
    role<{ brief: string }, typeof DesignNote.Type>("think", "dev/loop/think", Until.schema(DesignNote), scripted({ corners: ["interpolation escaping", "store lifecycle"], suggestion: "fail loud on missing vars" })).run({ brief: brief.summary }),
    role<{ brief: string }, typeof ShapeVerdict.Type>("architect", "dev/loop/architect", Until.schema(ShapeVerdict), scripted({ minimalForm: "one resolver, one store shape", cutList: ["no template engine", "no store inheritance"] })).run({ brief: brief.summary })
  ])

  const record = JSON.stringify({ brief: brief.summary, note, shape })
  const verdict = yield* role<{ record: string }, typeof GuardVerdict.Type>("dev/loop/guard", "dev/loop/guard", Until.schema(GuardVerdict), scripted({ verdict: "proceed", reasons: ["evidence gate met", "no fake abstraction"] })).run({ record })

  if (verdict.verdict === "revise")
    // escalate to the owner - the loop's short-circuit
    return yield* Effect.fail({ _tag: "EscalateToOwner" as const, reasons: verdict.reasons })

  return { brief: brief.summary, deliverables: brief.deliverables, note, shape, verdict }
})

const outcome = await Effect.runPromise(program)
console.log(JSON.stringify(outcome, null, 2))
