/**
 * Everything the launcher plans from: what each app is, and how it opens.
 *
 * An app is listed the way it declared itself — the registry holds what an app
 * registered, so the console adds no table of app ids and no name of its own.
 * Three lists, because an app can be openable three ways: it draws a view, it
 * only has tools (see tools-route.ts), it has configuration to edit. An app may
 * be in more than one; the client's plan keeps one entry per id.
 */

import type { ConsoleOptions } from "./options.ts"

/**
 * Host chrome ships its system apps through the same catalogue as product apps,
 * declaring its own mark and colour like any other app — the console is the
 * owner of these two, so it is the side that declares them here.
 */
const SYSTEM_APPS = [
  { interfaceId: "activity", title: "Activity", icon: "◔", color: "orange" },
  { interfaceId: "settings", title: "Settings", icon: "⚙", color: "gray" },
] as const

/** Interfaces that registered tools, under the title their interface carries. */
const toolEntries = (options: ConsoleOptions): ReadonlyArray<{ interfaceId: string; title: string }> => {
  const titles = new Map<string, string>()
  for (const entry of options.registry.tools()) {
    titles.set(entry.interfaceId, options.registry.find(entry.interfaceId)?.title ?? entry.interfaceId)
  }
  return [...titles].map(([interfaceId, title]) => ({ interfaceId, title }))
}

export const appsCatalogue = (options: ConsoleOptions) => ({
  ui: [...options.registry.apps().map((a) => ({ interfaceId: a.interfaceId, ...a.app })), ...SYSTEM_APPS],
  views: [...options.uiViews?.keys() ?? []],
  tools: toolEntries(options),
  config: options.configs.list().map((c) => ({ appId: c.appId, title: c.title ?? c.appId, hasSchema: true })),
})
