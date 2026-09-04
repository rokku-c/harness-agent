/**
 * model/tool.ts - the TOOL MODEL (homoiconic: code is data).
 *
 * Concept: all tools - native, script, composed - share one data shape.
 * deps is the core field: the anchor of closure visibility and the minimal
 * runtime injection surface (object capability).
 */
export interface JSONSchema {
  readonly type?: string
  readonly properties?: Readonly<Record<string, JSONSchema>>
  readonly required?: ReadonlyArray<string>
  readonly items?: JSONSchema
  readonly [key: string]: unknown
}

export interface ComposedStep {
  readonly tool: string
  /** Declarative input binding for composed steps (skeleton): step output field -> the next tool's input field */
  readonly bind?: Readonly<Record<string, string>>
}

export type Impl =
  | { readonly kind: "native"; readonly execute: (input: unknown) => Promise<unknown> }
  | { readonly kind: "script"; readonly lang: "ts" | "js"; readonly source: string }
  | { readonly kind: "composed"; readonly steps: ReadonlyArray<ComposedStep> }

/** Author's explicit declaration of behavior (behavior cannot be auto-detected). */
export interface BehaviorDeclaration {
  /** Whether behavior changed relative to the previous version (honestly declared by the author). */
  readonly changed: boolean
  readonly note?: string
}

import type { CompatPolicy } from "./compat.ts"

export interface ToolDef {
  readonly name: string
  readonly description: string
  /** Optional semver ("1.2.0"): used for weak-dependency range matching */
  readonly semver?: string
  readonly input: JSONSchema
  readonly output: JSONSchema
  /** Declared dependencies: closure visibility anchor + runtime injection surface */
  readonly deps: ReadonlyArray<string>
  readonly impl: Impl
  /** Compatibility declaration (optional; supplements diff-based assessment) */
  readonly compat?: Partial<CompatPolicy>
  readonly behavior?: BehaviorDeclaration
}
