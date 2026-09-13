import { expect, test } from "bun:test"
import { appRoute, configApps, defaultColor, homeApps, parseConsoleHash, planConsole, type ConsoleCatalogue } from "../console-plan.ts"
import { hashOf } from "../console-nav.ts"

test("an app's mark and colour come from the app, never from a host-side table", () => {
  const plan = planConsole({
    ui: [{ interfaceId: "board", title: "Board", icon: "▦", color: "grass" }],
    config: [{ appId: "daemon", title: "Daemon" }],
  })
  expect(plan[0]).toMatchObject({ icon: "▦", color: "grass" })
  // an app that declares nothing still draws as itself: the fallback is derived
  // from the id, so the host needs no list of ids to recognise an app it has
  // never heard of, and two consoles agree on how it looks
  const undeclared = planConsole({ config: [{ appId: "daemon" }] })[0]!
  expect(plan[1]).toMatchObject({ icon: "D", color: undeclared.color })
  expect(plan[1]!.color).toBe(defaultColor("daemon"))
})

test("the app's own registration names it; a config record only fills a gap", () => {
  const plan = planConsole({
    ui: [{ interfaceId: "ui-host", title: "UI Canvas", icon: "▣", color: "iris" }],
    config: [{ appId: "ui-host", title: "ui-host" }, { appId: "platform-network", title: "Platform Network" }],
  })
  // one app, two records about it: the config registry's note must not rename the
  // app the launcher draws, and an app only the config registry knows still gets
  // a name of its own
  expect(plan.find((entry) => entry.id === "ui-host")).toMatchObject({ title: "UI Canvas", icon: "▣", color: "iris" })
  expect(plan.find((entry) => entry.id === "platform-network")).toMatchObject({ title: "Platform Network", icon: "P" })
})

test("plan merges app surfaces once and preserves catalogue order", () => {
  const plan = planConsole({ ui: [{ interfaceId: "gateway", title: "Gateway" }], views: ["shared"], config: [{ appId: "gateway" }, { appId: "daemon", title: "Daemon" }] })
  expect(plan.map(({ id }) => id)).toEqual(["gateway", "shared", "daemon"])
  expect(plan[0]).toMatchObject({ title: "Gateway", hasView: true, hasConfig: true })
})

test("home and settings projections keep one app entry per destination", () => {
  const plan = planConsole({ ui: [{ interfaceId: "board", title: "Board" }], config: [{ appId: "board" }, { appId: "ai-gateway" }] })
  expect(homeApps(plan)).toEqual([{ id: "board", title: "Board", opensConfig: false }])
  expect(configApps(plan).map(({ id }) => id)).toEqual(["board", "ai-gateway"])
})

test("hash routes resolve only declared view/config surfaces", () => {
  const plan = planConsole({ ui: [{ interfaceId: "my app" }], config: [{ appId: "daemon" }] } as ConsoleCatalogue)
  expect(parseConsoleHash("#", plan)).toEqual({ kind: "home" })
  expect(parseConsoleHash("#settings/config/daemon", plan)).toEqual({ kind: "settings-config", id: "daemon" })
  expect(parseConsoleHash("#view/my%20app", plan)).toEqual({ kind: "view", id: "my app" })
  expect(parseConsoleHash("#view/daemon", plan)).toEqual({ kind: "home" })
})

test("an app's tile destination survives a round trip through the address bar", () => {
  const plan = planConsole({ ui: [{ interfaceId: "board", title: "Board" }, { interfaceId: "settings", title: "Settings" }], config: [{ appId: "board" }] })
  for (const entry of plan) {
    const route = appRoute(entry.id, entry.hasView)
    expect(parseConsoleHash(hashOf(route), plan)).toEqual(route)
  }
  expect(appRoute("board", true)).toEqual({ kind: "view", id: "board" })
  expect(appRoute("settings", true)).toEqual({ kind: "settings" })
  expect(appRoute("daemon", false)).toEqual({ kind: "config", id: "daemon" })
})
