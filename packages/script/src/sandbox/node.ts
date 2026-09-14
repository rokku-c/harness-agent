import vm from "node:vm"
import type { ScriptRuntime } from "./host.ts"
import { injectNamespace } from "./host.ts"

export const NodeVmRuntime: ScriptRuntime = {
  runtime: "node-vm",
  execute: async (source, env, host, timeoutMs = 5000) => {
    const sandbox: Record<string, unknown> = {
      console,
      defineTool: host.defineTool
    }
    for (const [name, api] of Object.entries(env)) injectNamespace(sandbox, name, api.invoke)
    const context = vm.createContext(sandbox)
    const wrapped = "(async () => {\n" + source + "\n})()"
    const result = await vm.runInContext(wrapped, context, { timeout: timeoutMs })
    return result
  }
}
