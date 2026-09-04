/**
 * a2ui/catalog.ts - the BASIC CATALOG SCHEMA REGISTRY.
 *
 * Concept: the only components the renderer knows are the official Basic
 * Catalog names; their strict zod schemas are lifted from @a2ui/web_core at
 * import time (name -> schema map), so sanitize can ask "is this prop legal?"
 * without hand-writing a schema copy.
 */
import * as a2uiCore from "@a2ui/web_core/v0_9"

export interface CatalogIssue { code?: string; path?: Array<string | number>; message?: string }
export interface CatalogSchema {
  readonly shape: Record<string, unknown>
  readonly safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: { issues?: CatalogIssue[] } }
}

/** basic catalog v0.9 component names (the only components the renderer knows) */
export const BASIC_COMPONENTS = new Set([
  "Text", "Image", "Icon", "Video", "AudioPlayer", "Row", "Column", "List", "Card",
  "Tabs", "Divider", "Modal", "Button", "TextField", "CheckBox", "ChoicePicker", "Slider", "DateTimeInput"
])

/** container-like components whose schema takes child/children references */
export const CONTAINERS = new Set(["Row", "Column", "Card", "Modal", "List"])

export const catalogSchemaByName = new Map<string, CatalogSchema>()
for (const value of Object.values(a2uiCore) as Array<{ name?: unknown; schema?: { shape?: unknown } }>) {
  if (
    typeof value === "object" && value !== null &&
    typeof value.name === "string" && BASIC_COMPONENTS.has(value.name) &&
    value.schema !== undefined && typeof value.schema.shape === "object"
  ) {
    catalogSchemaByName.set(value.name, value.schema as unknown as CatalogSchema)
  }
}
