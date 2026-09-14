import { expect, test } from "bun:test"
import { appRoute, configApps, defaultColor, planConsole } from "../console-plan.ts"
import { parseConsoleHash } from "../console-places.tsx"
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
  expect(plan[1]).toMatchObject({ icon: "D", color: defaultColor("daemon") })
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

test("drawing and registering operations are two facts, not one", () => {
  // the defect this act fixes: a tools-registering app used to be marked `hasView`, so an app with
  // both lost its operations behind its own view and an address could not say which it would open
  const plan = planConsole({ ui: [{ interfaceId: "board", title: "Board" }], tools: [{ interfaceId: "mantis", title: "Mantis" }] })
  expect(plan.find((entry) => entry.id === "mantis")).toMatchObject({ hasView: false, hasTools: true })
  expect(plan.filter((entry) => entry.hasView).map(({ id }) => id)).toEqual(["board"])
  expect(configApps(planConsole({ ui: [{ interfaceId: "board" }], config: [{ appId: "board" }, { appId: "ai-gateway" }] })).map(({ id }) => id))
    .toEqual(["board", "ai-gateway"])
})

test("every address flows.md §1.4 names resolves", () => {
  const plan = planConsole({ ui: [{ interfaceId: "board", title: "Board" }], tools: [{ interfaceId: "board" }], config: [{ appId: "board" }] })
  expect(parseConsoleHash("#", plan)).toEqual({ kind: "home" })
  expect(parseConsoleHash("#inbox", plan)).toEqual({ kind: "inbox" })
  expect(parseConsoleHash("#inbox/dec-1", plan)).toEqual({ kind: "inbox", decisionId: "dec-1" })
  expect(parseConsoleHash("#activity", plan)).toEqual({ kind: "activity", filter: {} })
  expect(parseConsoleHash("#activity?actor=agent&app=board&kind=call&since=1700", plan)).toEqual({ kind: "activity", filter: { actor: "agent", app: "board", kind: "call", since: "1700" } })
  expect(parseConsoleHash("#tools", plan)).toEqual({ kind: "tools" })
  expect(parseConsoleHash("#tools/board", plan)).toEqual({ kind: "tools", app: "board" })
  expect(parseConsoleHash("#tools/board/board.open", plan)).toEqual({ kind: "tools", app: "board", operation: "board.open" })
  expect(parseConsoleHash("#settings", plan)).toEqual({ kind: "settings" })
  expect(parseConsoleHash("#settings/board", plan)).toEqual({ kind: "settings", app: "board" })
  expect(parseConsoleHash("#app/board", plan)).toEqual({ kind: "app", id: "board" })
  expect(parseConsoleHash("#app/board/task?taskId=7", plan)).toEqual({ kind: "app", id: "board", screen: "task", params: { taskId: "7" } })
  expect(parseConsoleHash("#app/board/settings", plan)).toEqual({ kind: "app-settings", id: "board" })
})

test("scoping an app that registered no operations is a not-found, not an empty list", () => {
  const plan = planConsole({ ui: [{ interfaceId: "board", title: "Board" }], tools: [{ interfaceId: "mantis" }] })
  expect(parseConsoleHash("#tools/mantis", plan)).toEqual({ kind: "tools", app: "mantis" })
  expect(parseConsoleHash("#tools/board", plan)).toMatchObject({ kind: "not-found", part: "app", text: "board" })
})

test("an address that resolves to nothing keeps exactly the address it was given", () => {
  const plan = planConsole({ config: [{ appId: "daemon" }] })
  for (const address of ["#view/daemon", "#config/daemon", "#nonsense", "#tools/unknown", "#app"]) {
    const route = parseConsoleHash(address, plan)
    expect(route).toMatchObject({ kind: "not-found", address })
    expect(hashOf(route)).toBe(address)
  }
  // the two config spellings are one address now, so the first segment of the old
  // composite one reads as an app id — and an app that declares no configuration
  // says so in place, with the address kept, instead of being silently re-pointed
  expect(parseConsoleHash("#settings/config/daemon", plan)).toEqual({ kind: "settings", app: "config" })
})

test("an app's tile destination survives a round trip through the address bar", () => {
  const plan = planConsole({ ui: [{ interfaceId: "board", title: "Board" }, { interfaceId: "settings", title: "Settings" }], config: [{ appId: "board" }] })
  for (const entry of plan) {
    const route = appRoute(entry.id)
    expect(parseConsoleHash(hashOf(route), plan)).toEqual(route)
  }
  // an app is an app, whatever it is called: there is no id the shell special-cases
  expect(appRoute("settings")).toEqual({ kind: "app", id: "settings" })
  // one screen has one address: the first screen is the address that names no screen
  expect(parseConsoleHash(hashOf({ kind: "app", id: "board", screen: "root" }), plan)).toEqual({ kind: "app", id: "board" })
})

test("a deep link to an app resolves the same way against an empty catalogue", () => {
  // a failed catalogue read is not a host with no apps: an app address must not become Not found
  // because the plan is empty, which is what a `hasView` check inside the resolver would do
  const empty = planConsole({})
  expect(parseConsoleHash("#app/board", empty)).toEqual({ kind: "app", id: "board" })
  for (const address of ["#settings", "#tools"]) expect(parseConsoleHash(address, empty)).not.toMatchObject({ kind: "not-found" })
})
