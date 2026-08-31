/**
 * The definition-time code ban: architectures are PURE DATA.
 *
 * architect() refuses functions, class instances (console, Date, node
 * namespaces), and accessor properties - with the precise path of the
 * offender. Code enters the system only through connections at ACTIVATION
 * (a tool's execute), never in the blueprint.
 *
 * Run: bun run examples/03-purity.ts
 */
import { architect, named } from "../src/index.ts"

const attempt = (label: string, build: () => unknown): void => {
  try {
    build()
    console.log("accepted:", label)
  } catch (cause) {
    console.log("rejected:", label, "->", cause instanceof Error ? cause.message : String(cause))
  }
}

// a callback smuggled into the blueprint
attempt("function value", () =>
  architect({
    name: "bad",
    connections: {},
    prompt: "bad/prompt",
    // @ts-expect-error - functions are not data
    onData: () => console.log("leak")
  }))

// the node console namespace (non-plain object full of functions)
attempt("console namespace", () =>
  architect({
    name: "bad",
    connections: {},
    prompt: "bad/prompt",
    // @ts-expect-error - namespaces are not data
    io: console
  }))

// a class instance
attempt("Date instance", () =>
  architect({
    name: "bad",
    connections: {},
    prompt: "bad/prompt",
    // @ts-expect-error - class instances are not data
    since: new Date()
  }))

// a getter - reading it would RUN code
attempt("accessor property", () => {
  const sneaky = { name: "bad", connections: {}, prompt: "bad/prompt" } as Record<string, unknown>
  Object.defineProperty(sneaky, "lazy", { enumerable: true, get: () => console.log("side effect") })
  return architect(sneaky as unknown as Parameters<typeof architect>[0])
})

// a tool with an execute closure cannot ride a connection spec either -
// a Connection (name + tools) is not a declaration
attempt("a Connection as a slot", () =>
  architect({
    name: "bad",
    connections: {
      // @ts-expect-error - a Connection is not a ConnectionDecl
      sky: { name: "weather", tools: [{ name: "t", execute: () => console.log("leak") }] }
    },
    prompt: "bad/prompt"
  }))

// the way code is supposed to enter: through a connection at ACTIVATION
const ok = architect({
  name: "ops-lead",
  connections: { dashboards: named("grafana") },
  prompt: "ops-lead/prompt"
})
console.log("accepted: pure-data blueprint", JSON.stringify(ok.connections))
