import { describe, expect, test } from "bun:test"
import { Effect } from "effect"
import {
  ConnectionRuntime,
  connectionAdapter,
  type ConnectionSpec
} from "@effect-agent/core"
import {
  CoreCapabilities,
  coreConnectionSpec,
  coreEndpoint,
  directCoreAdapter,
  endpointTransport,
  observeCorePolicy,
  remoteCoreAdapter,
  trustedCorePolicy
} from "@effect-agent/builtin"

const echoSpec: ConnectionSpec = {
  id: "echo",
  contract: {
    capabilities: [{ name: "echo", input: {}, output: {} }]
  },
  adapters: [{ kind: "echo" }]
}

const makeEchoCore = () => ConnectionRuntime.make({
  specs: [echoSpec],
  adapters: [connectionAdapter({
    kind: "echo",
    capabilities: new Set(["echo"]),
    connect: (spec) => Effect.succeed({
      connectionId: spec.id,
      adapter: "echo",
      capabilities: new Set(["echo"]),
      invoke: (_capability, input) => Effect.succeed(input),
      close: Effect.void
    })
  })]
})

describe("builtin Core protocol", () => {
  test("a Core can expose itself or another Core as a connection", async () => {
    const peer = await Effect.runPromise(makeEchoCore())
    let host!: ConnectionRuntime
    const direct = directCoreAdapter({
      resolve: (target) => Effect.succeed(target === "self" ? host : peer),
      policy: trustedCorePolicy
    })
    host = await Effect.runPromise(ConnectionRuntime.make({
      specs: [
        coreConnectionSpec({ id: "self", adapters: [{ kind: direct.kind, config: { target: "self" } }] }),
        coreConnectionSpec({ id: "peer", adapters: [{ kind: direct.kind, config: { target: "peer" } }] })
      ],
      adapters: [direct]
    }))

    const description = await Effect.runPromise(host.invoke("self", CoreCapabilities.describe, undefined)) as any
    expect(description.connections.map((connection: any) => connection.id).sort()).toEqual(["peer", "self"])
    expect(await Effect.runPromise(host.invoke("peer", CoreCapabilities.invoke, {
      connection: "echo",
      capability: "echo",
      input: "from another core"
    }))).toBe("from another core")
  })

  test("the same protocol connects a remote UI transport", async () => {
    const remote = await Effect.runPromise(makeEchoCore())
    const adapter = remoteCoreAdapter({
      kind: "test.remote",
      connect: () => Effect.succeed(endpointTransport(coreEndpoint(remote, trustedCorePolicy)))
    })
    const local = await Effect.runPromise(ConnectionRuntime.make({
      specs: [coreConnectionSpec({ id: "remote-ui", adapters: [{ kind: adapter.kind }] })],
      adapters: [adapter]
    }))
    expect(await Effect.runPromise(local.invoke("remote-ui", CoreCapabilities.invoke, {
      connection: "echo",
      capability: "echo",
      input: { source: "ui" }
    }))).toEqual({ source: "ui" })

    const observer = coreEndpoint(remote, observeCorePolicy)
    expect((await Effect.runPromise(observer.request({ method: "core.describe" })) as any).connections).toHaveLength(1)
    const denied = await Effect.runPromiseExit(observer.request({
      method: "core.invoke",
      params: { connection: "echo", capability: "echo", input: "denied" }
    }))
    expect(denied._tag).toBe("Failure")
  })
})
