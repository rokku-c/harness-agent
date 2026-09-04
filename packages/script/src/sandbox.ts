/**
 * Barrel: the script sandbox split by CONCEPT (see ./sandbox/).
 * host.ts = contract + glue (ToolApi/ScriptRuntime/injectNamespace/
 * scriptToolApi); node.ts = NodeVmRuntime fallback; isolated.ts =
 * IsolatedVmRuntime (recommended); ivm-loader.ts + isolated-setup.ts are its
 * internals (lazy native loading, isolate-side bridge bootstrap).
 */
export type { ToolApi, DefineToolSpec, ScriptHost, ScriptRuntime } from "./sandbox/host.ts"
export { injectNamespace, scriptToolApi } from "./sandbox/host.ts"
export { NodeVmRuntime } from "./sandbox/node.ts"
export { IsolatedVmRuntime } from "./sandbox/isolated.ts"
