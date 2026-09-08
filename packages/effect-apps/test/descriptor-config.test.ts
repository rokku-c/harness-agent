import { expect, mock, test } from "bun:test"
import { makeConfigRegistry, makeSqliteConfigStore } from "@effect-agent/effect-config"
import { registerEffectApp } from "../src/index.ts"
import { appHost, descriptor, plane } from "./fixtures.ts"

test("factory wins and receives a live activeConfig reader after initialization and metadata", async () => {
  const host = appHost()
  const events: string[] = []
  let active: unknown = { label: "initial" }
  let read!: () => unknown
  const fallback = mock(async () => plane())
  const dispose = await registerEffectApp({ ...host,
    initializeConfig: (id) => {
      expect(id).toBe("board")
      expect(host.configs.get(id)).toBeDefined()
      expect(host.registry.find(id)).toBeUndefined()
      expect(host.uiViews.size).toBe(0)
      active = { label: "initialized" }
      events.push("initialize")
    },
    activeConfig: (id) => { expect(id).toBe("board"); return active },
  }, { ...descriptor(), plugin: { id: "fallback", load: fallback },
    createPlugin: (getConfig) => {
      read = getConfig
      expect(host.registry.find("board")).toBeDefined()
      expect(host.uiViews.has("board")).toBe(true)
      events.push("factory")
      return { id: "board", load: async () => {
        expect(read()).toEqual({ label: "initialized" }); events.push("load"); return plane()
      } }
    },
  })
  expect(events).toEqual(["initialize", "factory", "load"])
  active = { label: "updated" }
  expect(read()).toEqual({ label: "updated" })
  active = undefined
  expect(read()).toBeUndefined()
  expect(fallback).not.toHaveBeenCalled()
  await dispose()
})

test("without activeConfig the factory reads configs.read(appId).value, including saved changes", async () => {
  const store = makeSqliteConfigStore({ file: ":memory:" })
  const host = { ...appHost(), configs: makeConfigRegistry({ store }) }
  let read!: () => unknown
  try {
    const dispose = await registerEffectApp({ ...host, initializeConfig: (id) => {
      expect(host.configs.initialize(id, { yaml: { label: "sqlite" } }).ok).toBe(true)
    } }, { ...descriptor(), createPlugin: (getConfig) => {
      read = getConfig
      return { id: "board", load: async () => {
        expect(read()).toEqual({ label: "sqlite" }); return plane()
      } }
    } })
    expect(host.configs.save("board", { label: "saved" }).ok).toBe(true)
    expect(read()).toEqual({ label: "saved" })
    await dispose()
  } finally { host.configs.close(); store.close() }
})
