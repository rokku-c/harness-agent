export interface JSONSchema {
  readonly type?: string
  readonly properties?: Readonly<Record<string, JSONSchema>>
  readonly required?: ReadonlyArray<string>
  readonly items?: JSONSchema
  readonly [key: string]: unknown
}

export interface ComposedStep {
  readonly tool: string
  readonly bind?: Readonly<Record<string, string>>
}

export type Impl =
  | { readonly kind: "native"; readonly execute: (input: unknown) => Promise<unknown> }
  | { readonly kind: "script"; readonly lang: "ts" | "js"; readonly source: string }
  | { readonly kind: "composed"; readonly steps: ReadonlyArray<ComposedStep> }

export interface BehaviorDeclaration {
  readonly changed: boolean
  readonly note?: string
}

import type { CompatPolicy } from "@effect-agent/effect-compat"

export interface ToolDef {
  readonly name: string
  readonly description: string
  readonly semver?: string
  readonly input: JSONSchema
  readonly output: JSONSchema
  readonly deps: ReadonlyArray<string>
  readonly impl: Impl
  readonly compat?: Partial<CompatPolicy>
  readonly behavior?: BehaviorDeclaration
}
