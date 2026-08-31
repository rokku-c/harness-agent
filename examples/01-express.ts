/**
 * The loop as a sentence. The agent definition expresses WHAT it does -
 * context mapping, termination, capability access - and the driver decides
 * HOW the loop runs. Same definition, any driver.
 */
import { Effect, Schema } from "effect"
import {
  Agent, AgentContext, ConsoleHook, Harness, Op, Until, Uri,
  materialize, notationText, type Binding, type Driver, type RunRequest
} from "@effect-agent/core"

const Plan = Schema.Struct({
  goal: Schema.String,
  steps: Schema.Array(Schema.Struct({ title: Schema.String, doneWhen: Schema.String }))
})

// a scripted driver: the loop's HOW, replaced at will
const scriptedDriver = (answers: unknown[]): Driver => ({
  id: "scripted",
  capabilities: {
    provider: { _tag: "Configurable" }, granularity: "run", thinking: false, cancel: true,
    pause: true, resume: false, fork: "none", tools: "native", toolCalls: "intercept",
    structuredOutput: "text", sandbox: "none"
  },
  run: <A, R>(request: RunRequest<A, R>) =>
    Effect.gen(function* () {
      const prepared = yield* materialize(request)
      console.log("context the driver sees:", JSON.stringify(prepared.context.entries))
      return answers.shift() as A
    }) as any
})

// a read binding: its content materializes into the context before the run
const notes: Binding = {
  uri: Uri.make("mem", "notes", "ops"),
  read: Effect.succeed({ _tag: "Text" as const, text: "2026-08-12 postmortem: config rollback" } as const)
}

// a write binding with a typed op: callable only through writes()
const issueTracker: Binding = {
  uri: Uri.make("svc", "tracker", "main"),
  ops: [Op.write({
    name: "file_issue",
    description: notationText("File ONE issue per incident; link the postmortem."),
    input: Schema.Struct({ title: Schema.String }),
    output: Schema.Struct({ issue: Schema.Number }),
    execute: ({ title }) => Effect.succeed({ issue: 17, title })
  })]
}

// the sentence: define -> returns -> uses -> writes -> implementedBy
const Planner = Agent
  .define("planner", (task: string) => AgentContext.text("Plan this task: " + task))
  .returns(Until.schema(Plan))
  .uses(notes)
  .writes(issueTracker)
  .implementedBy(scriptedDriver([{ goal: "ship v2", steps: [{ title: "cut release", doneWhen: "CI green" }] }]))

const plan = await Effect.runPromise(
  Effect.flatMap(Planner.run("cut the v2 release"), (value) => Effect.succeed(value))
)

console.log("structured plan:", JSON.stringify(plan, null, 2))

// the same definition, now observed: hooks wrap any driver
const observed = Harness.withHooks(
  scriptedDriver([{ goal: "ship v3", steps: [{ title: "freeze scope", doneWhen: "sign-off" }] }]),
  ConsoleHook
)
const plan3 = await Effect.runPromise(observed.run({
  context: AgentContext.text("Plan this task: cut the v3 release"),
  until: Until.schema(Plan),
  access: [{ binding: notes, write: false }, { binding: issueTracker, write: true }]
}))
console.log("observed plan:", plan3.goal)

