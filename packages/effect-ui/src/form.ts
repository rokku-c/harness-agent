import { createFormModel } from "./form/model.ts"
import { createFormControls } from "./form/controls.ts"
import { createFormParser } from "./form/parse.ts"
import { createFormRenderer } from "./form/render.ts"
import type { JsonSchema } from "./form/types.ts"

export type { JsonField, JsonSchema, FormDocument, FormNode } from "./form/types.ts"
export type { FormModel } from "./form/model.ts"
export { createFormModel } from "./form/model.ts"
export { createFormParser } from "./form/parse.ts"
export { createFormControls } from "./form/controls.ts"
export { createFormRenderer } from "./form/render.ts"
export { createFormMount } from "./form/mount.ts"

export const configFormModel = createFormModel()
export const parseConfigForm = createFormParser().parse
export const renderConfigForm = (appId: string, schema?: JsonSchema,
  value?: Readonly<Record<string, unknown>>, sources?: Readonly<Record<string, string>>): string =>
  createFormRenderer(createFormControls()).html(configFormModel.create(appId, schema, value, sources))
