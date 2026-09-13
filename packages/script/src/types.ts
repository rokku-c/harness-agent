/**
 * Barrel: the script model split by CONCEPT (see ./model/).
 * tool.ts = ToolDef core; version-refs.ts = deps + Version; policy.ts = the full
 * agent Policy document + defaults. The compatibility policy a Policy carries is
 * @effect-agent/effect-compat's — the sandbox is one user of that model, not its
 * owner, and re-exporting it here would be a second way to name one thing.
 */
export type { JSONSchema, ComposedStep, Impl, BehaviorDeclaration, ToolDef } from "./model/tool.ts"
export type { Ref, Dep, Version, VersionVisibility } from "./model/version-refs.ts"
export { refToShort } from "./model/version-refs.ts"
export type { Policy } from "./model/policy.ts"
export { defaultPolicy } from "./model/policy.ts"
