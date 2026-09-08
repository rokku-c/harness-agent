import { expect, test } from "bun:test"
import { registerEffectApp } from "../src/index.ts"
import { appHost } from "./fixtures.ts"

test("path-only descriptors register UI navigation with an empty tools interface", async () => {
  const host = appHost()
  const dispose = await registerEffectApp(host, { id: "board", title: "Board", path: "/board" })
  expect(host.registry.find("board")?.tools).toEqual([])
  expect(host.registry.apps()).toEqual([{ interfaceId: "board", app: {
    id: "console", title: "Board", path: "/board", resourceUri: "ui://board/console",
  } }])
  await dispose()
  expect(host.registry.apps()).toEqual([])
  expect(host.registry.find("board")).toBeUndefined()
})

test("old path-only disposers preserve the replacement navigation entry", async () => {
  const host = appHost()
  const old = await registerEffectApp(host, { id: "board", path: "/old" })
  const current = await registerEffectApp(host, { id: "board", path: "/board" })
  await old()
  expect(host.registry.apps().map(({ app }) => app.path)).toEqual(["/board"])
  await current()
  expect(host.registry.apps()).toEqual([])
})
