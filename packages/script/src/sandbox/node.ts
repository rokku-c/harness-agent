/**
 * sandbox/node.ts - NodeVmRuntime (zero-dependency fallback skeleton).
 *
 * Concept: a node:vm context with the declared deps injected by name. NOTE:
 * node:vm is not a real sandbox - once host objects are injected, the
 * constructor chain can escape. Production must switch to an isolated engine.
 */
import vm from "node:vm"
import type { ScriptRuntime } from "./host.ts"
import { injectNamespace } from "./host.ts"

/** Default implementation: node:vm (note: vm is not a real sandbox; production must switch to an isolated engine). */
export const NodeVmRuntime: ScriptRuntime = {
  runtime: "node-vm",
  execute: async (source, env, host, timeoutMs = 5000) => {
    const sandbox: Record<string, unknown> = {
      console,
      defineTool: host.defineTool
    }
    // inject dep apis into the global scope layer by layer, keyed by tool name (least-privilege surface)
    for (const [name, api] of Object.entries(env)) injectNamespace(sandbox, name, api.invoke)
    const context = vm.createContext(sandbox)
    // script body = async IIFE: supports top-level await and return
    const wrapped = "(async () => {\n" + source + "\n})()"
    const result = await vm.runInContext(wrapped, context, { timeout: timeoutMs })
    return result
  }
}
