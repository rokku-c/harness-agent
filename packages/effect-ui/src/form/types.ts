export interface JsonField {
  readonly type?: string
  readonly default?: unknown
  readonly enum?: readonly unknown[]
  readonly description?: string
  readonly title?: string
  readonly format?: string
  readonly writeOnly?: boolean
  readonly properties?: Readonly<Record<string, JsonField>>
  readonly required?: readonly string[]
  readonly items?: JsonField
  readonly minimum?: number
  readonly maximum?: number
  readonly minLength?: number
  readonly maxLength?: number
  readonly minItems?: number
  readonly maxItems?: number
}
export type JsonSchema = JsonField

/** Mutable editor state; undefined is deliberately distinct from false / zero. */
export interface FormNode {
  id: string
  key: string
  schema: JsonField
  required: boolean
  kind: string
  value: unknown
  present: boolean
  fields: FormNode[]
  rows: FormNode[]
  source?: string
  discriminator?: string
  enabled?: boolean
  locked?: boolean
}
export interface FormDocument {
  appId: string
  root: FormNode
  declared: boolean
}
