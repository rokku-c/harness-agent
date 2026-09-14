import type { ConsoleOptions } from "./options.ts"

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
