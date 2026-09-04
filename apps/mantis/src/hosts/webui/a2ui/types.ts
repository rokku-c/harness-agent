/**
 * a2ui/types.ts - the A2UI v0.9 MESSAGE CONTRACT.
 *
 * Concept: the agent renders UI by emitting REAL A2UI messages (a2ui.org,
 * the Agent-to-UI protocol): createSurface + updateComponents with Basic
 * Catalog components (children reference ids, text is its own Text node).
 * This file owns the message shapes + light structural validation - full
 * validation stays with the official renderer.
 */
export const A2UI_BASIC_CATALOG = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"

export interface A2uiCreateSurface {
  readonly version: "v0.9" | "v0.9.1"
  readonly createSurface: { readonly surfaceId: string; readonly catalogId?: string }
}
export interface A2uiUpdateComponents {
  readonly version: "v0.9" | "v0.9.1"
  readonly updateComponents: {
    readonly surfaceId: string
    readonly components: ReadonlyArray<Record<string, unknown>>
  }
}
export interface A2uiUpdateDataModel {
  readonly version: "v0.9" | "v0.9.1"
  readonly updateDataModel: { readonly surfaceId: string; readonly path?: string; readonly value?: unknown }
}
export interface A2uiDeleteSurface {
  readonly version: "v0.9" | "v0.9.1"
  readonly deleteSurface: { readonly surfaceId: string }
}
export type A2uiMessage = A2uiCreateSurface | A2uiUpdateComponents | A2uiUpdateDataModel | A2uiDeleteSurface

export const isVersion = (value: unknown): value is "v0.9" | "v0.9.1" => value === "v0.9" || value === "v0.9.1"

/** light structural validation of one official message (the renderer validates fully) */
export const isMessage = (value: unknown): value is A2uiMessage => {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  if (!isVersion(record.version)) return false
  if (typeof record.createSurface === "object" && record.createSurface !== null) {
    const surface = record.createSurface as Record<string, unknown>
    return typeof surface.surfaceId === "string" && surface.surfaceId !== ""
  }
  if (typeof record.updateComponents === "object" && record.updateComponents !== null) {
    const update = record.updateComponents as Record<string, unknown>
    return typeof update.surfaceId === "string" && Array.isArray(update.components)
  }
  if (typeof record.updateDataModel === "object" && record.updateDataModel !== null) {
    return typeof (record.updateDataModel as Record<string, unknown>).surfaceId === "string"
  }
  if (typeof record.deleteSurface === "object" && record.deleteSurface !== null) {
    return typeof (record.deleteSurface as Record<string, unknown>).surfaceId === "string"
  }
  return false
}

/** surface id of a batch: the createSurface (or first update)'s surfaceId */
export const surfaceIdOfBatch = (messages: ReadonlyArray<A2uiMessage>): string => {
  for (const message of messages) {
    if ("createSurface" in message && typeof message.createSurface === "object")
      return message.createSurface.surfaceId
    if ("updateComponents" in message && typeof message.updateComponents === "object")
      return message.updateComponents.surfaceId
  }
  return "main"
}
