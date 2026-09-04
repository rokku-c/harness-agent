/**
 * Barrel: the script model split by CONCEPT (see ./model/).
 * tool.ts = ToolDef core; compat.ts = compat policy; version-refs.ts = deps
 * + Version; policy.ts = the full agent Policy document + defaults.
 */
export type { JSONSchema, ComposedStep, Impl, BehaviorDeclaration, ToolDef } from "./model/tool.ts"
export type { CompatLevel, CompatMode, CompatPolicy } from "./model/compat.ts"
export { defaultCompat } from "./model/compat.ts"
export type { Ref, Dep, Version, VersionVisibility } from "./model/version-refs.ts"
export { refToShort } from "./model/version-refs.ts"
export type { Policy } from "./model/policy.ts"
export { defaultPolicy } from "./model/policy.ts"
