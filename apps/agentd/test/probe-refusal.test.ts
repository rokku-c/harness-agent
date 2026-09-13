import { expect, test } from "bun:test"
import { startStandaloneApp } from "@effect-agent/effect-standalone"
import { startProbe, type CycleOutcome, type ProbeFault } from "@effect-agent/agentd-probe"
import { effectApp } from "../src/effect-app.ts"
import { config, DECLARED, presence, TOKEN, until } from "./probe-plane.ts"

const events: Array<CycleOutcome | ProbeFault> = []
const listening = () => { events.length = 0; return (event: CycleOutcome | ProbeFault): void => { events.push(event) } }

test("a control plane that is not there is never mistaken for one that agreed", async () => {
  const listener = Bun.serve({ port: 0, fetch: () => new Response("nothing here") })
  const port = listener.port
  listener.stop(true)
  const probe = startProbe({
    url: `http://127.0.0.1:${port}`, token: TOKEN, machine: DECLARED, intervalMs: 30, onEvent: listening(),
  })
  try {
    await until(async () => probe.status().fault === undefined ? undefined : true)
    await Bun.sleep(120) // several intervals, so a spin would show as more events
    expect(probe.status().fault?.kind).toBe("unreachable")
    expect(probe.status().beats).toBe(0)
    expect(probe.status().leased).toBe(false)
    expect(probe.status().last).toBeUndefined()
    expect(events.map((event) => event.kind)).toEqual(Array(events.length).fill("unreachable"))
    // The goodbye is not a clean exit either: nobody received it.
    await expect(probe.stop()).rejects.toThrow(/withdraw/)
  } finally {
    await probe.stop().catch(() => undefined)
  }
})

test("a wrong credential is refused once, and the node never looks alive", async () => {
  const hosted = await startStandaloneApp({ app: effectApp, appRoutes: true, port: 0, config: config(3000) })
  const probe = startProbe({
    url: hosted.url, token: "not-the-token", machine: DECLARED, intervalMs: 20, onEvent: listening(),
  })
  try {
    await until(async () => probe.status().halted === undefined ? undefined : true)
    // The identical call would be refused identically, so there is no second one.
    await Bun.sleep(120)
    expect(probe.status().halted?.kind).toBe("refused")
    expect(events).toHaveLength(1)
    expect(probe.status().beats).toBe(0)
    expect(probe.status().leased).toBe(false)
    // And the control plane agrees, saying which of the two it is: declared, not up.
    const state = await presence(hosted.url)
    expect(state.online).toBe(false)
    expect(state.withdrawn).toBe(false)
  } finally {
    await hosted.stop()
  }
})
