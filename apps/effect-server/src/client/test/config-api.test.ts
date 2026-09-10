import { expect, test } from "bun:test"
import { createConfigApi, type ConfigFailure } from "../config-api.ts"

const saved = { appId: "ai/gateway", ok: true, value: {}, sources: {}, pendingRestart: true, revision: 4 }
test("save sends an object override and explicit strategy; apply is a separate endpoint", async () => {
  const requests: { url: string; init?: RequestInit }[] = []
  const api = createConfigApi(async (url, init) => { requests.push({ url, init }); return Response.json(saved) })
  const override = { providers: [{ apiType: "openai.chat", baseURL: "https://example.test" }], enabled: false, port: 0 }
  expect(await api.save("ai/gateway", override, "restart")).toEqual(saved)
  expect(requests[0].url).toBe("/console/api/config/ai%2Fgateway")
  expect(JSON.parse(requests[0].init!.body as string)).toEqual({ override, strategy: "restart", unset: [] })
  await api.save("ai/gateway", override, "apply")
  expect(JSON.parse(requests[1].init!.body as string).strategy).toBe("apply")
  await api.apply("ai/gateway")
  expect(requests[2].url).toBe("/console/api/config/ai%2Fgateway/apply")
  expect(requests[2].init!.method).toBe("POST")
  expect(requests[2].init!.body).toBeUndefined()
})

test("reads bypass cache and retain the stored value, pending state and revision", async () => {
  let revision = 4
  const api = createConfigApi(async (_url, init) => {
    expect(init!.cache).toBe("no-store")
    return Response.json({ ...saved, kind: "config", id: "ai/gateway", schema: { type: "object" }, revision: revision++ })
  })
  expect((await api.get("ai/gateway")).pendingRestart).toBe(true)
  expect((await api.get("ai/gateway")).revision).toBe(5)
})

test("non-2xx and ok:false never masquerade as successful saves", async () => {
  for (const [status, ok] of [[400, false], [409, false], [500, true], [200, false]] as const) {
    const api = createConfigApi(async () => Response.json({ ...saved, ok, error: "apply rejected" }, { status }))
    let failure: ConfigFailure | undefined
    try { await api.save("ai/gateway", {}, "apply") } catch (error) { failure = error as ConfigFailure }
    expect(failure?.message).toBe(`HTTP ${status}: apply rejected`)
    expect(failure?.status).toBe(status)
    expect(failure?.data?.pendingRestart).toBe(true)
    expect(failure?.data?.revision).toBe(4)
  }
})

test("GET errors, invalid JSON, malformed success and network failures stay actionable", async () => {
  await expect(createConfigApi(async () => Response.json({ error: "bad stored config" }, { status: 400 })).get("x"))
    .rejects.toThrow("HTTP 400: bad stored config")
  await expect(createConfigApi(async () => new Response("unavailable", { status: 503 })).get("x"))
    .rejects.toThrow("HTTP 503")
  await expect(createConfigApi(async () => Response.json({ ok: true })).save("x", {}, "restart"))
    .rejects.toThrow("save response contract is incomplete")
  await expect(createConfigApi(async () => { throw new Error("offline") }).get("x")).rejects.toThrow("offline")
})

test("both save strategies serialize top-level unset keys without changing override or the apply endpoint", async () => {
  const bodies: unknown[] = []
  const api = createConfigApi(async (_url, init) => {
    bodies.push(JSON.parse(init!.body as string))
    return Response.json(saved)
  })
  const override = { providers: [], port: 0 }
  const unset = Object.freeze(["captureBodies", "database"])
  for (const strategy of ["apply", "restart"] as const) {
    await api.save("ai/gateway", override, strategy, unset)
    expect(bodies.at(-1)).toEqual({ override, strategy, unset: ["captureBodies", "database"] })
  }
  expect(override).toEqual({ providers: [], port: 0 })
  expect(unset).toEqual(["captureBodies", "database"])
})
