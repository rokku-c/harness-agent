import { expect, test } from "bun:test"
import { startStandaloneApp } from "@effect-agent/effect-standalone"
import { startProbe } from "@effect-agent/agentd-probe"
import { effectApp } from "../src/effect-app.ts"
import { config, DECLARED, desired, machine, presence, receipts, TOKEN, until } from "./probe-plane.ts"

test("a real probe keeps a real node online past a whole lease, and receipts what it applied", async () => {
  const hosted = await startStandaloneApp({ app: effectApp, appRoutes: true, port: 0, config: config(1200) })
  const probe = startProbe({ url: hosted.url, token: TOKEN, machine: DECLARED, intervalMs: 100 })
  try {
    const first = await until(async () => { const seen = await presence(hosted.url); return seen.online ? seen : undefined })
    // With a 100 ms beat and a 1200 ms lease, being online more than a whole
    // lease later is only possible if the heartbeats renewed it.
    await Bun.sleep(1400)
    const later = await presence(hosted.url)
    expect(later.online).toBe(true)
    expect(later.lastSeen!).toBeGreaterThan(first.lastSeen!)
    expect(probe.status().beats).toBeGreaterThan(10)

    const applied = await until(async () => { const held = await receipts(hosted.url); return held.length > 0 ? held : undefined })
    // The receipt names the revision the node was actually told to run, rather
    // than a number the test decided in advance: the control plane's counter is
    // its own, and a receipt that disagreed with the deployment would be the bug.
    expect(applied[0]!.revision).toBe((await desired(hosted.url) as { revision: number }).revision)
    expect(applied[0]!.state.ok).toBe(true)
    expect(applied[0]!.state.deployment?.apps.map((app) => `${app.ns}::${app.bundleId}@${app.version}`))
      .toEqual(["ops::board@1.0.0"])
    // Ten-plus beats later the receipt is still the one from the first: a
    // deployment that has not moved is not re-applied, or a receipt would arrive
    // every 100 ms and stop meaning anything.
    expect((await receipts(hosted.url))[0]!.at).toBe(applied[0]!.at)
  } finally {
    await probe.stop()
    await hosted.stop()
  }
})

test("a stalled probe ages out without disturbing the record, and withdraws cleanly", async () => {
  const hosted = await startStandaloneApp({ app: effectApp, appRoutes: true, port: 0, config: config(300) })
  // A beat a minute apart against a 300 ms lease: this node really is stalled
  // after its first beat, rather than being made to look stalled by a test hook.
  const probe = startProbe({ url: hosted.url, token: TOKEN, machine: DECLARED, intervalMs: 60_000 })
  try {
    await until(async () => { const seen = await presence(hosted.url); return seen.online ? seen : undefined })
    const applied = await until(async () => { const held = await receipts(hosted.url); return held.length > 0 ? held : undefined })
    const record = await machine(hosted.url), wanted = await desired(hosted.url)

    const stalled = await until(async () => { const seen = await presence(hosted.url); return seen.online ? undefined : seen })
    // Aged out, not withdrawn: the lease lapsed and nobody said goodbye, and that
    // distinction is the whole reason `withdrawn` is a field of its own.
    expect(stalled.withdrawn).toBe(false)
    expect(await machine(hosted.url)).toEqual(record)
    expect(await desired(hosted.url)).toEqual(wanted)
    expect(await receipts(hosted.url)).toEqual(applied)

    await probe.stop()
    const gone = await presence(hosted.url)
    expect(gone.withdrawn).toBe(true)
    expect(gone.online).toBe(false)
    // A clean shutdown is not a decommission: the machine and its deployment are
    // still there to come back to.
    expect(await machine(hosted.url)).toEqual(record)
    expect(await desired(hosted.url)).toEqual(wanted)
  } finally {
    await probe.stop().catch(() => undefined)
    await hosted.stop()
  }
})
