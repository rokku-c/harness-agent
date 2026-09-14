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
