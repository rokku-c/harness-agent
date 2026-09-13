import { beforeEach, describe, expect, test } from "bun:test"
import type { ListenerManagerOptions } from "@effect-agent/effect-network"
import { startStandaloneApp } from "../src/index.ts"
import { needyApp, record, soloApp } from "./fixtures.ts"

/** Captures the composed request face and counts binds, so "no socket" is observable. */
const fakeListener = () => {
  const state = { handler: undefined as ((request: Request) => Promise<Response>) | undefined, binds: 0, stops: 0 }
  const listen: NonNullable<ListenerManagerOptions["listen"]> = (config) => {
    state.binds += 1
    state.handler = config.fetch
    return {
      hostname: config.hostname,
      port: 4321,
      url: `http://${config.hostname}:4321`,
      stop: () => { state.stops += 1 },
    }
  }
  const request = (path: string, method = "GET"): Promise<Response> =>
    state.handler!(new Request(`http://127.0.0.1:4321${path}`, { method }))
  return { state, listen, request }
}

beforeEach(() => { record.stops.length = 0 })

describe("standalone app hosting", () => {
  test("a no-dependency app is hosted on the MCP face alone", async () => {
    const fake = fakeListener()
    const hosted = await startStandaloneApp({ app: soloApp(), port: 0, listen: fake.listen })

    expect(hosted.surface).toEqual(["mcp:/mcp"])
    expect(hosted.mcpUrl).toBe("http://127.0.0.1:4321/mcp")
    expect(hosted.requires).toEqual([])

    // The MCP endpoint is mounted (405 = wrong method, not wrong path) ...
    expect((await fake.request("/mcp")).status).toBe(405)
    // ... while the app's own live UI and the composition root's control plane
    // are absent, not merely unregistered: the app's face would answer 200.
    expect((await fake.request("/solo")).status).toBe(404)
    expect((await fake.request("/-/planes")).status).toBe(404)
    await hosted.stop()
  })

  test("appRoutes opens the app's own face and reports it in the surface", async () => {
    const fake = fakeListener()
    const hosted = await startStandaloneApp({ app: soloApp(), port: 0, appRoutes: true, listen: fake.listen })

    expect(hosted.surface).toEqual(["mcp:/mcp", "app:routes"])
    expect(await (await fake.request("/solo")).text()).toBe("solo face /solo")
    // Control stays shut even with the app's routes open: this host has no kernel planes.
    expect((await fake.request("/-/planes")).status).toBe(404)
    await hosted.stop()
  })

  test("an app that requires another app is refused by name, before any socket", async () => {
    const fake = fakeListener()
    const started = startStandaloneApp({ app: needyApp(), port: 0, listen: fake.listen })

    const error = await started.then(() => undefined, (cause: Error) => cause)
    expect(error?.message).toContain("needy")
    expect(error?.message).toContain("board")
    expect(fake.state.binds).toBe(0)
  })

  test("stop() disposes the app, closes the listener, and is idempotent", async () => {
    const fake = fakeListener()
    const hosted = await startStandaloneApp({ app: soloApp(), port: 0, listen: fake.listen })

    await hosted.stop()
    expect(record.stops).toEqual(["solo"])
    expect(fake.state.stops).toBe(1)

    await hosted.stop()
    expect(record.stops).toEqual(["solo"])
    expect(fake.state.stops).toBe(1)
  })
})
