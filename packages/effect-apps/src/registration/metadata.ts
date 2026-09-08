import type { EffectAppDescriptor, EffectAppHost } from "../descriptor.ts"
import type { Cleanup } from "./disposal.ts"

const owners = new WeakMap<object, Map<string, object>>()

/** Track generations, not just values: replacement HTML/UI may be identical. */
const registerMap = <T>(map: Map<string, T>, id: string, value: T): Cleanup => {
  let generations = owners.get(map)
  if (generations === undefined) owners.set(map, generations = new Map())
  const token = {}
  generations.set(id, token)
  map.set(id, value)
  return () => {
    if (generations.get(id) !== token) return
    generations.delete(id)
    if (map.get(id) === value) map.delete(id)
  }
}

export const registerMetadata = (host: EffectAppHost, app: EffectAppDescriptor, steps: Cleanup[]): void => {
  if (host.uiViews !== undefined && app.ui !== undefined) {
    steps.push(registerMap(host.uiViews, app.id, app.ui))
  }
  if (host.uiHtml !== undefined && app.uiHtml !== undefined) {
    steps.push(registerMap(host.uiHtml, app.id, app.uiHtml))
  }
  if (host.registry !== undefined && (app.tools !== undefined || app.path !== undefined)) {
    steps.push(host.registry.registerInterface({
      id: app.id,
      title: app.title ?? app.id,
      description: app.description,
      tools: (app.tools ?? []) as never,
      ...(app.path !== undefined
        ? { apps: [{ id: "console", title: app.title ?? app.id, path: app.path, resourceUri: `ui://${app.id}/console` }] }
        : {}),
    }))
  }
}
