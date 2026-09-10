import { expect, test } from "bun:test"
import { configApps, homeApps, parseConsoleHash, planConsole, type ConsoleCatalogue } from "../console-navigation.ts"

test("plan merges app surfaces once and preserves catalogue order", () => {
  const plan = planConsole({ ui: [{ interfaceId: "gateway", title: "Gateway" }], views: ["shared"], config: [{ appId: "gateway" }, { appId: "daemon", title: "Daemon" }] })
  expect(plan.map(({ id }) => id)).toEqual(["gateway", "shared", "daemon"])
  expect(plan[0]).toMatchObject({ title: "Gateway", hasView: true, hasConfig: true })
})

test("home and settings projections keep one app entry per destination", () => {
  const plan = planConsole({ ui: [{ interfaceId: "board", title: "Board" }], config: [{ appId: "board" }, { appId: "ai-gateway" }] })
  expect(homeApps(plan)).toEqual([{ id: "board", title: "Board", opensConfig: false }, { id: "ai-gateway", title: "ai-gateway", opensConfig: true }])
  expect(configApps(plan).map(({ id }) => id)).toEqual(["board", "ai-gateway"])
})

test("hash routes resolve only declared view/config surfaces", () => {
  const plan = planConsole({ ui: [{ interfaceId: "my app" }], config: [{ appId: "daemon" }] } as ConsoleCatalogue)
  expect(parseConsoleHash("#", plan)).toEqual({ kind: "home" })
  expect(parseConsoleHash("#settings/config/daemon", plan)).toEqual({ kind: "settings-config", id: "daemon" })
  expect(parseConsoleHash("#apps", plan)).toEqual({ kind: "apps" })
  expect(parseConsoleHash("#view/my%20app", plan)).toEqual({ kind: "view", id: "my app" })
  expect(parseConsoleHash("#view/daemon", plan)).toEqual({ kind: "home" })
})

import { splitDockItems } from "../console-runtime.ts"

test("dock separates pinned apps from temporary apps without adding Home", () => {
  const items = [
    { id: "board", title: "Board", surface: "view" as const, persistent: true },
    { id: "settings", title: "Settings", surface: "settings" as const, persistent: true },
    { id: "worker", title: "Worker", surface: "view" as const },
  ]
  const groups = splitDockItems(items)
  expect(groups.persistent.map(({ id }) => id)).toEqual(["board", "settings"])
  expect(groups.transient.map(({ id }) => id)).toEqual(["worker"])
})
