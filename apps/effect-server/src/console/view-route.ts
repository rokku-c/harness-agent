import { viewToJsonSpec } from "@effect-agent/effect-ui"
import type { ConsoleOptions } from "./options.ts"

export const viewRoute = (options: ConsoleOptions, id: string): Response => {
  const view = options.uiViews?.get(id)
  const html = options.uiHtml?.get(id)
  const path = options.registry.apps().find((a) => a.interfaceId === id)?.app.path
  if (view === undefined && html === undefined && path === undefined) {
    return Response.json({ kind: "none", id, detail: "no declarative description" }, { status: 404 })
  }
  return Response.json({ kind: "view", id,
    ...(view !== undefined ? { view, jsonSpec: viewToJsonSpec(view) } : {}),
    ...(html !== undefined ? { html } : {}), ...(path !== undefined ? { path } : {}),
    languages: [...(view ? ["effect-ui", "json-render"] : []), ...(html ? ["html"] : [])],
  })
}
