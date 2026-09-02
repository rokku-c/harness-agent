/**
 * ToolDef: the unified tool model (homoiconic: code is data). All tools — native, script, composed —
 * share the same data shape. deps is the core field: the anchor of closure visibility + the minimal
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
  /** Declarative input binding for composed steps (skeleton): step output field → the next tool's input field */
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

/* ------------------------------ Compatibility ------------------------------ */

/** Four breaking-change levels (descending severity). */
export type CompatLevel = "schema" | "deps" | "description" | "behavior"

export type CompatMode = "strict" | "warn" | "ignore"

export interface CompatPolicy {
  readonly schema: CompatMode
  readonly deps: CompatMode
  readonly description: CompatMode
  readonly behavior: "require-declaration" | "ignore"
}

export const defaultCompat: CompatPolicy = {
  schema: "strict",
  deps: "strict",
  description: "warn",
  behavior: "require-declaration"
}

/* ------------------------------ Version references ------------------------------ */

export type Ref =
  | { readonly kind: "latest" }
  | { readonly kind: "revision"; readonly n: number }
  | { readonly kind: "hash"; readonly hash: string }
  | { readonly kind: "range"; readonly spec: string }

export interface Dep {
  readonly name: string
  readonly ref: Ref
}

export const refToShort = (ref: Ref): string => {
  switch (ref.kind) {
    case "latest": return "latest"
    case "revision": return "rev:" + ref.n
    case "hash": return ref.hash.slice(0, 8)
    case "range": return ref.spec
  }
}

/* ------------------------------ Version objects ------------------------------ */

export interface Version {
  readonly tool: string
  readonly revision: number
  /** SHA-256(canonical content + dep hashes) — content addressing that locks the dependency closure */
  readonly hash: string
  readonly parent?: string
  readonly message: string
  readonly content: ToolDef
  readonly createdAt: number
  /** Version visibility: experimental versions can be hidden from specific agents */
  readonly hidden?: boolean
}

export type VersionVisibility = "public" | "hidden" | "restricted"

/* ------------------------------ Policy ------------------------------ */

export interface Policy {
  readonly api: {
    readonly mode: "allowlist" | "denylist"
    readonly scope: ReadonlyArray<string>
  }
  readonly version: {
    /** Agent's default versions: tool → Ref */
    readonly defaults: Readonly<Record<string, Ref>>
    readonly visibility: Readonly<Record<string, VersionVisibility>>
  }
  readonly compat: CompatPolicy
  readonly sandbox: {
    readonly runtime: "quickjs" | "graaljs" | "node-vm" | "isolated-vm"
    readonly timeoutMs: number
    readonly memoryMb: number
  }
  /** Fine-grained whitelist: config paths an agent may override (dot paths, e.g. "compat.schema") */
  readonly allowAgentConfig: ReadonlyArray<string>
}

export const defaultPolicy: Policy = {
  api: { mode: "allowlist", scope: [] },
  version: { defaults: {}, visibility: {} },
  compat: defaultCompat,
  sandbox: { runtime: "isolated-vm", timeoutMs: 5000, memoryMb: 64 },
  allowAgentConfig: []
}
