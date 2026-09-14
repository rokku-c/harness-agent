/**
 * Everything the console plans from: what each app is, and how it opens.
 *
 * An app is listed the way it declared itself — the registry holds what an app
 * registered, so the console adds no table of app ids and no name of its own.
 * Three lists, because an app can be openable three ways: it draws a view, it
 * registered operations (see tools-route.ts), it has configuration to edit. An
 * app may be in more than one; the client's plan keeps one entry per id.
 *
 * Activity and Settings used to be listed here as system apps. They are places
 * now (`flows.md` §1.4): a place exists with zero apps registered and its address
 * carries no app id, so shipping it as an app would have made it a fourth and a
 * fifth special case in the very catalogue the places were built to stop
 * special-casing.
 */

import type { ConsoleOptions } from "./options.ts"

/** Interfaces that registered tools, under the title their interface carries. */
const toolEntries = (options: ConsoleOptions): ReadonlyArray<{ interfaceId: string; title: string }> => {
  const titles = new Map<string, string>()
  for (const entry of options.registry.tools()) {
    titles.set(entry.interfaceId, options.registry.find(entry.interfaceId)?.title ?? entry.interfaceId)
  }
  return [...titles].map(([interfaceId, title]) => ({ interfaceId, title }))
}

export const appsCatalogue = (options: ConsoleOptions) => ({
  ui: options.registry.apps().map((a) => ({ interfaceId: a.interfaceId, ...a.app })),
  views: [...options.uiViews?.keys() ?? []],
  tools: toolEntries(options),
  config: options.configs.list().map((c) => ({ appId: c.appId, title: c.title ?? c.appId, hasSchema: true })),
})
