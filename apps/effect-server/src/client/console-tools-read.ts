/**
 * Every operation every app registered, as one read.
 *
 * Today the inspector is reached only through an app's view address, and only for
 * an app that registered MCP and drew nothing (`flows.md` §1.6, verified in
 * source at `view-route.ts:32`). Tools is a place now, so the whole catalogue
 * arrives in one response and the address scopes what is shown: `#tools` is the
 * list, `#tools/<app>` is one app's operations, `#tools/<app>/<operation>` is one
 * of them open. Reading it whole rather than one app at a time is what lets the
 * list offer the apps the reader has not reached yet, and what makes an app with
 * both a view and operations inspectable at all.
 */

import type { InspectorPayload, InspectorTool } from "./inspector-types.ts"

export interface ToolsCatalogue {
  readonly apps: readonly InspectorPayload[]
}

export const loadTools = async (): Promise<ToolsCatalogue> => {
  const response = await fetch("/console/api/tools", { cache: "no-store" })
  if (!response.ok) throw new Error(`/console/api/tools: HTTP ${response.status}`)
  const data = await response.json() as Partial<ToolsCatalogue>
  return { apps: data.apps ?? [] }
}

export const operationOf = (app: InspectorPayload, operation: string | undefined): InspectorTool | undefined =>
  operation === undefined ? undefined : app.tools.find((tool) => tool.name === operation)
