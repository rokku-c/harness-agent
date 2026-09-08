import { expect, test } from "bun:test"
import { registerEffectApp } from "@effect-agent/effect-apps"
import { networkFixture } from "./network-fixture.ts"

test("all managed ports expose the same registered handlers unless explicitly filtered", async () => {
  const fixture = await networkFixture({ role: "main", listeners: [
    { id: "a", port: 0 }, { id: "b", port: 0 }, { id: "only-demo", port: 0, apps: ["demo"] },
  ] })
  const { app } = fixture
  try {
    expect(app.listeners()).toEqual([]) // app construction itself binds no socket
    await registerEffectApp(app, { id: "demo", routes: [{ path: "/demo", match: "prefix" }],
      createPlugin: () => ({ id: "demo", load: async () => ({ handle: async () => Response.json({ service: "demo" }) }) }),
    })
    const ports = await app.listen()
    for (const port of ports) {
      const response = await fetch(new URL("/demo/read", port.url))
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ service: "demo" })
    }
    expect((await fetch(new URL("/console", ports[0].url))).status).toBe(200)
    expect((await fetch(new URL("/console", ports[1].url))).status).toBe(200)
    expect((await fetch(new URL("/console", ports[2].url))).status).toBe(403)
    await app.host.disable("demo")
    expect((await fetch(new URL("/demo/read", ports[0].url))).status).toBe(404)
  } finally { await fixture.close() }
})
