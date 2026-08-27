import { Effect } from "effect"
import {
  ConnectionRuntime,
  connectionAdapter,
  type ConnectionSpec
} from "@effect-agent/core"
import {
  coreEndpoint,
  endpointTransport,
  trustedCorePolicy
} from "@effect-agent/builtin"
import { ReprRuntime } from "@effect-agent/repr"

const capabilities = {
  run: "agent.run",
  list: "files.list",
  read: "files.read",
  append: "memory.append",
  query: "memory.query"
} as const

const specs: ReadonlyArray<ConnectionSpec> = [
  {
    id: "reasoning",
    contract: {
      protocol: "agent/v1",
      capabilities: [{ name: capabilities.run, input: {}, output: {}, mode: "control" }]
    },
    adapters: [{ kind: "demo.memory" }]
  },
  {
    id: "workspace",
    contract: {
      protocol: "filesystem/v1",
      capabilities: [
        { name: capabilities.list, input: { type: "object" }, output: { type: "array" }, mode: "read" },
        { name: capabilities.read, input: { type: "object" }, output: { type: "string" }, mode: "read" }
      ]
    },
    adapters: [{ kind: "demo.memory" }]
  },
  {
    id: "memory",
    contract: {
      protocol: "memory/v1",
      capabilities: [
        { name: capabilities.append, input: {}, output: {}, mode: "write" },
        { name: capabilities.query, input: {}, output: { type: "array" }, mode: "read" }
      ]
    },
    adapters: [{ kind: "demo.memory" }]
  }
]

export const makeDemoRepr = () => Effect.gen(function* () {
  const notes: unknown[] = []
  const adapter = connectionAdapter({
    kind: "demo.memory",
    capabilities: new Set(Object.values(capabilities)),
    connect: (spec) => Effect.succeed({
      connectionId: spec.id,
      adapter: "demo.memory",
      capabilities: new Set(spec.contract.capabilities.map((capability) => capability.name)),
      invoke: (capability, input) => {
        switch (capability) {
          case capabilities.run: return Effect.succeed({ status: "completed", input, summary: "Demo agent completed one run." })
          case capabilities.list: return Effect.succeed(["README.md", "packages/", "examples/"])
          case capabilities.read: return Effect.succeed("This demo uses an in-memory filesystem adapter.")
          case capabilities.append: return Effect.sync(() => { notes.push(input); return { index: notes.length - 1 } })
          case capabilities.query: return Effect.sync(() => [...notes])
          default: return Effect.fail(new Error(`Unsupported demo capability: ${capability}`))
        }
      },
      close: Effect.void
    })
  })
  const core = yield* ConnectionRuntime.make({ specs, adapters: [adapter] })
  return yield* ReprRuntime.connect(
    endpointTransport(coreEndpoint(core, trustedCorePolicy)),
    { eventLimit: 160 }
  )
})
