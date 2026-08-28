# Notation-injected prompts (agent definitions)

All natural-language text that reaches a model - prompts, role charters,
instruction scaffolding, tool descriptions - lives in a **notation store** and
is injected at run time. Agent definitions reference targets; they never embed
prose. The restriction is type-level: `AgentContext.text` accepts only
`NotationText`, which the resolver produces - a raw string literal in a
definition fails to compile.

```ts
import { memoryNotationStore, withNotation } from "../src/index.js"

// the prose lives here (versioned, injectable through the notation adapter)
const notation = memoryNotationStore([
  { target: "planner/prompt", instructions: ["Draft an execution plan for this task: {task}"] }
])

const Planner = Agent
  .define<string>("Planner", withNotation(notation, (task, nl) =>
    AgentContext.text(nl("planner/prompt", { task }))))
  .returns(Until.schema(Plan))
  .implementedBy(driver)
```

- `withNotation(store, build)` hands the build function a resolver
  `(target, vars) => NotationText`; `Agent.define`'s signature is unchanged -
  the store rides the definition's closure.
- Resolution joins the entry's `instructions` with newlines and interpolates
  `{var}` placeholders from vars. A missing target or a referenced-but-unpassed
  variable throws - a definition bug is a defect, not a runtime error.
- `AgentContext.raw(s)` is the mechanical escape for non-prose fixtures
  (tests, protocol scaffolding, mechanical passthroughs like the IR compiler).
  It is named so the deviation is visible in review; production prompt prose
  never uses it.

## Boundaries (honest)

- Runtime data (the caller's input) flows through `{var}` interpolation - it
  is data, not definition prose.
- Driver-level protocol scaffolding (e.g. the structured-output finish
  instruction a driver must send for its SDK to work) is driver mechanics, not
  agent definition - it stays in the driver for now; moving it behind notation
  is a candidate when a second driver needs the same scaffold.
- The connection-level notation adapter (`@effect-agent/builtin`) annotates
  capability descriptions over a ConnectionSpec with the same store shape -
  one concept, two injection points.
