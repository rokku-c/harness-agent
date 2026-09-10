import { roleDocument } from "@effect-agent/effect-ui"
import { configApps, homeApps, planConsole, type ConsoleCatalogue } from "../client/console-plan.ts"
import type { Spec } from "@json-render/core"

export interface ConsoleSystemUiCatalogue extends ConsoleCatalogue {
  readonly ui?: ReadonlyArray<{ readonly interfaceId?: string; readonly title?: string }>
}

const item = (id: string, title: string, surface?: "settings" | "view" | "config", persistent = false) => ({ id, title, ...(surface ? { surface } : {}), ...(persistent ? { persistent } : {}) })

/** Projects the live catalogue into the shell's shared role/spec protocol. */
export const consoleSystemUi = (catalogue: ConsoleSystemUiCatalogue): Spec => {
  const plan = planConsole(catalogue)
  const apps = homeApps(plan).map(({ id, title, opensConfig }) => ({ id, title, surface: opensConfig ? "config" : "view" as const, persistent: true }))
  const settings = configApps(plan).map(({ id, title }) => item(id, title))
  const dock = [...apps, item("settings", "Settings", "settings", true)]
  return roleDocument([
    { role: "Dock", props: { collapsed: false, items: dock } },
    { role: "Springboard", props: { title: "Home", apps, items: apps } },
    { role: "SettingsGroup", props: { title: "Settings", items: settings } },
  ])
}
