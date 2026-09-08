import { expect, test } from "bun:test"
import { makeEgressRouter } from "../src/egress.ts"
import type { EgressPolicy } from "../src/types.ts"

test("four policies choose an available exit before issuing exactly one request", async () => {
  for (const policy of ["local-first", "main-first", "local-only", "main-only"] as EgressPolicy[]) {
    const seen: string[] = []
    const network = makeEgressRouter({ role: "peer", main: { url: "https://main.invalid", token: "token" },
      localSend: async () => { seen.push("local"); return new Response("ok") },
      relaySend: async () => { seen.push("main"); return new Response("ok") },
    })
    network.registerApp("app", policy)
    await network.fetch("app", "https://upstream.invalid")
    expect(seen).toEqual([policy.startsWith("local") ? "local" : "main"])
  }
})
test("priorities can choose an alternate when unavailable, never replay a failed send", async () => {
  let sent = 0
  const network = makeEgressRouter({ role: "peer", localSend: async () => { sent++; throw new Error("network failure") } })
  network.registerApp("app")
  await expect(network.fetch("app", "https://upstream.invalid", { method: "POST", body: "write" })).rejects.toThrow("network failure")
  expect(sent).toBe(1)
  network.registerApp("main-only", "main-only")
  await expect(network.fetch("main-only", "https://upstream.invalid")).rejects.toThrow("No available egress")
  expect(sent).toBe(1)
  const unavailable = makeEgressRouter({ role: "main", localAvailable: false })
  unavailable.registerApp("app", "local-only")
  await expect(unavailable.fetch("app", "https://upstream.invalid")).rejects.toThrow()
})
test("main-first on main is local, and disposed apps cannot send", async () => {
  let sent = 0
  const network = makeEgressRouter({ role: "main", localSend: async () => { sent++; return new Response("ok") } })
  const old = network.registerApp("app")
  const current = network.registerApp("app")
  old()
  await network.fetch("app", "https://test.invalid")
  expect(sent).toBe(1)
  current()
  await expect(network.fetch("app", "https://test.invalid")).rejects.toThrow("not registered")
})
